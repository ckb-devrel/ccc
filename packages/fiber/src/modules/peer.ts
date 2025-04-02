import { FiberClient } from "../client";

export class PeerModule {
  constructor(private client: FiberClient) {}

  /**
   * 连接节点
   */
  async connectPeer(params: {
    address: string;
    save?: boolean;
  }): Promise<void> {
    return this.client.call("connect_peer", [params.address]);
  }

  /**
   * 断开节点连接
   */
  async disconnectPeer(peer_id: string): Promise<void> {
    return this.client.call("disconnect_peer", [peer_id]);
  }
}
