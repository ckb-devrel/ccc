import { FiberClient } from "../client.js";
import { ChannelInfo, Pubkey } from "../types.js";

export class GraphModule {
  constructor(private client: FiberClient) {}

  /**
   * Get node list
   */
  async graphNodes(): Promise<Pubkey[]> {
    return this.client.call("graph_nodes", []);
  }

  /**
   * Get channel list
   */
  async graphChannels(): Promise<ChannelInfo[]> {
    return this.client.call("graph_channels", []);
  }
}
