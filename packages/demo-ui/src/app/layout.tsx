import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "./provider";

export const metadata: Metadata = {
  title: "CCC UI Lab",
  description: "A design-first prototype for the CCC demo",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
