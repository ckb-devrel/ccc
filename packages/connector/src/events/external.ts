import { ccc } from "@ckb-ccc/ccc";

export class ConnectorWillUpdateEvent extends Event {
  static readonly eventName = "willUpdate";

  constructor() {
    super(ConnectorWillUpdateEvent.eventName);
  }
}

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

export interface ConnectorEventMap {
  [ConnectorWillUpdateEvent.eventName]: ConnectorWillUpdateEvent;
  [ConnectorCloseEvent.eventName]: ConnectorCloseEvent;
  [SelectClientEvent.eventName]: SelectClientEvent;
}
