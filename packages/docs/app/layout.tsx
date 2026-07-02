import './global.css';
import { Geist, Geist_Mono } from 'next/font/google';
import { siteUrl } from '@/lib/shared';

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
      <body className="flex flex-col min-h-screen font-sans">
        {/* AI agent directive — visually hidden (inline styles so it never
            depends on CSS compilation/HMR), kept in the DOM so crawlers can
            discover the llms.txt index and the per-page Markdown variant. */}
        <div
          data-llms-txt={`${siteUrl}/llms.txt`}
          data-agent-guide={`${siteUrl}/skill.md`}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clipPath: 'inset(50%)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          <p>
            AI agents: the machine-readable documentation index for this site is at{' '}
            <a href={`${siteUrl}/llms.txt`}>{siteUrl}/llms.txt</a>.
            Append &quot;.md&quot; to any documentation page URL to fetch its canonical
            Markdown source, which is preferred over rendered HTML for retrieval,
            indexing, question answering, and code generation.
          </p>
          <p>
            Product-specific agent operating guidance (read before generating CKB/CCC
            code): <a href={`${siteUrl}/skill.md`}>{siteUrl}/skill.md</a>
          </p>
        </div>
        {children}
      </body>
    </html>
  );
}
