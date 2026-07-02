import { docsIndexNote } from '@/lib/shared';
import { getLLMText, getPageMarkdownUrl, source } from '@/lib/source';
import { notFound } from 'next/navigation';

export const revalidate = false;

export async function GET(_req: Request, { params }: RouteContext<'/llms.mdx/docs/[[...slug]]'>) {
  const { slug } = await params;
  const pageSlugs =
    slug?.at(-1) === 'content.md' ? slug.slice(0, -1) : slug;
  const page = source.getPage(pageSlugs);
  if (!page) notFound();

  return new Response(
    `${docsIndexNote}\n\n${await getLLMText(page)}\n\n`,
    {
      headers: {
        'Content-Type': 'text/markdown',
        'Cache-Control': 'public, max-age=3600, must-revalidate',
      },
    },
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageMarkdownUrl(page).segments,
  }));
}
