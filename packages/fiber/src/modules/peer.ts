import { FiberClient } from "../client";

export class PeerModule {
  constructor(private client: FiberClient) {}

  /**
   * 连接对等节点
   * @param address 节点地址
   */
  async connectPeer(address: string): Promise<void> {
    return this.client.call("connect_peer", [address]);
  }

  /**
   * 断开对等节点连接
   */
  async disconnectPeer(peer_id: string): Promise<void> {
    return this.client.call("disconnect_peer", [peer_id]);
  }
}
