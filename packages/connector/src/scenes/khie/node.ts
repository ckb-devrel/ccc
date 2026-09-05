import { ccc } from "@ckb-ccc/ccc";
import { Libp2p } from "@ckb-ccc/libp2p";
import { ensurePromiseWithResolvers } from "./promiseWithResolvers.js";

export const JSON_RPC_PROTOCOL = "/nervos-ckb/khie/json-rpc/0.0.1";
export const DEFAULT_RELAY_ADDRESS = "/dns4/relay.ckbccc.com/tcp/443/wss";
export const SIGNER_ENDPOINT_URL = "https://app.ckbccc.com/#khie";

const PAIRING_PROTOCOL = "/nervos-ckb/khie/pairing/0.0.1";
const PAIRED_PEER_TIMEOUT_MS = 30 * 60 * 1000;

async function createNode(canPair: Libp2p.PairingGuard, signal: AbortSignal) {
  signal.throwIfAborted();
  await ensurePromiseWithResolvers();
  signal.throwIfAborted();

  const [
    { noise },
    { yamux },
    { circuitRelayTransport },
    { identify },
    { webRTC },
    { webSockets },
    { createLibp2p },
  ] = await Promise.all([
    import("@chainsafe/libp2p-noise"),
    import("@chainsafe/libp2p-yamux"),
    import("@libp2p/circuit-relay-v2"),
    import("@libp2p/identify"),
    import("@libp2p/webrtc"),
    import("@libp2p/websockets"),
    import("libp2p"),
  ]);

  signal.throwIfAborted();
  return createLibp2p({
    addresses: {
      listen: ["/p2p-circuit", "/webrtc"],
    },
    transports: [webSockets(), webRTC(), circuitRelayTransport()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      pairing: Libp2p.pairingService(
        {
          protocol: PAIRING_PROTOCOL,
          pairedPeerTimeoutMs: PAIRED_PEER_TIMEOUT_MS,
        },
        canPair,
      ),
    },
  });
}

export type KhieNode = Awaited<ReturnType<typeof createNode>>;

export async function createKhieNode(
  canPair: Libp2p.PairingGuard,
  signal: AbortSignal,
) {
  let node: KhieNode | undefined;
  try {
    node = await createNode(canPair, signal);
    signal.throwIfAborted();
    return new ccc.OwnerUnique(node, (node) => node.stop());
  } catch (cause) {
    await node?.stop();
    throw cause;
  }
}
