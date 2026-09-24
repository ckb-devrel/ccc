import { resolveConnectorLocale, type ConnectorLocale } from "./locale.js";
import { locales } from "./locales/index.js";
import type { ConnectorMessages, MessageKey } from "./types.js";

// Package-internal entry. The public barrel re-exports the types only.
export {
  matchLocale,
  resolveConnectorLocale,
  type ConnectorLocale,
  type ConnectorLocaleLike,
  type LocaleCandidate,
} from "./locale.js";
export { locales } from "./locales/index.js";
export type { ConnectorMessages, MessageKey } from "./types.js";

/** Replaces `{name}` placeholders. Unknown placeholders are left untouched. */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}

/** Resolved messages for one connector instance. */
export class I18n {
  /** The built-in locale actually in use (already resolved). */
  readonly locale: ConnectorLocale;
  readonly messages: ConnectorMessages;

  constructor(like?: string | null) {
    this.locale = resolveConnectorLocale(like);
    this.messages = locales[this.locale];
  }

  t(key: MessageKey, vars?: Record<string, string | number>): string {
    const template = this.messages[key];
    return vars ? interpolate(template, vars) : template;
  }
}
