/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["@ckb-ccc/core", "@ckb-ccc/core/bundle"],
  },
  // SharedArrayBuffer (@nervosnetwork/fiber-js WASM) requires a cross-origin
  // isolated document: Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy.
  //
  // COOP: same-origin breaks window.opener for cross-origin wallet popups,
  // so it is scoped to /connected/Fiber only; signing flows use a dedicated
  // same-origin route without these headers where needed (e.g. sign proxy).
  //
  // COEP credentialless isolates without requiring CORP on every subresource
  // (unlike require-corp), which suits the demo shell + CDN assets.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
