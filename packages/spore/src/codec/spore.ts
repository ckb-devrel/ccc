import { ccc, molecule } from "@ckb-ccc/core";

export interface SporeDataView {
  contentType: string;
  content: ccc.BytesLike;
  clusterId?: ccc.HexLike;
}

export const SporeData: molecule.Codec<SporeDataView> = molecule.table({
  contentType: molecule.String,
  content: molecule.Bytes,
  clusterId: molecule.BytesOpt,
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
