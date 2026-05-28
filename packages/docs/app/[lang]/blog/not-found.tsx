'use client';

import { useParams } from 'next/navigation';
import { NotFoundHero } from '@/components/not-found-hero';
import { getDictionary } from '@/lib/dictionary';

/**
 * Blog-scope 404 — rendered when a `/[lang]/blog/...` route can't be matched
 * (e.g. a bogus post slug) or when a blog page calls `notFound()`.
 *
 * Inherits the navbar + footer chrome from `app/[lang]/blog/layout.tsx`
 * (`HomeLayout` + site `Footer`), so the visitor never loses context.
 *
 * Client component: `not-found.tsx` files don't receive route params, so we
 * read `lang` from `useParams()` and look the dictionary up at render time.
 */
export default function BlogNotFound() {
  const params = useParams<{ lang: string }>();
  const lang = params?.lang ?? 'en';
  const t = getDictionary(lang).notFound.blog;

  return (
    <NotFoundHero
      eyebrow={t.eyebrow}
      title={t.title}
      subtitle={t.subtitle}
      glyph="404"
      glyphCaption="GET /blog → 404"
      ctas={[
        { label: t.ctaBlog, href: `/${lang}/blog`, variant: 'primary' },
        { label: t.ctaHome, href: `/${lang}`, variant: 'secondary' },
      ]}
    />
  );
}
