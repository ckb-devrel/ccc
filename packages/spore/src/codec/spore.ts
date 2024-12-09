import { ccc, mol } from "@ckb-ccc/core";

export interface SporeDataView {
  contentType: string;
  content: ccc.BytesLike;
  clusterId?: ccc.HexLike;
}

export const SporeData: mol.Codec<SporeDataView> = mol.table({
  contentType: mol.String,
  content: mol.Bytes,
  clusterId: mol.BytesOpt,
});

export function packRawSporeData(packable: SporeDataView): Uint8Array {
  return ccc.bytesFrom(
    SporeData.encode({
      contentType: packable.contentType,
      content: packable.content,
      clusterId: packable.clusterId,
    }),
  );
}

export function unpackToRawSporeData(unpackable: ccc.BytesLike): SporeDataView {
  return SporeData.decode(unpackable);
}
