import { FiberClient } from "../core/client";

export class PeerModule {
  constructor(private client: FiberClient) {}

  /**
   * 连接到对等节点
   */
  async connectPeer(params: {
    address: string;
    save?: boolean;
  }): Promise<void> {
    return this.client.call("connect_peer", params);
  }

  /**
   * 断开对等节点连接
   */
  async disconnectPeer(peerId: string): Promise<void> {
    return this.client.call("disconnect_peer", [peerId]);
  }
}
