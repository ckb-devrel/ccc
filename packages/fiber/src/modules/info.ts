import { FiberClient } from "../client";
import { NodeInfo } from "../types";

export class InfoModule {
  constructor(private client: FiberClient) {}

  /**
   * 获取节点信息
   * @returns 返回节点的详细信息，包括节点名称、地址、ID等
   * @throws {Error} 当无法获取节点信息时抛出错误
   */
  async nodeInfo(): Promise<NodeInfo> {
    return this.client.call("node_info", []);
  }
}
