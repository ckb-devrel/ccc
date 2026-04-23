// ─── ConnectPeer ───────────────────────────────────────────────────────────

export type TransportType = "tcp" | "ws" | "wss";

export type ConnectPeerParamsLike = {
  address?: string;
  pubkey?: string;
  save?: boolean;
  addrType?: TransportType;
};

export class ConnectPeerParams {
  constructor(
    public readonly address?: string,
    public readonly pubkey?: string,
    public readonly save?: boolean,
    public readonly addrType?: TransportType,
  ) {}

  static from(like: ConnectPeerParamsLike): ConnectPeerParams {
    return new ConnectPeerParams(
      like.address,
      like.pubkey,
      like.save,
      like.addrType,
    );
  }
}

// ─── DisconnectPeer ────────────────────────────────────────────────────────

export type DisconnectPeerParamsLike = {
  pubkey: string;
};

export class DisconnectPeerParams {
  constructor(public readonly pubkey: string) {}

  static from(like: DisconnectPeerParamsLike): DisconnectPeerParams {
    return new DisconnectPeerParams(like.pubkey);
  }
}

// ─── ListPeers (result types) ───────────────────────────────────────────────

export type PeerInfo = {
  pubkey: string;
  address: string;
};

export type ListPeerResult = {
  peers: PeerInfo[];
};
