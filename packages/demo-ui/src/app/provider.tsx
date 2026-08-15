"use client";

import { ccc } from "@ckb-ccc/connector-react";

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ccc.Provider
      name="CCC Precision Toolkit"
      icon="/logo.svg"
      clientOptions={[
        {
          name: "CKB Testnet",
          client: new ccc.ClientPublicTestnet(),
        },
        {
          name: "CKB Mainnet",
          client: new ccc.ClientPublicMainnet(),
        },
      ]}
      connectorProps={{
        style: {
          "--background": "#11181c",
          "--divider": "#28343a",
          "--btn-primary": "#171d21",
          "--btn-primary-hover": "#5bcefa",
          "--btn-secondary": "#171d21",
          "--btn-secondary-hover": "#5bcefa",
          "--btn-color": "#e6eef2",
          "--btn-color-hover": "#070a0c",
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
