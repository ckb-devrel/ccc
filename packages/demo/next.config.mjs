/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["@ckb-ccc/core", "@ckb-ccc/core/bundle"],
  },
  async rewrites() {
    return [
      {
        source: '/api/fiber/:path*',
        destination: 'http://127.0.0.1:8227/:path*',
      },
    ];
  },
};

export default nextConfig;
