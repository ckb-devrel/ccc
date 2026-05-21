import { defineI18n } from 'fumadocs-core/i18n';

export const i18n = defineI18n({
  languages: ['en', 'zh'],
  defaultLanguage: 'en',
  fallbackLanguage: 'en',
  // Use the `.zh.mdx` suffix for Chinese content files
  parser: 'dot',
  // Always show the locale in URLs (/en/..., /zh/...)
  hideLocale: 'never',
});