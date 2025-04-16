"use client";

import { FiberProvider } from "./context/FiberContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <FiberProvider>{children}</FiberProvider>;
}
