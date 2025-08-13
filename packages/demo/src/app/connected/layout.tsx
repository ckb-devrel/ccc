"use client";

import { useApp } from "@/src/context";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const { signer } = useApp();

  useEffect(() => {
    if (!signer) {
      router.push("/");
    }
  }, [signer, router]);

  if (!signer) {
    return <>Disconnected</>;
  }

  return children;
}
