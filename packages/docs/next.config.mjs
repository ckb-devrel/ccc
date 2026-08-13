import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  experimental: {
    // Work around Next.js 16.3's incompatibility with TypeScript 7's dual-version aliases.
    // https://github.com/vercel/next.js/issues/96589
    useTypeScriptCli: false,
  },
  async rewrites() {
    return [
      // Constrain :lang to a single dot-free segment so these rewrites match
      // locale codes (en, zh, zh-CN, ...) but not /llms.mdx/docs/* URLs.
      // No need to sync with the language list in lib/i18n.ts.
      {
        source: '/:lang([^/.]+)/docs/:path*.mdx',
        destination: '/:lang/mdx/:path*',
      },
      {
        source: '/:lang([^/.]+)/docs/:path*.md',
        destination: '/:lang/mdx/:path*',
      },
    ];
  },
};

export default withMDX(config);
