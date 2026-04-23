import type { FiberClient } from "../rpc.js";
import * as fiber from "../types/index.js";
import type { Constructor } from "../utils.js";

export function PeerMixin<
  TBase extends Constructor<{ readonly rpc: FiberClient }>,
>(Base: TBase) {
  return class PeerMixin extends Base {
    declare readonly rpc: FiberClient;

    async connectPeer(params: fiber.ConnectPeerParamsLike): Promise<void> {
      const normalized = fiber.ConnectPeerParams.from(params);
      await this.rpc.call("connect_peer", [{ ...normalized }]);
    }

    async disconnectPeer(
      params: fiber.DisconnectPeerParamsLike,
    ): Promise<void> {
      const normalized = fiber.DisconnectPeerParams.from(params);
      await this.rpc.call("disconnect_peer", [{ ...normalized }]);
    }

    async listPeers(): Promise<fiber.PeerInfo[]> {
      const res = await this.rpc.call<fiber.ListPeerResult>("list_peers", []);
      return res.peers;
    }
  };
}

class FiberClientBase {
  constructor(public readonly rpc: FiberClient) {}
}

export class PeerApi extends PeerMixin(FiberClientBase) {}
