import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LayoutProvider } from "./layoutProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CCC App",
  description: "An app based on the CCC library",
  icons: "/favicon.svg",
  openGraph: {
    title: "CCC App",
    description: "An app based on the CCC library",
    images: "/opengraph.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="flex min-h-full flex-col">
      <head>
        <meta
          name="viewport"
          content="user-scalable=no, initial-scale=1, maximum-scale=1, minimum-scale=1, width=device-width, height=device-height, target-densitydpi=device-dpi"
        />
      </head>
      <body className={`flex grow flex-col ${inter.className}`}>
        {process.env.NEXT_PUBLIC_ANALYTICS_ID ? (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_ANALYTICS_ID} />
        ) : undefined}
        <LayoutProvider>{children}</LayoutProvider>
      </body>
    </html>
  );
}
