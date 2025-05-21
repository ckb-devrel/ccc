"use client";

import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { FiberSDK } from "@ckb-ccc/fiber";

interface FiberContextType {
  fiber: FiberSDK | null;
  setFiber: (fiber: FiberSDK | null) => void;
}

const FiberContext = createContext<FiberContextType | null>(null);

export function FiberProvider({ children }: { children: ReactNode }) {
  const [fiber, setFiber] = useState<FiberSDK | null>(() => {
    // 从 localStorage 中获取存储的 fiber 配置
    if (typeof window !== 'undefined') {
      const savedConfig = localStorage.getItem('fiberConfig');
      if (savedConfig) {
        try {
          const config = JSON.parse(savedConfig);
          return new FiberSDK(config);
        } catch (error) {
          console.error('Failed to restore fiber from localStorage:', error);
          return null;
        }
      }
    }
    return null;
  });
  
  // 当 fiber 更新时，保存到 localStorage
  useEffect(() => {
    if (fiber) {
      // 保存配置到 localStorage
      const config = {
        endpoint: '/api/fiber', // 使用默认的 endpoint
        timeout: 5000 // 使用默认的 timeout
      };
      localStorage.setItem('fiberConfig', JSON.stringify(config));
    } else {
      localStorage.removeItem('fiberConfig');
    }
  }, [fiber]);

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
