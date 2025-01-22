"use client";

import React from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex w-11/12 flex-col items-center sm:w-8/12 lg:w-8/12">
      {children}
    </div>
  );
}
