import './global.css';
import { Geist, Geist_Mono } from 'next/font/google';

// A modern sans preferred by developer-facing products. We expose both the
// sans and mono families as CSS variables so MDX / marketing pages can use
// `font-mono` (e.g. for `$ npm install …`) without another font load.
const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

// Root layout renders <html>/<body>. The locale-specific <RootProvider>
// and HomeLayout / DocsLayout live under `app/[lang]/`.
export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen font-sans">{children}</body>
    </html>
  );
}
