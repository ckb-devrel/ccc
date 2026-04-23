import type { FiberClient } from "../rpc.js";
import type * as fiber from "../types/index.js";
import type { Constructor } from "../utils.js";

export function InfoMixin<
  TBase extends Constructor<{ readonly rpc: FiberClient }>,
>(Base: TBase) {
  return class InfoMixin extends Base {
    declare readonly rpc: FiberClient;

    async getNodeInfo(): Promise<fiber.NodeInfo> {
      return this.rpc.call<fiber.NodeInfo>("node_info", []);
    }
  };
}

class FiberClientBase {
  constructor(public readonly rpc: FiberClient) {}
}

export class InfoApi extends InfoMixin(FiberClientBase) {}
