import { locales } from "./locales/index.js";

/** Language tags the connector ships translations for. */
export type ConnectorLocale = keyof typeof locales;

/**
 * A BCP 47 language tag, e.g. `"en"` or `"zh-HK"`. Built-in locales get
 * completion. Any other tag is resolved to the closest built-in locale (same
 * language and script first, then same language, e.g. `zh-HK` → `zh-Hans`
 * until a `zh-Hant` locale ships), then English.
 */
export type ConnectorLocaleLike =
  ConnectorLocale | (string & Record<never, never>);

/** A registered locale together with its parsed language and script. */
export interface LocaleCandidate<K extends string = string> {
  key: K;
  language: string;
  script?: string | undefined;
}

function parseTag(
  tag: string,
): { language: string; script?: string | undefined } | undefined {
  try {
    // `maximize()` fills in the likely script: zh-CN → Hans, zh-HK → Hant.
    const { language, script } = new Intl.Locale(
      tag.replace(/_/g, "-"),
    ).maximize();
    return { language, script };
  } catch {
    return undefined; // not a valid BCP 47 tag
  }
}

/**
 * Picks the candidate closest to `like`: same language and script first, then
 * same language with any script. When several candidates tie, the one
 * registered first wins, so register the preferred variant first.
 * Returns `undefined` when nothing matches or `like` is not a valid tag.
 */
export function matchLocale<K extends string>(
  like: string | null | undefined,
  candidates: readonly LocaleCandidate<K>[],
): K | undefined {
  const want = like ? parseTag(like) : undefined;
  if (!want) {
    return undefined;
  }
  return (
    candidates.find(
      (c) => c.language === want.language && c.script === want.script,
    ) ?? candidates.find((c) => c.language === want.language)
  )?.key;
}

const builtIn: readonly LocaleCandidate<ConnectorLocale>[] = (
  Object.keys(locales) as ConnectorLocale[]
).flatMap((key) => {
  const tag = parseTag(key);
  return tag ? [{ key, ...tag }] : [];
});

/** Resolves any tag (or nothing) to the built-in locale that will be shown. */
export function resolveConnectorLocale(
  like: string | null | undefined,
): ConnectorLocale {
  return matchLocale(like, builtIn) ?? "en";
}
