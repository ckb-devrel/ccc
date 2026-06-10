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
    // Map zh, zh-*, cn, cn-* to our 'zh' locale
    if (tag === 'cn' || tag === 'zh' || tag.startsWith('zh-') || tag.startsWith('cn-')) {
      if ((i18n.languages as readonly string[]).includes('zh')) return 'zh';
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

  // 0) Collapse stacked locale prefixes produced by the language switcher
  //    on 404 pages (e.g. /zh/zh/zh/ddd → /zh/ddd)
  const rawSegments = pathname.split('/').filter(Boolean);
  const langs = i18n.languages as readonly string[];
  if (rawSegments.length >= 2 && langs.includes(rawSegments[0])) {
    let i = 1;
    while (i < rawSegments.length && langs.includes(rawSegments[i])) i++;
    if (i > 1) {
      const cleaned = '/' + [rawSegments[0], ...rawSegments.slice(i)].join('/');
      return NextResponse.redirect(new URL(cleaned, request.nextUrl));
    }
  }

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
    const dest = pathname === '/docs' ? `/${lang}/docs/getting-started/introduction` : `/${lang}${pathname}`;
    return NextResponse.redirect(new URL(dest, request.nextUrl));
  }

  // 4) Redirect bare /:lang/docs to introduction (index.mdx removed)
  if (hasLang && segments.length === 2 && segments[1] === 'docs') {
    return NextResponse.redirect(
      new URL(`/${segments[0]}/docs/getting-started/introduction`, request.nextUrl),
    );
  }

  // Pass the pathname to server components so they can detect the locale
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Skip static assets, API routes, and image/OG routes
  matcher: [
    '/((?!api|_next/static|_next/image|og|llms\\.txt|llms-full\\.txt|llms\\.mdx|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)',
  ],
};

