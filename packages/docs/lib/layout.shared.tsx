import { i18n } from '@/lib/i18n';
import { defineI18nUI } from 'fumadocs-ui/i18n';
import Image from 'next/image';
import type { BaseLayoutProps, LinkItemType } from 'fumadocs-ui/layouts/shared';
import { appName, appTagline, externalLinks } from './shared';
import { getDictionary } from './dictionary';
import cccLogo from '@/public/ccc-logo.svg';

export const i18nUI = defineI18nUI(i18n, {
  en: {
    displayName: 'English',
  },
  zh: {
    displayName: '简体中文',
    search: '搜索文档',
    searchNoResult: '没有找到结果',
    toc: '目录',
    tocNoHeadings: '没有标题',
    lastUpdate: '最后更新于',
    chooseLanguage: '切换语言',
    nextPage: '下一页',
    previousPage: '上一页',
    chooseTheme: '切换主题',
    editOnGithub: '在 GitHub 上编辑'
  },
});

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

export function baseOptions(locale: string, { showNavLinks = true }: { showNavLinks?: boolean } = {}): BaseLayoutProps {
  const t = getDictionary(locale).nav;

  const links: LinkItemType[] = [
    {
      type: 'main',
      url: `/${locale}/docs/getting-started/introduction`,
      text: t.docs,
    },
    /*{
      type: 'main',
      url: `/${locale}/blog`,
      text: t.blog,
    },*/
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
    {
      type: 'main',
      url: externalLinks.demo,
      text: t.demo,
      external: true,
    },
  ];

  return {
    i18n,
    nav: {
      title: (
        <>
          {logo}
          <span className="font-medium">{appName} - {appTagline}</span>
        </>
      ),
      url: `/${locale}`,
    },
    links: showNavLinks ? links : [],
    githubUrl: externalLinks.github,
  };
}
