import type { BuiltInConnectorLocale, ConnectorMessages } from "../types.js";
import { en } from "./en.js";
import { zhCN } from "./zh-CN.js";

/** Built-in locales. Copy `en` to add a new one and register it here. */
export const locales = {
  en,
  "zh-CN": zhCN,
} satisfies Record<BuiltInConnectorLocale, ConnectorMessages>;
