import { source } from '@/lib/source';
import { notFound } from 'next/navigation';
 
export const revalidate = false;
 
export async function GET(_req: Request, { params }: RouteContext<'/[lang]/mdx/[[...slug]]'>) {
  const { slug, lang } = await params;
  const page = source.getPage(slug, lang);
  if (!page) notFound();
 
  // Return raw markdown content
  const rawContent = await page.data.getText('raw');
 
  return new Response(rawContent, {
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