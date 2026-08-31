/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.*.*", "*.trycloudflare.com"],
  experimental: {
    // Work around Next.js 16.3's incompatibility with TypeScript 7's dual-version aliases.
    // https://github.com/vercel/next.js/issues/96589
    useTypeScriptCli: false,
    optimizePackageImports: [
      "@ckb-ccc/core",
      "@ckb-ccc/core/bundle",
      "lucide-react",
    ],
  },
};

export default nextConfig;
