import { FiberClient } from "../client.js";
import { NodeInfo } from "../types.js";

export class InfoModule {
  constructor(private client: FiberClient) {}

  /**
   * Get node information
   * @returns Returns detailed node information, including node name, address, ID, etc.
   * @throws {Error} Throws error when unable to get node information
   */
  async nodeInfo(): Promise<NodeInfo> {
    return this.client.call("node_info", []);
  }
}
