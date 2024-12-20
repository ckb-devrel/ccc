import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { LayoutProvider } from "./layoutProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "CCC Playground",
  description: "Start exploring CKB from here!",
  icons: "/favicon.svg",
  openGraph: {
    title: "CCC Playground",
    description: "Start exploring CKB from here!",
    images: "/opengraph.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LayoutProvider>{children}</LayoutProvider>
      </body>
    </html>
  );
}
