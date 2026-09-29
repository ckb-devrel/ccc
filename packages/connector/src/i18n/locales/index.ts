import type { ConnectorMessages } from "../types.js";
import { en } from "./en.js";
import { zhHans } from "./zh-Hans.js";

/**
 * Built-in locales, keyed by BCP 47 tag. To add one, copy `en.ts`, then
 * register it here: `ConnectorLocale` updates automatically.
 */
export const locales = {
  en,
  "zh-Hans": zhHans,
} satisfies Record<string, ConnectorMessages>;
