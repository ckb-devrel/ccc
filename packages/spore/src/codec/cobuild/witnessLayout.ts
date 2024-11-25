import { blockchain, molecule } from "@ckb-ccc/codec";
import { Message } from "./buildingPacket.js";

export const SighashAll = molecule.table(
  {
    seal: blockchain.Bytes,
    message: Message,
  },
  ["seal", "message"],
);
export const SighashAllOnly = molecule.table(
  {
    seal: blockchain.Bytes,
  },
  ["seal"],
);

/**
 * Otx related are not implemented yet, so just placeholders.
 */
export const Otx = molecule.table({}, []);
export const OtxStart = molecule.table({}, []);

export const WitnessLayoutFieldTags = {
  SighashAll: 4278190081,
  SighashAllOnly: 4278190082,
  Otx: 4278190083,
  OtxStart: 4278190084,
} as const;

export const WitnessLayout = molecule.union(
  {
    SighashAll,
    SighashAllOnly,
    Otx,
    OtxStart,
  },
  WitnessLayoutFieldTags,
);
