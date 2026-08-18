"use client";

import { ccc } from "@ckb-ccc/connector-react";

const clientOptions = [
  {
    name: "CKB Testnet",
    client: new ccc.ClientPublicTestnet(),
  },
  {
    name: "CKB Mainnet",
    client: new ccc.ClientPublicMainnet(),
  },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
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
