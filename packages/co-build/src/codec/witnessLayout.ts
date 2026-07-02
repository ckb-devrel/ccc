import { ccc, mol } from "@ckb-ccc/core";
import { Message, MessageLike } from "./buildingPacket.js";

/**
 * Representation of a SighashAll's properties.
 */
export type SighashAllLike = {
  /**
   * The signature or seal data.
   */
  seal: ccc.BytesLike;
  /**
   * The message containing the actions.
   */
  message: MessageLike;
};

/**
 * Represents a SighashAll witness structure.
 */
@mol.codec(
  mol.table({
    seal: mol.Bytes,
    message: Message,
  }),
)
export class SighashAll extends ccc.Entity.Base<SighashAllLike, SighashAll>() {
  /**
   * Constructs a SighashAll instance.
   * @param seal The hex-encoded signature or seal.
   * @param message The Message instance.
   */
  constructor(
    public seal: ccc.Hex,
    public message: Message,
  ) {
    super();
  }

  /**
   * Creates a SighashAll instance from a SighashAllLike object.
   * @param sighashAllLike The source SighashAllLike object or SighashAll instance.
   * @returns A new or existing SighashAll instance.
   */
  static from(sighashAllLike: SighashAllLike): SighashAll {
    if (sighashAllLike instanceof SighashAll) {
      return sighashAllLike;
    }

    return new SighashAll(
      ccc.hexFrom(sighashAllLike.seal),
      Message.from(sighashAllLike.message),
    );
  }
}

/**
 * WitnessLayout union variant names.
 */
export const WitnessLayoutVariant = {
  SighashAll: "SighashAll",
} as const;

/**
 * WitnessLayout union variant numeric identifiers.
 */
export const WitnessLayoutVariantId = {
  SighashAll: 4278190081,
};

/**
 * Molecule union representing the layout of the transaction witness.
 */
export const WitnessLayout = mol.union(
  {
    SighashAll,
  },
  WitnessLayoutVariantId,
);
