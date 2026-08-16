import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "./provider";

export const metadata: Metadata = {
  applicationName: "CCC App",
  title: "CCC App",
  description: "An app based on the CCC library",
  icons:
    "https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/assets/logo.svg",
  openGraph: {
    title: "CCC App",
    description: "An app based on the CCC library",
    images:
      "https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/assets/opengraph.png",
  },
  twitter: {
    card: "summary_large_image",
    title: "CCC App",
    description: "An app based on the CCC library",
    images:
      "https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/assets/opengraph.png",
  },
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
