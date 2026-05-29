import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/:lang/docs/:path*.mdx',
        destination: '/:lang/mdx/:path*',
      },
      {
        source: '/:lang/docs/:path*.md',
        destination: '/:lang/mdx/:path*',
      },
    ];
  },
};

export default withMDX(config);
