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
  const [restorationPending, setRestorationPending] = useState(true);

  // On mount, start a grace period for session restoration.
  // setTimeout ensures setState is async (satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    const delay = hasSavedConnection() ? 3000 : 0;
    const timer = setTimeout(() => setRestorationPending(false), delay);
    return () => clearTimeout(timer);
  }, []);

  // Derived: still restoring if pending and signer hasn't appeared
  const isRestoring = restorationPending && !signer;

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
