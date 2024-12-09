import { ccc, mol } from "@ckb-ccc/core";

export interface ClusterDataV1View {
  name: string;
  description: string;
}

export const ClusterDataV1: mol.Codec<ClusterDataV1View> = mol.table({
  name: mol.String,
  description: mol.String,
});

export interface ClusterDataV2View {
  name: string;
  description: string;
  mutantId?: ccc.HexLike;
}

export const ClusterDataV2: mol.Codec<ClusterDataV2View> = mol.table({
  name: mol.String,
  description: mol.String,
  mutantId: mol.BytesOpt,
});

export type ClusterDataView = ClusterDataV2View;

export type ClusterDataVersion = "v1" | "v2";

export const ClusterData = ClusterDataV2;

/**
 * Pack RawClusterData to Uint8Array.
 * Pass an optional "version" field to select a specific packing version.
 */
export function packRawClusterData(packable: ClusterDataView): Uint8Array;
export function packRawClusterData(
  packable: ClusterDataV1View,
  version: "v1",
): Uint8Array;
export function packRawClusterData(
  packable: ClusterDataV2View,
  version: "v2",
): Uint8Array;
export function packRawClusterData(
  packable: ClusterDataV1View | ClusterDataV2View,
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

export function packRawClusterDataV1(packable: ClusterDataV1View): Uint8Array {
  return ccc.bytesFrom(
    ClusterDataV1.encode({
      name: packable.name,
      description: packable.description,
    }),
  );
}

export function packRawClusterDataV2(packable: ClusterDataV2View): Uint8Array {
  return ccc.bytesFrom(
    ClusterDataV2.encode({
      name: packable.name,
      description: packable.description,
      mutantId: packable.mutantId,
    }),
  );
}

/**
 * Unpack Hex/Bytes to RawClusterData.
 * Pass an optional "version" field to select a specific unpacking version.
 */
export function unpackToRawClusterData(
  unpackable: ccc.BytesLike,
): ClusterDataView;
export function unpackToRawClusterData(
  unpackable: ccc.BytesLike,
  version: "v1",
): ClusterDataV1View;
export function unpackToRawClusterData(
  unpackable: ccc.BytesLike,
  version: "v2",
): ClusterDataV2View;
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
): ClusterDataV1View {
  return ClusterDataV1.decode(unpackable);
}

export function unpackToRawClusterDataV2(
  unpackable: ccc.BytesLike,
): ClusterDataV2View {
  return ClusterDataV2.decode(unpackable);
}
