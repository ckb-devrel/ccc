import { ccc } from "@ckb-ccc/core";
import { blockchain, molecule } from "@ckb-ccc/codec";
import { RawString } from "./base.js";

export const MolClusterDataV1 = molecule.table(
  {
    name: RawString,
    description: RawString,
  },
  ["name", "description"],
);
export const MolClusterDataV2 = molecule.table(
  {
    name: RawString,
    description: RawString,
    mutantId: blockchain.BytesOpt,
  },
  ["name", "description", "mutantId"],
);

export interface ClusterDataV1 {
  name: string;
  description: string;
}
export interface ClusterDataV2 {
  name: string;
  description: string;
  mutantId?: ccc.HexLike;
}
export type ClusterData = ClusterDataV2;

export type ClusterDataVersion = "v1" | "v2";

/**
 * Pack RawClusterData to Uint8Array.
 * Pass an optional "version" field to select a specific packing version.
 */
export function packRawClusterData(packable: ClusterData): Uint8Array;
export function packRawClusterData(
  packable: ClusterDataV1,
  version: "v1",
): Uint8Array;
export function packRawClusterData(
  packable: ClusterDataV2,
  version: "v2",
): Uint8Array;
export function packRawClusterData(
  packable: ClusterDataV1 | ClusterDataV2,
  version?: ClusterDataVersion,
): Uint8Array {
  if (!version) {
    return packRawClusterDataV2(packable);
  }

  switch (version) {
    case "v1":
      return packRawClusterDataV1(packable);
    case "v2":
      return packRawClusterDataV2(packable);
  }
}
export function packRawClusterDataV1(packable: ClusterDataV1): Uint8Array {
  return MolClusterDataV1.pack({
    name: packable.name,
    description: packable.description,
  });
}
export function packRawClusterDataV2(packable: ClusterDataV2): Uint8Array {
  return MolClusterDataV2.pack({
    name: packable.name,
    description: packable.description,
    mutantId: packable.mutantId,
  });
}

/**
 * Unpack Hex/Bytes to RawClusterData.
 * Pass an optional "version" field to select a specific unpacking version.
 */
export function unpackToRawClusterData(unpackable: ccc.BytesLike): ClusterData;
export function unpackToRawClusterData(
  unpackable: ccc.BytesLike,
  version: "v1",
): ClusterDataV1;
export function unpackToRawClusterData(
  unpackable: ccc.BytesLike,
  version: "v2",
): ClusterDataV2;
export function unpackToRawClusterData(
  unpackable: ccc.BytesLike,
  version?: ClusterDataVersion,
): unknown {
  if (version) {
    switch (version) {
      case "v1":
        return unpackToRawClusterDataV1(unpackable);
      case "v2":
        return unpackToRawClusterDataV2(unpackable);
    }
  }

  try {
    return unpackToRawClusterDataV2(unpackable);
  } catch {
    try {
      return unpackToRawClusterDataV1(unpackable);
    } catch {
      throw new Error(
        `Cannot unpack ClusterData, no matching molecule: ${ccc.hexFrom(unpackable)}`,
      );
    }
  }
}
export function unpackToRawClusterDataV1(
  unpackable: ccc.BytesLike,
): ClusterDataV1 {
  const decoded = MolClusterDataV1.unpack(unpackable);
  return {
    name: decoded.name,
    description: decoded.description,
  };
}
export function unpackToRawClusterDataV2(
  unpackable: ccc.BytesLike,
): ClusterDataV2 {
  const decoded = MolClusterDataV2.unpack(unpackable);
  return {
    name: decoded.name,
    description: decoded.description,
    mutantId: ccc.apply(ccc.hexFrom, decoded.mutantId),
  };
}
