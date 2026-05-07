import { NextRequest, NextResponse } from 'next/server';
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';
import { i18n } from '@/lib/i18n';
import { docsContentRoute, docsRoute } from '@/lib/shared';

const { rewrite: rewriteDocs } = rewritePath(
  `${docsRoute}{/*path}`,
  `${docsContentRoute}{/*path}/content.md`,
);
const { rewrite: rewriteSuffix } = rewritePath(
  `${docsRoute}{/*path}.mdx`,
  `${docsContentRoute}{/*path}/content.md`,
);

// Detect preferred language from the Accept-Language header
function detectLanguage(request: NextRequest): string {
  const accept = request.headers.get('accept-language') ?? '';
  // Parse q-weighted list e.g. "zh-CN,zh;q=0.9,en;q=0.8"
  const tags = accept
    .split(',')
    .map((part) => part.trim().split(';')[0].toLowerCase())
    .filter(Boolean);

  for (const tag of tags) {
    // Map zh, zh-*, cn, cn-* to our 'cn' locale
    if (tag === 'cn' || tag === 'zh' || tag.startsWith('zh-') || tag.startsWith('cn-')) {
      if ((i18n.languages as readonly string[]).includes('cn')) return 'cn';
    }
    const short = tag.split('-')[0];
    if ((i18n.languages as readonly string[]).includes(short)) return short;
  }
  return i18n.defaultLanguage;
}

// Routes under `app/[lang]/` — paths that should be language-prefixed
const LOCALIZED_PREFIXES = ['/docs', '/blog'];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1) Markdown content negotiation for AI agents
  const suffixResult = rewriteSuffix(pathname);
  if (suffixResult) {
    return NextResponse.rewrite(new URL(suffixResult, request.nextUrl));
  }
  if (isMarkdownPreferred(request)) {
    const result = rewriteDocs(pathname);
    if (result) {
      return NextResponse.rewrite(new URL(result, request.nextUrl));
    }
  }

  // 2) Language redirect for the root path
  if (pathname === '/') {
    const lang = detectLanguage(request);
    return NextResponse.redirect(new URL(`/${lang}`, request.nextUrl));
  }

  // 3) Auto-prefix localized routes without a language segment
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  const hasLang = (i18n.languages as readonly string[]).includes(first ?? '');
  const isLocalized = LOCALIZED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!hasLang && isLocalized) {
    const lang = detectLanguage(request);
    return NextResponse.redirect(new URL(`/${lang}${pathname}`, request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets, API routes, and image/OG routes
  matcher: [
    '/((?!api|_next/static|_next/image|og|llms\\.txt|llms-full\\.txt|llms\\.mdx|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)',
  ],
};

