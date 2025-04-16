import { FiberClient } from "../client.js";

export interface PeerInfo {
  pubkey: string;
  peer_id: string;
  addresses: string[];
}

export class PeerModule {
  constructor(private client: FiberClient) {}

  /**
   * Connect to a peer node
   * @param address Full peer address including peer ID (e.g. "/ip4/127.0.0.1/tcp/8119/p2p/Qm...")
   */
  async connectPeer(address: string): Promise<void> {
    return this.client.call("connect_peer", [{ address }]);
  }

  /**
   * Disconnect from a peer node
   */
  async disconnectPeer(peer_id: string): Promise<void> {
    return this.client.call("disconnect_peer", [{ peer_id }]);
  }

  /**
   * List all connected peers
   * @returns Array of peer information
   */
  async listPeers(): Promise<PeerInfo[]> {
    return this.client.call("list_peers", []);
  }
}
