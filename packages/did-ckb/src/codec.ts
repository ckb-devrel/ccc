import { ccc } from "@ckb-ccc/core";
import { decode as cborDecode, encode as cborEncode } from "@ipld/dag-cbor";

export type DidCkbDataV1Like = {
  document: unknown;
  localId?: string | null;
};
@ccc.codec(
  ccc.mol
    .table({
      document: ccc.mol.Bytes,
      localId: ccc.mol.StringOpt,
    })
    .map({
      inMap: (data: DidCkbDataV1Like) => ({
        ...data,
        document: ccc.hexFrom(cborEncode(data.document)),
      }),
      outMap: (data) => ({
        ...data,
        document: cborDecode(ccc.bytesFrom(data.document)),
      }),
    }),
)
export class DidCkbDataV1 extends ccc.Entity.Base<
  DidCkbDataV1Like,
  DidCkbDataV1
>() {
  constructor(
    public document: unknown,
    public localId?: string,
  ) {
    super();
  }

  static from(data: DidCkbDataV1Like): DidCkbDataV1 {
    if (data instanceof DidCkbDataV1) {
      return data;
    }

    return new DidCkbDataV1(data.document, data.localId ?? undefined);
  }
}

export type DidCkbDataLike = {
  type?: "v1" | null;
  value: DidCkbDataV1Like;
};
@ccc.codec(
  ccc.mol.union({
    v1: DidCkbDataV1,
  }),
)
export class DidCkbData extends ccc.Entity.Base<DidCkbDataLike, DidCkbData>() {
  constructor(
    public type: "v1",
    public value: DidCkbDataV1,
  ) {
    super();
  }

  static from(data: DidCkbDataLike): DidCkbData {
    if (data instanceof DidCkbData) {
      return data;
    }
    return new DidCkbData(data.type ?? "v1", DidCkbDataV1.from(data.value));
  }

  static fromV1(
    data: DidCkbDataV1Like,
  ): DidCkbData & { type: "v1"; value: DidCkbDataV1 } {
    return new DidCkbData("v1", DidCkbDataV1.from(data));
  }
}

export type PlcAuthorizationLike = {
  history: object[];
  sig: ccc.HexLike;
  rotationKeyIndices: ccc.NumLike[];
};
@ccc.codec(
  ccc.mol
    .table({
      history: ccc.mol.BytesVec,
      sig: ccc.mol.Bytes,
      rotationKeyIndices: ccc.mol.Uint8Vec,
    })

    .map({
      inMap: (data: PlcAuthorizationLike) => ({
        ...data,
        history: data.history.map((h) => ccc.hexFrom(cborEncode(h))),
      }),
      outMap: (data) => ({
        ...data,
        history: data.history.map((h) => cborDecode<object>(ccc.bytesFrom(h))),
      }),
    }),
)
export class PlcAuthorization extends ccc.Entity.Base<
  PlcAuthorizationLike,
  PlcAuthorization
>() {
  constructor(
    public history: object[],
    public sig: ccc.Hex,
    public rotationKeyIndices: ccc.Num[],
  ) {
    super();
  }

  static from(data: PlcAuthorizationLike): PlcAuthorization {
    if (data instanceof PlcAuthorization) {
      return data;
    }
    return new PlcAuthorization(
      data.history,
      ccc.hexFrom(data.sig),
      data.rotationKeyIndices.map(ccc.numFrom),
    );
  }
}

export type DidCkbWitnessLike = {
  localIdAuthorization: PlcAuthorizationLike;
};
@ccc.codec(
  ccc.mol.table({
    localIdAuthorization: PlcAuthorization,
  }),
)
export class DidCkbWitness extends ccc.Entity.Base<
  DidCkbWitnessLike,
  DidCkbWitness
>() {
  constructor(public localIdAuthorization: PlcAuthorization) {
    super();
  }

  static from(data: DidCkbWitnessLike): DidCkbWitness {
    if (data instanceof DidCkbWitness) {
      return data;
    }
    return new DidCkbWitness(PlcAuthorization.from(data.localIdAuthorization));
  }
}
