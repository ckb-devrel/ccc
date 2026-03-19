import { FiberClient } from "../rpc.js";
import type * as fiber from "../types/index.js";

export class InfoApi {
  constructor(private readonly rpc: FiberClient) {}

  async getNodeInfo(): Promise<fiber.NodeInfo> {
    return this.rpc.call<fiber.NodeInfo>("node_info", []);
  }
}
