import { defineI18n } from 'fumadocs-core/i18n';

export const i18n = defineI18n({
  languages: ['en'],
  defaultLanguage: 'en',
  fallbackLanguage: 'en',
  // Use the `.cn.mdx` suffix for Chinese content files
  parser: 'dot',
  // Always show the locale in URLs (/en/..., /cn/...)
  hideLocale: 'never',
});