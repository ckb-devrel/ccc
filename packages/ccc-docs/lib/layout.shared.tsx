import { i18n } from '@/lib/i18n';
import { defineI18nUI } from 'fumadocs-ui/i18n';
import Image from 'next/image';
import type { BaseLayoutProps, LinkItemType } from 'fumadocs-ui/layouts/shared';
import { appName, externalLinks } from './shared';
import cccLogo from '@/public/ccc-logo.svg';

export const i18nUI = defineI18nUI(i18n, {
  en: {
    displayName: 'English',
  },
  cn: {
    displayName: '简体中文',
    search: '搜索文档',
  },
});

// UI text translations for navigation
const navTranslations = {
  en: {
    docs: 'Docs',
    blog: 'Blog',
    playground: 'Playground',
    api: 'API Reference',
  },
  cn: {
    docs: '文档',
    blog: '博客',
    playground: '在线演练场',
    api: 'API 参考',
  },
} as const;

export const logo = (
  <Image
    alt="CCC"
    src={cccLogo}
    width={22}
    height={22}
    className="size-[22px]"
    aria-label="CCC"
  />
);

export function baseOptions(locale: string): BaseLayoutProps {
  const t = navTranslations[locale as keyof typeof navTranslations] ?? navTranslations.en;

  const links: LinkItemType[] = [
    {
      type: 'main',
      url: `/${locale}/docs`,
      text: t.docs,
    },
    {
      type: 'main',
      url: `/${locale}/blog`,
      text: t.blog,
    },
    {
      type: 'main',
      url: externalLinks.playground,
      text: t.playground,
      external: true,
    },
    {
      type: 'main',
      url: externalLinks.api,
      text: t.api,
      external: true,
    },
  ];

  return {
    i18n,
    nav: {
      title: (
        <>
          {logo}
          <span className="font-medium">{appName}</span>
        </>
      ),
      url: `/${locale}`,
    },
    links,
    githubUrl: externalLinks.github,
  };
}
