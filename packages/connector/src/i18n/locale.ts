import { locales } from "./locales/index.js";

/** Language tags the connector ships translations for. */
export type ConnectorLocale = keyof typeof locales;

/** Language tags the connector ships translations for, in registration order. */
export const connectorLocales: readonly ConnectorLocale[] = Object.freeze(
  Object.keys(locales) as ConnectorLocale[],
);

/**
 * Returns `locale` if it is exactly a built-in tag, otherwise English.
 * Mapping app languages (e.g. `zh-CN`) to a built-in tag is up to the app.
 */
export function resolveConnectorLocale(
  locale: string | null | undefined,
): ConnectorLocale {
  return connectorLocales.find((key) => key === locale) ?? "en";
}
