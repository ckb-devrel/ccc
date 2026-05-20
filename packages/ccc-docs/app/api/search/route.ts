import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { createTokenizer } from '@orama/tokenizers/mandarin';


// i18n-aware search: Orama supports per-locale indexes.
// https://docs.orama.com/docs/orama-js/supported-languages
export const { GET } = createFromSource(source, {
  localeMap: {
    en: { language: 'english' },
    cn: { 
      // Don't specify language when using custom tokenizer
      components: {
        tokenizer: createTokenizer(),
      },
    },
  },
});
