import { FiberClient } from "../client.js";
import { ChannelInfo, NodeInfo } from "../types.js";

export interface GraphNodesResult {
  nodes: NodeInfo[];
  last_cursor: string;
}

export interface GraphChannelsResult {
  channels: ChannelInfo[];
  last_cursor: string;
}

export class GraphModule {
  constructor(private client: FiberClient) {}

  /**
   * Get the list of nodes in the network graph (with pagination).
   */
  async graphNodes(params?: {
    limit?: number;
    after?: string;
  }): Promise<GraphNodesResult> {
    return this.client.call<GraphNodesResult>("graph_nodes", [
      params ?? {},
    ]);
  }

  /**
   * Get the list of channels in the network graph (with pagination).
   */
  async graphChannels(params?: {
    limit?: number;
    after?: string;
  }): Promise<GraphChannelsResult> {
    return this.client.call<GraphChannelsResult>("graph_channels", [
      params ?? {},
    ]);
  }
}
