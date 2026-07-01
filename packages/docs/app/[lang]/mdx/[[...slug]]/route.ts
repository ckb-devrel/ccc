import { docsIndexNote } from '@/lib/shared';
import { source } from '@/lib/source';
import { notFound } from 'next/navigation';
import { siteUrl } from '@/lib/shared';

export const revalidate = false;
 
export async function GET(_req: Request, { params }: RouteContext<'/[lang]/mdx/[[...slug]]'>) {
  const { slug, lang } = await params;
  const page = source.getPage(slug, lang);
  if (!page) notFound();
 
  // Serve processed Markdown (MDX imports/JSX stripped) so AI agents fetching
  // the advertised `.md` / `.mdx` URLs get clean text, not raw component source.
  const processed = await page.data.getText('processed');
  const content = `# ${page.data.title}
URL: ${siteUrl}${page.url}
Source: https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/docs/content/docs/${page.path}
> ${page.data.description ?? ''}
${processed}`;
 
  return new Response(`${docsIndexNote}\n\n---\n${content}`, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
}
 
export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: page.slugs,
  }));
}