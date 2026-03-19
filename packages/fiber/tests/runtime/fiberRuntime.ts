import type { Server } from "node:http";
import {
  type FiberNodeOptions,
  type StorageMode,
  resolveFiberConfig,
} from "./config.js";
import { fiberKeyPairToBase58PeerId, hexPeerIdToBase58 } from "./peerId.js";
import { installNodePolyfills } from "./polyfill.js";
import {
  type FiberLike,
  closeRpcServer,
  createRpcServer,
  listenRpcServer,
} from "./rpcBridge.js";

export type { FiberNodeOptions, StorageMode } from "./config.js";

export interface FiberRuntimeOptions {
  /**
   * Fiber node configuration:
   * - Pass a FiberNodeOptions object to generate config inline.
   * - Pass a file path string to load a YAML config from disk.
   */
  config: FiberNodeOptions | string;

  /** Storage backend for fiber-wasm IndexedDB. Default: { type: "memory" }. */
  storage?: StorageMode;

  /**
   * 32-byte secp256k1 private key for the fiber P2P identity.
   * Generated randomly if omitted (ephemeral — use for tests).
   */
  fiberKeyPair?: Uint8Array;

  /**
   * 32-byte secp256k1 private key for CKB transaction signing.
   * Generated randomly if omitted.
   */
  ckbSecretKey?: Uint8Array;

  /** Custom chain spec string (for chains other than testnet/mainnet). */
  chainSpec?: string;

  /** fiber-wasm log level. Default: "info". */
  logLevel?: "trace" | "debug" | "info" | "error";

  /** HTTP JSON-RPC server host. Default: "127.0.0.1". */
  rpcHost?: string;

  /**
   * HTTP JSON-RPC server preferred port. Retries up to 10 ports on EADDRINUSE.
   * Default: 18227.
   */
  rpcPort?: number;

  /** Add CORS headers to RPC responses. Default: false. */
  cors?: boolean;

  /** Log RPC requests/responses to stdout. Default: false. */
  verbose?: boolean;
}

/** Information about a running fiber node. */
export interface FiberRuntimeInfo {
  /** Full HTTP JSON-RPC endpoint URL, e.g. "http://127.0.0.1:18227". */
  rpcUrl: string;
  /** Actual port the RPC server bound to (may differ from rpcPort on retry). */
  rpcPort: number;
  /** Raw node_id hex from node_info (may be the CKB key, not the P2P key). */
  nodeId: string;
  /**
   * Base58 PeerId derived from fiberKeyPair using the tentacle/secio scheme.
   * This is the identity used for P2P connections — use it in multiaddrs:
   *   /ip4/127.0.0.1/tcp/<fiberPort>/p2p/<p2pPeerId>
   */
  p2pPeerId: string;
  /** Multiaddrs returned by node_info, or a constructed fallback. */
  addresses: string[];
}

/**
 * Manages the lifecycle of a single in-process fiber node (fiber-js WASM)
 * and its HTTP JSON-RPC bridge.
 *
 * Usage:
 *   const runtime = new FiberRuntime();
 *   const info = await runtime.start({ config: { fiberPort: 8228 } });
 *   // ... run tests or serve traffic ...
 *   await runtime.stop();
 */
export class FiberRuntime {
  private fiber: FiberLike | null = null;
  private server: Server | null = null;
  private _info: FiberRuntimeInfo | null = null;

  /** Start the fiber node and HTTP RPC bridge. Throws if already started. */
  async start(options: FiberRuntimeOptions): Promise<FiberRuntimeInfo> {
    if (this.fiber) throw new Error("FiberRuntime is already running");

    const {
      config,
      storage = { type: "memory" },
      chainSpec,
      logLevel = "info",
      rpcHost = "127.0.0.1",
      rpcPort: preferredRpcPort = 18227,
      cors = false,
      verbose = false,
    } = options;

    // 1. Install Node.js polyfills (idempotent — first call wins for storage mode)
    installNodePolyfills(storage);

    // 2. Resolve config → YAML string + databasePrefix
    const { yaml, databasePrefix } = resolveFiberConfig(config);

    // 3. Resolve key pairs
    const { Fiber, randomSecretKey } = await import("@nervosnetwork/fiber-js");
    const fiberKeyPair = options.fiberKeyPair ?? randomSecretKey();
    const ckbSecretKey = options.ckbSecretKey ?? randomSecretKey();

    // 4. Start the fiber WASM node
    const fiber = new Fiber();
    await fiber
      .start(
        yaml,
        fiberKeyPair,
        ckbSecretKey,
        chainSpec,
        logLevel,
        databasePrefix,
      )
      .catch((err: unknown) => {
        throw new Error(
          `FiberRuntime: fiber node failed to start — ${String(err)}`,
        );
      });

    // 5. Warm up: wait for the fiber state machine to be ready
    await fiber.invokeCommand("list_channels", [{}]);

    // 6. Start HTTP JSON-RPC bridge
    const server = createRpcServer(fiber as FiberLike, { cors, verbose });
    const actualPort = await listenRpcServer(server, preferredRpcPort, rpcHost);
    if (actualPort !== preferredRpcPort) {
      console.warn(
        `[FiberRuntime] Port ${preferredRpcPort} in use; RPC bound to ${actualPort}`,
      );
    }

    // 7. Query node info and build runtime info
    const rpcUrl = `http://${rpcHost}:${actualPort}`;
    const rawInfo = (await fiber.nodeInfo()) as {
      node_id?: string;
      addresses?: string[];
    };
    const nodeId = rawInfo.node_id ?? "";
    const p2pPeerId =
      fiberKeyPair.length === 32
        ? fiberKeyPairToBase58PeerId(fiberKeyPair)
        : hexPeerIdToBase58(nodeId);

    let addresses: string[] = Array.isArray(rawInfo.addresses)
      ? rawInfo.addresses
      : [];
    // Build fallback multiaddr when node_info returns no addresses
    if (addresses.length === 0 && p2pPeerId) {
      const fiberPort =
        typeof config === "object" ? (config.fiberPort ?? 8228) : 8228;
      addresses = [`/ip4/127.0.0.1/tcp/${fiberPort}/p2p/${p2pPeerId}`];
    }

    this.fiber = fiber as FiberLike;
    this.server = server;
    this._info = { rpcUrl, rpcPort: actualPort, nodeId, p2pPeerId, addresses };
    return this._info;
  }

  /** Stop the RPC bridge and fiber node. Safe to call multiple times. */
  async stop(): Promise<void> {
    await closeRpcServer(this.server);
    this.server = null;
    if (this.fiber) {
      try {
        await this.fiber.stop();
      } catch {
        // ignore stop errors — node may already be shutting down
      }
      this.fiber = null;
    }
    this._info = null;
  }

  /** Runtime info. Throws if the node has not been started. */
  get info(): FiberRuntimeInfo {
    if (!this._info) throw new Error("FiberRuntime has not been started");
    return this._info;
  }

  /** Direct proxy to fiber.invokeCommand() for raw RPC access. */
  async invokeCommand(method: string, params?: unknown[]): Promise<unknown> {
    if (!this.fiber) throw new Error("FiberRuntime has not been started");
    return this.fiber.invokeCommand(method, params);
  }
}
