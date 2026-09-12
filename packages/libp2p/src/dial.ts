import type { Libp2p, PeerId } from "@libp2p/interface";
import type { Multiaddr } from "@multiformats/multiaddr";

export async function dialKnownAddresses(
  node: Libp2p,
  peerId: PeerId,
  signal?: AbortSignal,
) {
  const peer = await node.peerStore.get(peerId);
  // PeerStore may omit the target peer id. Restore it so libp2p can
  // attempt a direct upgrade without force-dialing.
  const addresses = peer.addresses.flatMap(({ multiaddr }) => {
    const address = addressForPeer(multiaddr, peerId);
    return address ? [address] : [];
  });
  if (addresses.length === 0) {
    return;
  }

  return signal ? node.dial(addresses, { signal }) : node.dial(addresses);
}

function addressForPeer(address: Multiaddr, peerId: PeerId) {
  const last = address.getComponents().at(-1);
  if (last?.name !== "p2p") {
    return address.encapsulate(`/p2p/${peerId.toString()}`);
  }
  return last.value === peerId.toString() ? address : undefined;
}
