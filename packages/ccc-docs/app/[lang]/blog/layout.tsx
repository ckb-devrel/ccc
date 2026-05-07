import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

// Blog uses the same top navigation as the landing page
export default async function Layout({
  params,
  children,
}: LayoutProps<'/[lang]/blog'>) {
  const { lang } = await params;
  return <HomeLayout {...baseOptions(lang)}>{children}</HomeLayout>;
}
