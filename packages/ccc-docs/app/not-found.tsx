import { headers } from 'next/headers';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { NotFoundHero } from '@/components/not-found-hero';
import { Footer } from '@/components/footer';
import { baseOptions, i18nUI } from '@/lib/layout.shared';
import { i18n } from '@/lib/i18n';
import { getDictionary } from '@/lib/dictionary';

/**
 * Global 404 — rendered for any URL that doesn't match a route. Wrapped by
 * the root layout (`app/layout.tsx`) automatically; we only need to supply
 * the locale chrome (`RootProvider` + `HomeLayout` + `Footer`) so the page
 * matches the rest of the site instead of dropping into a bare shell.
 *
 * We detect the locale from the URL (via the `x-pathname` header set by
 * the middleware) so the `RootProvider` gets the correct language context.
 * This ensures the language switcher replaces the locale prefix instead of
 * prepending a duplicate (e.g. /cn/cn/ddd).
 */
export default async function GlobalNotFound() {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '';
  const firstSegment = pathname.split('/').filter(Boolean)[0] ?? '';
  const lang = (
    (i18n.languages as readonly string[]).includes(firstSegment)
      ? firstSegment
      : i18n.defaultLanguage
  ) as (typeof i18n.languages)[number];
  const t = getDictionary(lang).notFound.global;

  return (
    <RootProvider i18n={i18nUI.provider(lang)}>
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
    </RootProvider>
  );
}
