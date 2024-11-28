import { ccc } from "@ckb-ccc/core";

/**
 * The codec for packing/unpacking UTF-8 raw strings.
 * Should be packed like so: String.pack('something')
 */
export const RawString = ccc.codec.byteVecOf({
  pack: (packable: string) => ccc.bytesFrom(packable, "utf8"),
  unpack: (unpackable: ccc.BytesLike) => ccc.bytesTo(unpackable, "utf8"),
});
