'use client';

import { useParams } from 'next/navigation';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { NotFoundHero } from '@/components/not-found-hero';
import { Footer } from '@/components/footer';
import { baseOptions } from '@/lib/layout.shared';
import { getDictionary } from '@/lib/dictionary';

/**
 * Locale-aware 404 for `/[lang]/*` routes that don't match any page under
 * docs, blog, or home.
 *
 * The parent `app/[lang]/layout.tsx` has already validated the locale and
 * wrapped us in `RootProvider`, so fumadocs i18n context (including the
 * language switcher) works correctly here.
 *
 * We add `HomeLayout` + `Footer` ourselves because this not-found sits
 * above the `(home)` / `blog` / `docs` route groups, none of whose layouts
 * wrap us.
 *
 * Client component because `not-found.tsx` doesn't receive params — we read
 * `lang` from `useParams()` instead.
 */
export default function LangNotFound() {
  const params = useParams<{ lang: string }>();
  const lang = params?.lang ?? 'en';
  const t = getDictionary(lang).notFound.global;

  return (
    <HomeLayout {...baseOptions(lang)}>
      <main className="flex flex-1 flex-col">
        <NotFoundHero
          eyebrow={t.eyebrow}
          title={t.title}
          subtitle={t.subtitle}
          ctas={[
            { label: t.ctaDocs, href: `/${lang}/docs`, variant: 'primary' },
            { label: t.ctaHome, href: `/${lang}`, variant: 'secondary' },
          ]}
        />
      </main>
      <Footer lang={lang} />
    </HomeLayout>
  );
}
