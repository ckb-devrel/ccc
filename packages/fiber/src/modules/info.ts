import { FiberClient } from "../client";
import { NetworkInfo, NodeInfo, NodeStatus, NodeVersion } from "../types";

export class InfoModule {
  constructor(private client: FiberClient) {}

  /**
   * 获取节点信息
   */
  async nodeInfo(): Promise<NodeInfo> {
    return this.client.call("node_info", []);
  }

  /**
   * 获取节点状态信息
   */
  async nodeStatus(): Promise<NodeStatus> {
    return this.client.call("node_status", []);
  }

  /**
   * 获取节点版本信息
   */
  async nodeVersion(): Promise<NodeVersion> {
    return this.client.call("node_version", []);
  }

  /**
   * 获取网络信息
   */
  async networkInfo(): Promise<NetworkInfo> {
    return this.client.call("network_info", []);
  }
}
