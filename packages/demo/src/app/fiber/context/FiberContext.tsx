"use client";

import { createContext, useContext, ReactNode, useState } from "react";
import { FiberSDK } from "@ckb-ccc/fiber";

interface FiberContextType {
  fiber: FiberSDK | null;
  setFiber: (fiber: FiberSDK | null) => void;
}

const FiberContext = createContext<FiberContextType | null>(null);

export function FiberProvider({ children }: { children: ReactNode }) {
  const [fiber, setFiber] = useState<FiberSDK | null>(null);

  return (
    <FiberContext.Provider value={{ fiber, setFiber }}>
      {children}
    </FiberContext.Provider>
  );
}

export function useFiber() {
  const context = useContext(FiberContext);
  if (!context) {
    throw new Error("useFiber must be used within a FiberProvider");
  }
  return context;
}
