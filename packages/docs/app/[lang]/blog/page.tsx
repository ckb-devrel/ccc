import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { blogSource } from '@/lib/source';
import { getDictionary } from '@/lib/dictionary';

export default async function BlogIndex({ params }: PageProps<'/[lang]/blog'>) {
  const { lang } = await params;
  const dict = getDictionary(lang);
  const t = dict.blog;

  const posts = blogSource
    .getPages(lang)
    .slice()
    .sort((a, b) => {
      const da = new Date(a.data.date).getTime();
      const db = new Date(b.data.date).getTime();
      return db - da;
    });

  return (
    <main className="flex flex-1 flex-col">
      {/* Header — mirrors the typography system of the home page. */}
      <section className="border-b border-hairline">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 md:py-20">
          <p className="font-mono text-[11px] tracking-widest uppercase text-fd-primary mb-4">
            {t.eyebrow}
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            {t.title}
          </h1>
          <p className="text-fd-muted-foreground text-base md:text-lg max-w-2xl leading-relaxed">
            {t.subtitle}
          </p>
        </div>
      </section>

      {/* Posts — editorial list, separated by hairlines rather than cards. */}
      <section className="mx-auto w-full max-w-4xl px-6 py-6 md:py-10">
        {posts.length === 0 ? (
          <p className="py-10 text-fd-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="flex flex-col">
            {posts.map((post) => {
              const date = new Date(post.data.date);
              const tags = (post.data.tags ?? []) as string[];
              return (
                <li key={post.url} className="border-b border-hairline last:border-b-0">
                  <Link
                    href={post.url}
                    className="group py-7 md:py-8 grid md:grid-cols-[8rem_1fr] gap-2 md:gap-8"
                  >
                    {/* Date column — fixed-width so titles align across rows. */}
                    <time
                      className="font-mono text-xs text-fd-muted-foreground pt-1.5"
                      dateTime={date.toISOString()}
                    >
                      {date.toLocaleDateString(dict.dateLocale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                    <div className="min-w-0">
                      <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-2 leading-snug group-hover:text-fd-primary transition-colors flex items-start gap-2">
                        <span>{post.data.title}</span>
                        <ArrowUpRight className="size-4 mt-1.5 shrink-0 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0 text-fd-primary" />
                      </h2>
                      {post.data.description && (
                        <p className="text-fd-muted-foreground text-sm md:text-[15px] leading-relaxed mb-3 line-clamp-2">
                          {post.data.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap text-xs text-fd-muted-foreground">
                        <span>
                          {t.by} <span className="text-fd-foreground/80">{post.data.author}</span>
                        </span>
                        {tags.length > 0 && (
                          <>
                            <span className="text-fd-border">·</span>
                            <div className="flex gap-1.5 flex-wrap">
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border border-hairline text-fd-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

// `[lang]` is pre-rendered by the parent layout's `generateStaticParams`;
// the blog list page itself has no additional dynamic segments to enumerate.
