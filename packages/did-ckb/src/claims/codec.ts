import { ccc } from "@ckb-ccc/core";
import {
  decode as decodeDagCbor,
  encode as encodeDagCbor,
} from "@ipld/dag-cbor";

import type { ClaimDataLike, ClaimDataV1Like } from "./types";

const Byte20 = ccc.Codec.from<ccc.HexLike, ccc.Hex>({
  byteLength: 20,
  encode: ccc.bytesFrom,
  decode: ccc.hexFrom,
});

const ClaimDataV1RawCodec = ccc.mol.table({
  issuerId: Byte20,
  nonce: ccc.mol.Byte32,
  issuedAt: ccc.mol.Uint64,
  expiresAt: ccc.mol.Uint64Opt,
  payload: ccc.mol.Bytes,
});

function decodeCanonicalDagCbor(payload: ccc.HexLike): unknown {
  const bytes = ccc.bytesFrom(payload);
  const value = decodeDagCbor(bytes);
  if (!ccc.bytesEq(bytes, encodeDagCbor(value))) {
    throw new Error(
      "Claim payload is valid DAG-CBOR but not canonically encoded",
    );
  }
  return value;
}

const ClaimDataV1Codec = ClaimDataV1RawCodec.map<
  ClaimDataV1Like,
  ClaimDataV1Like
>({
  inMap: (data) => ({
    ...data,
    payload: ccc.hexFrom(encodeDagCbor(data.payload)),
  }),
  outMap: (data) => ({
    ...data,
    payload: decodeCanonicalDagCbor(data.payload),
  }),
});

/** Molecule-backed entity for V1 Claim Cell data with a canonical DAG-CBOR payload. */
@ccc.codec(ClaimDataV1Codec)
export class ClaimDataV1 extends ccc.Entity.Base<
  ClaimDataV1Like,
  ClaimDataV1
>() {
  constructor(
    public issuerId: ccc.Hex,
    public nonce: ccc.Hex,
    public issuedAt: ccc.Num,
    public expiresAt: ccc.Num | undefined,
    public payload: unknown,
  ) {
    super();
  }

  static from(data: ClaimDataV1Like): ClaimDataV1 {
    if (data instanceof ClaimDataV1) {
      return data;
    }

    return new ClaimDataV1(
      ccc.hexFrom(data.issuerId),
      ccc.hexFrom(data.nonce),
      ccc.numFrom(data.issuedAt),
      data.expiresAt == null ? undefined : ccc.numFrom(data.expiresAt),
      data.payload,
    );
  }
}

const ClaimDataCodec = ccc.mol.union({
  v1: ClaimDataV1,
});

const ClaimDataRawCodec = ccc.mol.union({
  v1: ClaimDataV1RawCodec,
});

export type ClaimDataV1RawLike = {
  issuerId: ccc.HexLike;
  nonce: ccc.HexLike;
  issuedAt: ccc.NumLike;
  expiresAt?: ccc.NumLike | null;
  payload: ccc.HexLike;
};

/** Versioned Molecule entity for Claim Cell data. */
@ccc.codec(ClaimDataCodec)
export class ClaimData extends ccc.Entity.BaseUnion<
  typeof ClaimDataCodec,
  ClaimDataLike,
  ClaimData
>() {
  constructor(
    public type: "v1",
    public value: ClaimDataV1,
  ) {
    super({ type, value });
  }

  static from(data: ClaimDataLike): ClaimData {
    if (data instanceof ClaimData) {
      return data;
    }

    if ("inner" in data) {
      return new ClaimData(
        data.inner.type ?? "v1",
        ClaimDataV1.from(data.inner.value),
      );
    }

    return new ClaimData(data.type ?? "v1", ClaimDataV1.from(data.value));
  }

  static fromV1(
    data: ClaimDataV1Like,
  ): ClaimData & { type: "v1"; value: ClaimDataV1 } {
    return new ClaimData("v1", ClaimDataV1.from(data));
  }
}

export function decodeClaimDataRaw(bytes: ccc.BytesLike) {
  return ClaimDataRawCodec.decode(bytes);
}

export function encodeClaimDataRaw(data: ClaimDataV1RawLike): ccc.Bytes {
  return ClaimDataRawCodec.encode({ type: "v1", value: data });
}
