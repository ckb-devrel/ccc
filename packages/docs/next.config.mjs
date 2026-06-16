import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
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
