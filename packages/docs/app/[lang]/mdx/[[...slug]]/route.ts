import { docsIndexNote } from '@/lib/shared';
import { source } from '@/lib/source';
import { notFound } from 'next/navigation';
 
export const revalidate = false;
 
export async function GET(_req: Request, { params }: RouteContext<'/[lang]/mdx/[[...slug]]'>) {
  const { slug, lang } = await params;
  const page = source.getPage(slug, lang);
  if (!page) notFound();
 
  // Serve processed Markdown (MDX imports/JSX stripped) so AI agents fetching
  // the advertised `.md` / `.mdx` URLs get clean text, not raw component source.
  const content = await page.data.getText('processed');
 
  return new Response(`${content}\n\n---\n\n${docsIndexNote}\n`, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
 
export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: page.slugs,
  }));
}