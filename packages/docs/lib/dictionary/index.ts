import { en } from './en';
import { zh } from './zh';
import type { Dictionary } from './types';

export type { Dictionary } from './types';

/**
 * Locale → dictionary registry. Add new languages here after creating the
 * corresponding `<lang>.ts` file.
 *
 * `satisfies` ensures every entry conforms to `Dictionary` while preserving
 * the literal `keyof` for `getDictionary` to use as a type guard.
 */
const dictionaries = { en, zh } satisfies Record<string, Dictionary>;

export type SupportedLocale = keyof typeof dictionaries;

/**
 * Resolve the dictionary for a given locale, falling back to English if the
 * locale is unknown. Use this in every server component / route that renders
 * user-visible text.
 */
export function getDictionary(lang: string): Dictionary {
  if (lang in dictionaries) {
    return dictionaries[lang as SupportedLocale];
  }
  return dictionaries.en;
}
