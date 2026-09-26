"use client";

import { ccc } from "@ckb-ccc/connector-react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/** Native name of a language tag, e.g. `"zh-Hans"` → `"简体中文"`. */
function localeDisplayName(locale: ccc.ConnectorLocale): string {
  try {
    return (
      new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale
    );
  } catch {
    return locale;
  }
}

/**
 * Connector languages offered by the header dropdown, read straight from the
 * connector's built-in locale registry. Contributing a new connector
 * language (see CONTRIBUTING.md) makes it show up here automatically.
 */
export const CONNECTOR_LOCALES: readonly {
  value: ccc.ConnectorLocale;
  label: string;
}[] = (Object.keys(ccc.locales) as ccc.ConnectorLocale[]).map((value) => ({
  value,
  label: localeDisplayName(value),
}));

export type AppConnectorLocale = ccc.ConnectorLocale;

const LocaleContext = createContext<{
  locale: AppConnectorLocale;
  setLocale: (locale: AppConnectorLocale) => void;
}>({ locale: "en", setLocale: () => {} });

/** Locale of the connector UI, switchable at runtime from the header. */
export function useConnectorLocale() {
  return useContext(LocaleContext);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [clientOptions, setClientOptions] =
    useState<{ name: string; client: ccc.Client }[]>();
  const [locale, setLocale] = useState<AppConnectorLocale>("en");

  useEffect(() => {
    const owner = ccc.OwnerAggregated.from([
      ccc.ClientPublicTestnet.open(),
      ccc.ClientPublicMainnet.open(),
    ] as const);
    const [testnet, mainnet] = owner.value;
    // The clients must be opened after commit to avoid leaking aborted renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClientOptions([
      { name: "CKB Testnet", client: testnet },
      { name: "CKB Mainnet", client: mainnet },
    ]);
    return () => void owner.dispose().catch(() => {});
  }, []);

  if (!clientOptions) {
    return null;
  }

  return (
    <ccc.Provider
      name="CCC App"
      icon="/logo.svg"
      locale={locale}
      clientOptions={clientOptions}
      connectorProps={{
        style: {
          "--background":
            "linear-gradient(90deg, rgb(230 238 242 / 2%) 1px, transparent 1px) center / 48px 48px, linear-gradient(rgb(230 238 242 / 2%) 1px, transparent 1px) center / 48px 48px, #11181c",
          "--divider": "#28343a",
          "--btn-primary": "rgb(230 238 242 / 6%)",
          "--btn-primary-hover": "rgb(91 206 250 / 10%)",
          "--btn-secondary": "rgb(230 238 242 / 6%)",
          "--btn-secondary-hover": "rgb(91 206 250 / 10%)",
          "--btn-color": "#e6eef2",
          "--btn-color-hover": "#5bcefa",
          "--icon-primary": "#e6eef2",
          "--icon-secondary": "#89979f",
          "--tip-color": "#76858d",
          "--tip-color-hover": "#31515f",
          color: "#e6eef2",
        } as React.CSSProperties,
      }}
    >
      <LocaleContext.Provider value={{ locale, setLocale }}>
        {children}
      </LocaleContext.Provider>
    </ccc.Provider>
  );
}
