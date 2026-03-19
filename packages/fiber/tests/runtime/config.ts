import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type StorageMode =
  | { type: "memory" }
  | { type: "persistent"; dir: string };

/**
 * Inline options for generating a fiber node YAML config.
 * All fields are optional — reasonable defaults are applied.
 */
export interface FiberNodeOptions {
  /** libp2p P2P listening port. Default: 8228 */
  fiberPort?: number;
  /** fiber-wasm internal RPC port (written into the YAML; separate from the HTTP bridge). Default: 8227 */
  internalRpcPort?: number;
  /** IndexedDB database name prefix — used by the storage backend. Default: "/wasm-fiber" */
  databasePrefix?: string;
  /** Bootnode multiaddrs to connect at startup. Default: [] */
  bootnodeAddrs?: string[];
  /** CKB RPC endpoint. Default: "https://testnet.ckbapp.dev/" */
  ckbRpcUrl?: string;
  /** Fiber chain. Default: "testnet" */
  chain?: string;
}

/** Build the YAML string expected by fiber.start(). */
export function buildFiberConfigYaml(opts: FiberNodeOptions): string {
  const fiberPort = opts.fiberPort ?? 8228;
  const internalRpcPort = opts.internalRpcPort ?? 8227;
  const ckbRpcUrl = opts.ckbRpcUrl ?? "https://testnet.ckbapp.dev/";
  const chain = opts.chain ?? "testnet";
  const bootnodeAddrs = opts.bootnodeAddrs ?? [];

  const bootnodeYaml =
    bootnodeAddrs.length === 0
      ? "  bootnode_addrs: []"
      : `  bootnode_addrs:\n${bootnodeAddrs.map((a) => `    - "${a}"`).join("\n")}`;

  return `fiber:
  listening_addr: "/ip4/127.0.0.1/tcp/${fiberPort}"
${bootnodeYaml}
  announce_listening_addr: false
  announced_addrs: []
  chain: ${chain}
  scripts: []
rpc:
  listening_addr: "127.0.0.1:${internalRpcPort}"
ckb:
  rpc_url: "${ckbRpcUrl}"
  udt_whitelist: []
services:
  - fiber
  - rpc
  - ckb`;
}

/**
 * Load a raw YAML config string from a file path.
 * The string is passed verbatim to fiber.start(); no parsing is done.
 */
export function loadFiberConfigFile(yamlPath: string): string {
  return readFileSync(resolve(yamlPath), "utf8");
}

/** Resolve a FiberNodeOptions or file path to a YAML string for fiber.start(). */
export function resolveFiberConfig(config: FiberNodeOptions | string): {
  yaml: string;
  databasePrefix: string;
} {
  if (typeof config === "string") {
    return { yaml: loadFiberConfigFile(config), databasePrefix: "/wasm-fiber" };
  }
  return {
    yaml: buildFiberConfigYaml(config),
    databasePrefix: config.databasePrefix ?? "/wasm-fiber",
  };
}
