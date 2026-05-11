/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["@ckb-ccc/core", "@ckb-ccc/core/bundle"],
  },
  // SharedArrayBuffer (required by @nervosnetwork/fiber-js WASM) needs
  // Cross-Origin-Opener-Policy: same-origin + COEP on the page.
  //
  // COOP: same-origin severs window.opener in cross-origin wallet popups
  // (JoyID, etc.), so it is applied only to /connected/Fiber where the WASM
  // runs. Wallet signing is delegated to /fiber-sign-proxy (a same-origin
  // popup with no COOP) that relays the signature back via BroadcastChannel.
  async headers() {
    return [
      {
        source: "/connected/Fiber",
        headers: [
          {
            key: "Document-Isolation-Policy",
            value: "isolate-and-credentialless",
          },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
