import { blog, docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { i18n } from './i18n';
import { docsContentRoute, docsImageRoute, docsRoute, siteUrl } from './shared';

// Main docs source with i18n
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  i18n,
  plugins: [lucideIconsPlugin()],
});

// Blog source with i18n
export const blogSource = loader({
  baseUrl: '/blog',
  source: blog.toFumadocsSource(),
  i18n,
});

export function getPageImage(page: (typeof source)['$inferPage']) {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: `${docsImageRoute}/${segments.join('/')}`,
  };
}

export function getPageMarkdownUrl(page: (typeof source)['$inferPage']) {
  const segments = [...page.slugs, 'content.md'];

  return {
    segments,
    url: `${docsContentRoute}/${segments.join('/')}`,
  };
}

export async function getLLMText(page: (typeof source)['$inferPage']) {
  const processed = await page.data.getText('processed');

  // Absolutize root-relative Markdown links (`](/...)`) so they resolve when the
  // page is consumed standalone (per-page `.md`) or concatenated into
  // `llms-full.txt`, where there is no page origin to resolve against.
  const absolute = processed.replace(/\]\(\//g, `](${siteUrl}/`);

  return `# ${page.data.title} (${siteUrl}${page.url})

${absolute}`;
}
