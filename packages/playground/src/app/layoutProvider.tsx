"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { ReactNode } from "react";
import { AppProvider } from "./context";

export function LayoutProvider({ children }: { children: ReactNode }) {
  return (
    <ccc.Provider>
      <AppProvider>{children}</AppProvider>
    </ccc.Provider>
  );
}
