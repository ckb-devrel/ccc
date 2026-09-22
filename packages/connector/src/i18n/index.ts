import { locales } from "./locales/index.js";
import type {
  ConnectorLocale,
  ConnectorMessages,
  MessageKey,
} from "./types.js";

export * from "./locales/index.js";
export * from "./types.js";

function languageOf(locale: string): string {
  return locale.split(/[-_]/)[0].toLowerCase();
}

/**
 * Finds the built-in messages for a locale: exact match first (case
 * insensitive), then any registered locale sharing the same primary
 * language, then English.
 */
export function resolveLocale(locale: ConnectorLocale): ConnectorMessages {
  const registered = locales as Record<string, ConnectorMessages>;
  if (Object.hasOwn(registered, locale)) {
    return registered[locale];
  }
  const keys = Object.keys(registered);
  const exact = keys.find((key) => key.toLowerCase() === locale.toLowerCase());
  if (exact) {
    return registered[exact];
  }
  const language = languageOf(locale);
  const sibling = keys.find((key) => languageOf(key) === language);
  return sibling ? registered[sibling] : locales.en;
}

/** Replaces `{name}` placeholders. Unknown placeholders are left untouched. */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Resolved messages for one connector instance. */
export class I18n {
  readonly locale: ConnectorLocale;
  readonly messages: ConnectorMessages;

  constructor(locale: ConnectorLocale = "en") {
    this.locale = locale;
    this.messages = resolveLocale(locale);
  }

  t(key: MessageKey, vars?: Record<string, string | number>): string {
    const template = this.messages[key];
    return vars ? interpolate(template, vars) : template;
  }
}
