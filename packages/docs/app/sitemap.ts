import type { MetadataRoute } from 'next';
import { i18n } from '@/lib/i18n';
import { siteUrl } from '@/lib/shared';
import { blogSource, source } from '@/lib/source';

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const lang of i18n.languages) {
    entries.push({ url: `${siteUrl}/${lang}` });

    for (const page of source.getPages(lang)) {
      // HTML page
      entries.push({ url: `${siteUrl}${page.url}` });
      // Raw Markdown version of the same page, for AI agents
      entries.push({ url: `${siteUrl}${page.url}.md` });
    }

    for (const post of blogSource.getPages(lang)) {
      entries.push({ url: `${siteUrl}${post.url}` });
    }
  }

  return entries;
}
