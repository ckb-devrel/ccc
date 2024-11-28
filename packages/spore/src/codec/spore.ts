import { ccc } from "@ckb-ccc/core";
import { RawString } from "./base.js";

export const MolSporeData = ccc.codec.table(
  {
    contentType: RawString,
    content: ccc.codec.Bytes,
    clusterId: ccc.codec.BytesOpt,
  },
  ["contentType", "content", "clusterId"],
);

export interface SporeData {
  contentType: string;
  content: ccc.BytesLike;
  clusterId?: ccc.HexLike;
}

export function packRawSporeData(packable: SporeData): Uint8Array {
  return MolSporeData.pack({
    contentType: packable.contentType,
    content: packable.content,
    clusterId: packable.clusterId,
  });
}

export function unpackToRawSporeData(unpackable: ccc.BytesLike): SporeData {
  const unpacked = MolSporeData.unpack(ccc.bytesFrom(unpackable));
  return {
    contentType: unpacked.contentType,
    content: unpacked.content,
    clusterId: ccc.apply(ccc.hexFrom, unpacked.clusterId),
  };
}
