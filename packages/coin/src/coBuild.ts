import { ccc, mol } from "@ckb-ccc/core";

const MintActionCodec = mol.table({
  amount: mol.Uint128,
  to: ccc.ScriptOpt,
});

export type MintActionLike = ccc.EncodableType<typeof MintActionCodec>;

@ccc.codec(MintActionCodec)
export class MintAction extends ccc.Entity.Base<MintActionLike, MintAction>() {
  public amount: ccc.Num;
  public to?: ccc.Script;

  constructor({ amount, to }: ccc.DecodedType<typeof MintActionCodec>) {
    super();

    this.amount = amount;
    this.to = to;
  }
}

const BurnActionCodec = mol.table({
  amount: mol.Uint128,
});

export type BurnActionLike = ccc.EncodableType<typeof BurnActionCodec>;

@ccc.codec(BurnActionCodec)
export class BurnAction extends ccc.Entity.Base<BurnActionLike, BurnAction>() {
  public amount: ccc.Num;

  constructor({ amount }: ccc.DecodedType<typeof BurnActionCodec>) {
    super();

    this.amount = amount;
  }
}

const TransferActionCodec = mol.table({
  amount: mol.Uint128,
  to: ccc.ScriptOpt,
});

export type TransferActionLike = ccc.EncodableType<typeof TransferActionCodec>;

@ccc.codec(TransferActionCodec)
export class TransferAction extends ccc.Entity.Base<
  TransferActionLike,
  TransferAction
>() {
  public amount: ccc.Num;
  public to?: ccc.Script;

  constructor({ amount, to }: ccc.DecodedType<typeof TransferActionCodec>) {
    super();

    this.amount = amount;
    this.to = to;
  }
}

const CoinActionCodec = mol.union({
  Mint: MintAction,
  Burn: BurnAction,
  Transfer: TransferAction,
});

export type CoinActionLike = ccc.EncodableType<typeof CoinActionCodec>;

@ccc.codec(CoinActionCodec)
export class CoinAction extends ccc.Entity.BaseUnion<
  typeof CoinActionCodec,
  CoinActionLike,
  CoinAction
>() {}
