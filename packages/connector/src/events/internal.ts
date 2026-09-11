import { ccc } from "@ckb-ccc/ccc";

export class FeeRateSelectedEvent extends Event {
  constructor(public readonly feeRate?: ccc.Num) {
    super("fee-rate-selected", { bubbles: true, composed: true });
  }
}

export class ConnectedEvent extends Event {
  constructor(
    public readonly walletName: string,
    public readonly signerName: string,
  ) {
    super("connected");
  }
}

export class CloseRequestEvent extends Event {
  constructor(public readonly callback?: () => void) {
    super("close", { bubbles: true, composed: true });
  }
}
