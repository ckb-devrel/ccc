"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { ReactNode, useEffect, useState } from "react";
import { AppProvider } from "./context";

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [clientOptions, setClientOptions] =
    useState<{ name: string; client: ccc.Client }[]>();

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

  if (!clientOptions) return null;

  return (
    <ccc.Provider
      name="CCC Playground"
      icon="/favicon.svg"
      clientOptions={clientOptions}
      connectorProps={{
        style: {
          "--background": "#1f2937",
          "--divider": "#374151",
          "--btn-primary": "#374151",
          "--btn-primary-hover": "#4b5563",
          "--btn-secondary": "#374151",
          "--btn-secondary-hover": "#4b5563",
          "--btn-color": "#f3f4f6",
          "--btn-color-hover": "#fff",
          "--icon-primary": "#f3f4f6",
          "--icon-secondary": "#9ca3af",
          "--tip-color": "#9ca3af",
          "--tip-color-hover": "#d1d5db",
          color: "#f3f4f6",
        } as React.CSSProperties,
      }}
    >
      <AppProvider>{children}</AppProvider>
    </ccc.Provider>
  );
}
