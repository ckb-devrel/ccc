import { FiberClient } from "../rpc/client.js";
import type { ChannelInfo, NodeInfo } from "../types.js";

export interface GraphNodesResult {
  nodes: NodeInfo[];
  lastCursor: string;
}

export interface GraphChannelsResult {
  channels: ChannelInfo[];
  lastCursor: string;
}

export class GraphApi {
  constructor(private readonly rpc: FiberClient) {}

  async graphNodes(params?: {
    limit?: number;
    after?: string;
  }): Promise<GraphNodesResult> {
    return this.rpc.callCamel<GraphNodesResult>("graph_nodes", [params ?? {}]);
  }

  async graphChannels(params?: {
    limit?: number;
    after?: string;
  }): Promise<GraphChannelsResult> {
    return this.rpc.callCamel<GraphChannelsResult>("graph_channels", [
      params ?? {},
    ]);
  }
}
