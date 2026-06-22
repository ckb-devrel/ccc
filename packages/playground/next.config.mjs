/** @type {import('next').NextConfig} */
const nextConfig = {
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
