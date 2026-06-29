import type { Metadata } from 'next/types';
import { siteUrl } from './shared';

export function createMetadata(override: Metadata): Metadata {
  return {
    ...override,
    openGraph: {
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      url: siteUrl,
      images: '/banner.png',
      siteName: 'CCC Docs',
      ...override.openGraph,
    },
    twitter: {
      card: 'summary_large_image',
      creator: '@CKBDevrel',
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      images: '/banner.png',
      ...override.twitter,
    },
  };
}