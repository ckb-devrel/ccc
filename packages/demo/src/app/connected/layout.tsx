"use client";

import { useApp } from "@/src/context";
import { hasSavedConnection, saveReturnPath } from "@/src/utils";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { signer } = useApp();
  const [isRestoring, setIsRestoring] = useState(true);

  // On mount, check if there's a saved connection to restore
  useEffect(() => {
    if (!hasSavedConnection()) {
      setIsRestoring(false);
      return;
    }
    // Give the connector a grace period to restore the session
    const timer = setTimeout(() => setIsRestoring(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Clear restoring state as soon as signer appears
  useEffect(() => {
    if (signer) {
      setIsRestoring(false);
    }
  }, [signer]);

  // Redirect when we're sure the user isn't connected
  useEffect(() => {
    if (!isRestoring && !signer) {
      saveReturnPath(pathname);
      router.push("/");
    }
  }, [isRestoring, signer, router, pathname]);

  if (!signer) {
    return isRestoring ? null : <>Disconnected</>;
  }

  return children;
}
