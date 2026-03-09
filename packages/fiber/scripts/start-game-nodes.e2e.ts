/**
 * Starts two Fiber nodes (fiber-js), writes game config, then runs the
 * space-invader dev server. Run with: pnpm run space-invader:dev:with-nodes
 * Exit with Ctrl+C to stop nodes and server.
 *
 * For real CKB channel funding, set pre-funded testnet keys (32-byte hex):
 *   FIBER_CKB_SECRET_KEY_A  - CKB secret for node A (boss), fund with ≥500 CKB
 *   FIBER_CKB_SECRET_KEY_B  - CKB secret for node B (player), fund with ≥500 CKB
 * Optional P2P identity keys (default: random):
 *   FIBER_FIBER_KEY_A, FIBER_FIBER_KEY_B
 */
import { Fiber, randomSecretKey } from "@nervosnetwork/fiber-js";
import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, it } from "vitest";

/** Load optional 32-byte secret key from env (hex, with or without 0x). */
function secretKeyFromEnv(envVar: string): Uint8Array | null {
  const raw = process.env[envVar]?.trim().replace(/^0x/i, "");
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) return null;
  return new Uint8Array(Buffer.from(raw, "hex"));
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIBER_PKG = join(__dirname, "..");
const GAME_PUBLIC = join(FIBER_PKG, "examples", "space-invader", "public");
const CONFIG_PATH = join(GAME_PUBLIC, "fiber.config.generated.json");

const NODE_A_RPC = 8227;
const NODE_A_FIBER = 8228;
const NODE_B_RPC = 8237;
const NODE_B_FIBER = 8238;

type FiberLike = {
  invokeCommand(name: string, args?: unknown[]): Promise<unknown>;
  start(
    config: string,
    fiberKeyPair: Uint8Array,
    ckbSecretKey: Uint8Array,
    chainSpec?: string,
    logLevel?: string,
    databasePrefix?: string,
  ): Promise<void>;
  stop(): Promise<void>;
};

type NodeConfig = {
  fiberPort: number;
  rpcPort: number;
  databasePrefix: string;
  bootnodeAddrs?: string[];
};

function fiberConfigYaml(c: NodeConfig): string {
  const bootnodeYaml =
    (c.bootnodeAddrs?.length ?? 0) === 0
      ? "  bootnode_addrs: []"
      : `  bootnode_addrs:\n${c.bootnodeAddrs!.map((a) => `    - "${a}"`).join("\n")}`;
  return `
fiber:
  listening_addr: "/ip4/127.0.0.1/tcp/${c.fiberPort}"
${bootnodeYaml}
  announce_listening_addr: false
  announced_addrs: []
  chain: testnet
  scripts: []
rpc:
  listening_addr: "127.0.0.1:${c.rpcPort}"
ckb:
  rpc_url: "https://testnet.ckbapp.dev/"
  udt_whitelist: []
services:
  - fiber
  - rpc
  - ckb
`.trim();
}

function createRpcServer(fiber: FiberLike): Server {
  return createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/") {
      res.writeHead(404);
      res.end();
      return;
    }
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      void (async () => {
        let id: number | undefined;
        try {
          const payload = JSON.parse(body) as {
            method: string;
            params?: unknown[];
            id: number;
          };
          const { method, params = [], id: payloadId } = payload;
          id = payloadId;
          res.setHeader("Content-Type", "application/json");
          const result = await fiber.invokeCommand(method, params);
          res.end(JSON.stringify({ jsonrpc: "2.0", result, id }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32603, message },
              id: id ?? 0,
            }),
          );
        }
      })();
    });
  });
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });
}

async function rpcCall(
  baseUrl: string,
  method: string,
  params: unknown[] = [],
): Promise<unknown> {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const data = (await res.json()) as { error?: { message?: string }; result?: unknown };
  if (data.error)
    throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data.result;
}

async function getNodeInfo(
  baseUrl: string,
  fiberPort?: number,
): Promise<{ nodeId: string; addresses: string[] }> {
  const obj = (await rpcCall(baseUrl, "node_info", []).catch(() => null)) as
    | Record<string, unknown>
    | null;
  const rawId = obj?.node_id ?? obj?.nodeId;
  const nodeId = typeof rawId === "string" ? rawId : "";
  let addresses: string[] =
    obj && Array.isArray(obj.addresses) ? (obj.addresses as string[]) : [];
  if (addresses.length === 0 && nodeId && fiberPort != null) {
    addresses = [`/ip4/127.0.0.1/tcp/${fiberPort}/p2p/${nodeId}`];
  }
  return { nodeId, addresses };
}

