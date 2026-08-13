/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Work around Next.js 16.3's incompatibility with TypeScript 7's dual-version aliases.
    // https://github.com/vercel/next.js/issues/96589
    useTypeScriptCli: false,
  },
  turbopack: {
    rules: {
      "*.d.ts": {
        loaders: ["raw-loader"],
        as: "*.mjs",
      },
      "*.d.mts": {
        loaders: ["raw-loader"],
        as: "*.mjs",
      },
    },
  },
};

export default nextConfig;
