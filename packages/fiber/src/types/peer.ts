/**
 * Peer RPC types (camelCase). Aligned with @nervosnetwork/fiber-js peer types
 * (https://github.com/nervosnetwork/fiber/blob/develop/fiber-js/src/types/peer.ts).
 * Params are standalone classes with static from(like) for CCC-style flexible inputs.
 */

// ─── ConnectPeer ───────────────────────────────────────────────────────────

export type ConnectPeerParamsLike = {
  address: string;
  save?: boolean;
};

export class ConnectPeerParams {
  constructor(
    public readonly address: string,
    public readonly save?: boolean,
  ) {}

  static from(like: ConnectPeerParamsLike): ConnectPeerParams {
    return new ConnectPeerParams(like.address, like.save);
  }
}

// ─── DisconnectPeer ────────────────────────────────────────────────────────

export type DisconnectPeerParamsLike = {
  peerId: string;
};

export class DisconnectPeerParams {
  constructor(public readonly peerId: string) {}

  static from(like: DisconnectPeerParamsLike): DisconnectPeerParams {
    return new DisconnectPeerParams(like.peerId);
  }
}

// ─── ListPeers (result types) ───────────────────────────────────────────────

export type PeerInfo = {
  pubkey: string;
  peerId: string;
  address: string;
};

export type ListPeerResult = {
  peers: PeerInfo[];
};
