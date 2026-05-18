'use client';

import { useParams } from 'next/navigation';
import { DocsPage } from 'fumadocs-ui/layouts/notebook/page';
import { NotFoundHero } from '@/components/not-found-hero';
import { getDictionary } from '@/lib/dictionary';

/**
 * Docs-scope 404 — rendered when a `/[lang]/docs/...` slug can't be resolved
 * by the docs source. Inherits the docs sidebar + navbar from
 * `app/[lang]/docs/layout.tsx`, so visitors can keep navigating without
 * losing the docs tree.
 *
 * Wrapping with `<DocsPage full>` (matching what real docs pages do, see
 * `app/[lang]/docs/[[...slug]]/page.tsx`) lets the hero claim the full main
 * column instead of the narrow article column + reserved TOC gutter.
 *
 * Client component: `not-found.tsx` files don't receive route params, so we
 * read `lang` from `useParams()` and look the dictionary up at render time.
 */
export default function DocsNotFound() {
  const params = useParams<{ lang: string }>();
  const lang = params?.lang ?? 'en';
  const t = getDictionary(lang).notFound.docs;

  return (
    <DocsPage full toc={[]}>
      <NotFoundHero
        compact
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        glyph="404"
        glyphCaption="GET /docs → 404"
        ctas={[
          { label: t.ctaDocs, href: `/${lang}/docs`, variant: 'primary' },
          { label: t.ctaHome, href: `/${lang}`, variant: 'secondary' },
        ]}
      />
    </DocsPage>
  );
}
