import { mol } from "@ckb-ccc/core";
import { Message } from "./buildingPacket.js";

export const SighashAll = mol.table({
  seal: mol.Bytes,
  message: Message,
});

export const SighashAllOnly = mol.table({
  seal: mol.Bytes,
});

/**
 * Otx related are not implemented yet, so just placeholders.
 */
export const Otx = mol.table({});
export const OtxStart = mol.table({});

export const WitnessLayoutFieldTags = {
  SighashAll: 4278190081,
  SighashAllOnly: 4278190082,
  Otx: 4278190083,
  OtxStart: 4278190084,
} as const;

export const WitnessLayout = mol.union(
  {
    SighashAll,
    SighashAllOnly,
    Otx,
    OtxStart,
  },
  WitnessLayoutFieldTags,
);
