import { FiberClient } from "../rpc/client.js";

/** Peer info from list_peers (address is the one used for connecting). */
export interface PeerInfo {
  pubkey: string;
  peerId: string;
  address: string;
}

/** RPC response for list_peers. */
interface ListPeersResult {
  peers: PeerInfo[];
}

export class PeerApi {
  constructor(private readonly rpc: FiberClient) {}

  async connectPeer(address: string, save?: boolean): Promise<void> {
    await this.rpc.callCamel("connect_peer", [{ address, save }]);
  }

  async disconnectPeer(peerId: string): Promise<void> {
    await this.rpc.callCamel("disconnect_peer", [{ peerId }]);
  }

  async listPeers(): Promise<PeerInfo[]> {
    const res = await this.rpc.callCamel<ListPeersResult>("list_peers", []);
    return res.peers;
  }
}
