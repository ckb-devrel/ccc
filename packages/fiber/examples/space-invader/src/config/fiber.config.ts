/**
 * Fiber peer configuration for the space-invader game.
 *
 * When using the launcher (pnpm run space-invader:dev:with-nodes), two nodes are
 * started with fresh peer IDs each run. The launcher writes the current run's
 * peerId and address for both nodes to public/fiber.config.generated.json.
 * getFiberConfig() fetches that file at runtime, so the game always uses the
 * correct peer IDs for the nodes that are actually running. The static fiberConfig
 * below is only used as a fallback when the generated file is absent (e.g. you
 * run the game against your own pre-started nodes and set peers here).
 */
export type FiberPeerConfig = {
  /** Fiber node RPC base URL (e.g. "/node1-api" when using Vite proxy). */
  url: string;
  /** P2P peer ID (e.g. libp2p PeerId). */
  peerId: string;
  /** Multiaddr for the peer (e.g. /ip4/127.0.0.1/tcp/8228/p2p/<peerId>). */
  address: string;
};

export type FiberGameConfig = {
  /** Boss node (payer when player hits boss). */
  boss: FiberPeerConfig;
  /** Player node (payer when boss hits player). */
  player: FiberPeerConfig;
};

export const fiberConfig: FiberGameConfig = {
  boss: {
    peerId: "QmdW4WGRUfqQ8hx92Uaufx4n3TXrJUoDP666BQwbqiDrnv",
    address:
      "/ip4/127.0.0.1/tcp/8228/p2p/QmdW4WGRUfqQ8hx92Uaufx4n3TXrJUoDP666BQwbqiDrnv",
    url: "/node1-api",
  },
  player: {
    peerId: "QmcFpUnjRvMyqbFBTn94wwF8LZodvPWpK39Wg9pYr2i4TQ",
    address:
      "/ip4/127.0.0.1/tcp/8238/p2p/QmcFpUnjRvMyqbFBTn94wwF8LZodvPWpK39Wg9pYr2i4TQ",
    url: "/node2-api",
  },
};

/** Load config: use generated config from launcher if present, else default. */
export async function getFiberConfig(): Promise<FiberGameConfig> {
  try {
    const res = await fetch("/fiber.config.generated.json");
    if (res.ok) {
      const data = (await res.json()) as FiberGameConfig;
      if (data?.boss?.peerId && data?.player?.peerId) return data;
    }
  } catch {
    /* ignore */
  }
  return fiberConfig;
}
