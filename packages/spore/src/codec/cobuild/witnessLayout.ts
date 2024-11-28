import { Message } from "./buildingPacket.js";
import { codec } from "@ckb-ccc/core";

export const SighashAll = codec.table(
  {
    seal: codec.Bytes,
    message: Message,
  },
  ["seal", "message"],
);
export const SighashAllOnly = codec.table(
  {
    seal: codec.Bytes,
  },
  ["seal"],
);

/**
 * Otx related are not implemented yet, so just placeholders.
 */
export const Otx = codec.table({}, []);
export const OtxStart = codec.table({}, []);

export const WitnessLayoutFieldTags = {
  SighashAll: 4278190081,
  SighashAllOnly: 4278190082,
  Otx: 4278190083,
  OtxStart: 4278190084,
} as const;

export const WitnessLayout = codec.union(
  {
    SighashAll,
    SighashAllOnly,
    Otx,
    OtxStart,
  },
  WitnessLayoutFieldTags,
);
