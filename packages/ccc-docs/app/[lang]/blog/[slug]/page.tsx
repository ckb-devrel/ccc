import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { blogSource } from '@/lib/source';
import { getMDXComponents } from '@/components/mdx';

export default async function BlogPost(props: PageProps<'/[lang]/blog/[slug]'>) {
  const { lang, slug } = await props.params;
  const post = blogSource.getPage([slug], lang);
  if (!post) notFound();

  const MDX = post.data.body;
  const toc = post.data.toc;
  const date = new Date(post.data.date);
  const tags = (post.data.tags ?? []) as string[];

  return (
    <main className="flex flex-1 flex-col">
      {/* Header — full-width band matching the list page's header. */}
      <section className="border-b border-hairline">
        <div className="mx-auto w-full max-w-3xl px-6 pt-10 pb-12 md:pt-14 md:pb-14">
          <Link
            href={`/${lang}/blog`}
            className="group inline-flex items-center gap-1.5 font-mono text-[11px] tracking-widest uppercase text-fd-muted-foreground hover:text-fd-primary transition-colors mb-10"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            {lang === 'cn' ? '返回博客' : 'Back to Blog'}
          </Link>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.1] mb-5">
            {post.data.title}
          </h1>
          {post.data.description && (
            <p className="text-base md:text-lg text-fd-muted-foreground leading-relaxed mb-6 max-w-2xl">
              {post.data.description}
            </p>
          )}
          <div className="flex items-center gap-3 flex-wrap text-xs text-fd-muted-foreground">
            <span className="font-medium text-fd-foreground/80">{post.data.author}</span>
            <span className="text-fd-border">·</span>
            <time dateTime={date.toISOString()} className="font-mono">
              {date.toLocaleDateString(lang === 'cn' ? 'zh-CN' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            {tags.length > 0 && (
              <>
                <span className="text-fd-border">·</span>
                <div className="flex gap-1.5 flex-wrap">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border border-hairline"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/*
       * Article body — fumadocs `getMDXComponents()` already provides styled
       * `h*`, `pre`, `code`, `table`, etc. We add small editorial tweaks
       * (heading rhythm, link color, paragraph measure) via arbitrary
       * variants so we don't depend on the tailwindcss-typography plugin.
       */}
      <section className="mx-auto w-full max-w-3xl px-6 py-12 md:py-16">
        {/* Table of Contents */}
        {toc.length > 0 && (
          <nav className="mb-10 rounded-lg border border-hairline bg-fd-card/50 px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-fd-muted-foreground">
              {lang === 'cn' ? '目录' : 'Table of Contents'}
            </p>
            <ul className="space-y-1.5 text-[13.5px]">
              {toc.map((item) => (
                <li
                  key={item.url}
                  style={{ paddingLeft: `${(item.depth - 2) * 14}px` }}
                >
                  <a
                    href={item.url}
                    className="inline-block text-fd-muted-foreground transition-colors hover:text-fd-primary"
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <article
          className="
            text-[15.5px] leading-[1.75] text-fd-foreground/90
            [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-12 [&_h2]:mb-4
            [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:mt-10 [&_h3]:mb-3
            [&_p]:my-5
            [&_ul]:my-5 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:marker:text-fd-primary/60
            [&_ol]:my-5 [&_ol]:pl-6 [&_ol]:list-decimal [&_ol]:marker:text-fd-muted-foreground
            [&_li]:my-1.5
            [&_a]:text-fd-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-fd-primary/40 hover:[&_a]:decoration-fd-primary
            [&_blockquote]:border-l-2 [&_blockquote]:border-fd-primary/50 [&_blockquote]:pl-5 [&_blockquote]:text-fd-muted-foreground [&_blockquote]:italic [&_blockquote]:my-6
          "
        >
          <MDX components={getMDXComponents()} />
        </article>
      </section>
    </main>
  );
}

export function generateStaticParams() {
  // `generateParams` returns `{ slug: string[], lang: string }`,
  // but this route has a single `[slug]` segment, so we flatten the array
  // to a string and drop any entry that would map to the module root.
  return blogSource
    .generateParams('slug', 'lang')
    .filter((p) => p.slug.length === 1)
    .map((p) => ({ lang: p.lang, slug: p.slug[0] }));
}

export async function generateMetadata(
  props: PageProps<'/[lang]/blog/[slug]'>,
): Promise<Metadata> {
  const { lang, slug } = await props.params;
  const post = blogSource.getPage([slug], lang);
  if (!post) notFound();

  return {
    title: post.data.title,
    description: post.data.description,
  };
}
