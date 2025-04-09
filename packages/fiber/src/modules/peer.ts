import { FiberClient } from "../client";

export class PeerModule {
  constructor(private client: FiberClient) {}

  /**
   * Connect to a peer node
   * @param address Node address
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
}
