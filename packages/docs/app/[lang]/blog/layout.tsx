import { notFound } from 'next/navigation';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { Footer } from '@/components/footer';

// Blog uses the same top navigation as the landing page
export default async function Layout({
  params,
  children,
}: LayoutProps<'/[lang]/blog'>) {

  notFound(); // 所有 /blog/* 路由直接 404

  const { lang } = await params;
  return (
    <HomeLayout {...baseOptions(lang)}>
      {children}
      <Footer lang={lang} />
    </HomeLayout>
  );
}
