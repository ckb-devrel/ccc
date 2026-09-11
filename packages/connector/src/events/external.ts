import { ccc } from "@ckb-ccc/ccc";

export class ConnectorCloseEvent extends Event {
  static readonly eventName = "close";

  constructor() {
    super(ConnectorCloseEvent.eventName, { bubbles: true, composed: true });
  }
}

export class SelectClientEvent extends Event {
  static readonly eventName = "select-client";

  constructor(public readonly client: ccc.Client) {
    super(SelectClientEvent.eventName, { bubbles: true, composed: true });
  }
}

export type ConnectorConnection = {
  wallet: ccc.Wallet;
  signerInfo: ccc.SignerInfo;
};

export class ConnectorConnectionEvent extends Event {
  static readonly eventName = "connection";

  constructor(
    public readonly connectionOwner?: ccc.Owner<ConnectorConnection>,
  ) {
    super(ConnectorConnectionEvent.eventName, {
      bubbles: true,
      composed: true,
    });
  }
}

export interface ConnectorEventMap {
  [ConnectorCloseEvent.eventName]: ConnectorCloseEvent;
  [SelectClientEvent.eventName]: SelectClientEvent;
  [ConnectorConnectionEvent.eventName]: ConnectorConnectionEvent;
}
