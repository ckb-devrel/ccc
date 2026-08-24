"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useState, type ReactNode } from "react";

export function AppProvider({ children }: { children: ReactNode }) {
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
      name="CCC Precision Toolkit"
      icon="/logo.svg"
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
      {children}
    </ccc.Provider>
  );
}
