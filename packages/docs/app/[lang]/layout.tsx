import { RootProvider } from 'fumadocs-ui/provider/next';
import { i18nUI } from '@/lib/layout.shared';
import { i18n } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export default async function LangLayout({
  params,
  children,
}: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!(i18n.languages as readonly string[]).includes(lang)) notFound();

  return (
    <RootProvider i18n={i18nUI.provider(lang as (typeof i18n.languages)[number])}>
      {children}
    </RootProvider>
  );
}

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}
