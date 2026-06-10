import { source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
  MarkdownCopyButton,
  PageLastUpdate,
} from 'fumadocs-ui/layouts/notebook/page';
import { AskAiPopover } from '@/components/ask-ai-popover';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getGithubLastEdit } from 'fumadocs-core/content/github';
import { gitConfig } from '@/lib/shared';
import { getDictionary } from '@/lib/dictionary';
import type { Dictionary } from '@/lib/dictionary';

/**
 * Resolve the section eyebrow shown above each docs page title from the
 * first slug segment. Returns null when the slug doesn't map to a known
 * section so the eyebrow is simply hidden.
 */
function getSectionLabel(slug: string[] | undefined, dict: Dictionary): string | null {
  if (!slug || slug.length === 0) return null;
  const sections = dict.docs.sections;
  const key = slug[0] as keyof typeof sections;
  return sections[key] ?? null;
}

export default async function Page(props: PageProps<'/[lang]/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug, params.lang);
  if (!page) notFound();

  const dict = getDictionary(params.lang);
  const MDX = page.data.body;
  const markdownUrl = `${page.url}.md`;
  const eyebrow = getSectionLabel(params.slug, dict);

  // Path of the source file in the repo, used for both editOnGithub and lastUpdate.
  const repoPath = `packages/docs/content/docs/${page.path}`;

  // Fetch the last edit time from the GitHub API. Returns null if the request
  // fails (offline build, rate-limit, etc.) — DocsPage will simply hide it.
  let lastUpdate: Date | undefined;
  try {
    const time = await getGithubLastEdit({
      owner: gitConfig.user,
      repo: gitConfig.repo,
      sha: gitConfig.branch,
      path: repoPath,
      // Provide a token via env to avoid rate-limit on production builds.
      token: process.env.GITHUB_TOKEN ? `Bearer ${process.env.GITHUB_TOKEN}` : undefined,
    });
    if (time) lastUpdate = new Date(time);
  } catch {
    // Swallow — last update is decorative.
  }

  console.log(`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/${repoPath}`);

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      tableOfContent={{ style: 'clerk' }}
    >
      {/* Editorial eyebrow — mirrors the home / blog mono uppercase tag. */}
      {eyebrow && (
        <div className="mb-3 font-mono text-[11px] uppercase tracking-widest text-fd-primary/80">
          {eyebrow}
        </div>
      )}

      <DocsTitle className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.15]">
        {page.data.title}
      </DocsTitle>

      {page.data.description && (
        <DocsDescription className="mb-0 text-base text-fd-muted-foreground leading-relaxed">
          {page.data.description}
        </DocsDescription>
      )}

      {/* Hairline tool row — copy markdown / view source / edit on GitHub. */}
      <div className="flex flex-row gap-2 items-center border-b border-hairline pb-5 mt-2">
        <MarkdownCopyButton markdownUrl={markdownUrl} >
          {dict.docs.copyMarkdown}
        </MarkdownCopyButton>
        <AskAiPopover labels={dict.docs.askAiItems}>
          {dict.docs.askAi}
        </AskAiPopover>
        <EditOnGitHub
          href={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/${repoPath}`}
        />
      </div>

      <DocsBody className="docs-prose">
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>

      {/* Footer line — last edit time fetched from GitHub. */}
      {lastUpdate && (
        <PageLastUpdate
          date={lastUpdate}
          className="mt-12 pt-6 border-t border-hairline text-xs text-fd-muted-foreground"
        />
      )}
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams('slug', 'lang');
}

export async function generateMetadata(
  props: PageProps<'/[lang]/docs/[[...slug]]'>,
): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug, params.lang);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      //images: getPageImage(page).url,
      images: [
        {
          url: 'https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/assets/opengraph.png',
          width: 740,
          height: 370,
          alt: page.data.title,
        },
      ],
    },
  };
}