async function startOneNode(
  config: NodeConfig,
  rpcPort: number,
  keys?: {
    fiberKeyPair?: Uint8Array;
    ckbSecretKey?: Uint8Array;
  },
): Promise<{
  fiber: FiberLike;
  server: Server;
  url: string;
  nodeInfo: { nodeId: string; addresses: string[] };
}> {
  const fiberKeyPair = keys?.fiberKeyPair ?? randomSecretKey();
  const ckbSecretKey = keys?.ckbSecretKey ?? randomSecretKey();
  const fiber = new Fiber() as FiberLike;
  await fiber.start(
    fiberConfigYaml(config),
    fiberKeyPair,
    ckbSecretKey,
    undefined,
    "info",
    config.databasePrefix,
  );
  await fiber.invokeCommand("list_channels", [{}]);
  const server = createRpcServer(fiber);
  await listen(server, rpcPort);
  const url = `http://127.0.0.1:${rpcPort}`;
  const nodeInfo = await getNodeInfo(url, config.fiberPort);
  return { fiber, server, url, nodeInfo };
}

let fiberA: FiberLike | null = null;
let fiberB: FiberLike | null = null;
let serverA: Server | null = null;
let serverB: Server | null = null;
let devChild: ReturnType<typeof spawn> | null = null;

describe("start-game-nodes launcher", () => {
  beforeAll(async () => {
    const keysA = {
      fiberKeyPair: secretKeyFromEnv("FIBER_FIBER_KEY_A") ?? undefined,
      ckbSecretKey: secretKeyFromEnv("FIBER_CKB_SECRET_KEY_A") ?? undefined,
    };
    const keysB = {
      fiberKeyPair: secretKeyFromEnv("FIBER_FIBER_KEY_B") ?? undefined,
      ckbSecretKey: secretKeyFromEnv("FIBER_CKB_SECRET_KEY_B") ?? undefined,
    };

    console.log("Starting Fiber node A (boss)...");
    const nodeA = await startOneNode(
      {
        fiberPort: NODE_A_FIBER,
        rpcPort: NODE_A_RPC,
        databasePrefix: "/game-node-a",
        bootnodeAddrs: [],
      },
      NODE_A_RPC,
      keysA,
    );
    fiberA = nodeA.fiber;
    serverA = nodeA.server;

    const addrA =
      nodeA.nodeInfo.addresses.find((a) => a.includes("/p2p/Qm")) ??
      nodeA.nodeInfo.addresses[0];
    const bootnodeAddrs =
      addrA && addrA.includes("/p2p/Qm") ? [addrA] : [];

    console.log("Starting Fiber node B (player)...");
    const nodeB = await startOneNode(
      {
        fiberPort: NODE_B_FIBER,
        rpcPort: NODE_B_RPC,
        databasePrefix: "/game-node-b",
        bootnodeAddrs,
      },
      NODE_B_RPC,
      keysB,
    );
    fiberB = nodeB.fiber;
    serverB = nodeB.server;

    const addrB =
      nodeB.nodeInfo.addresses.find((a) => a.includes("/p2p/Qm")) ??
      nodeB.nodeInfo.addresses[0];

    console.log("Connecting node A to node B...");
    await fetch(nodeA.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "connect_peer",
        params: [{ address: addrB }],
        id: 1,
      }),
    }).catch(() => {});

    const gameConfig = {
      boss: {
        url: "/node1-api",
        peerId: nodeA.nodeInfo.nodeId,
        address: addrA ?? "",
      },
      player: {
        url: "/node2-api",
        peerId: nodeB.nodeInfo.nodeId,
        address: addrB ?? "",
      },
    };
    writeFileSync(CONFIG_PATH, JSON.stringify(gameConfig, null, 2));
    console.log("Wrote", CONFIG_PATH);
  }, 60_000);

  afterAll(async () => {
    if (devChild) {
      devChild.kill();
      devChild = null;
    }
    if (serverA) {
      serverA.close();
      serverA = null;
    }
    if (serverB) {
      serverB.close();
      serverB = null;
    }
    if (fiberA) {
      try {
        await fiberA.stop();
      } catch {
        /* ignore */
      }
      fiberA = null;
    }
    if (fiberB) {
      try {
        await fiberB.stop();
      } catch {
        /* ignore */
      }
      fiberB = null;
    }
  });

  it("runs game dev server until exit", async () => {
    await new Promise<void>((resolve, reject) => {
      devChild = spawn("pnpm", ["run", "dev"], {
        cwd: join(FIBER_PKG, "examples", "space-invader"),
        stdio: "inherit",
        shell: true,
      });
      devChild.on("error", reject);
      devChild.on("exit", (code) => {
        devChild = null;
        resolve();
      });
      process.on("SIGINT", () => {
        devChild?.kill();
      });
      process.on("SIGTERM", () => {
        devChild?.kill();
      });
    });
  });
});
