import { ccc, mol } from "@ckb-ccc/core";
import { Message } from "./buildingPacket.js";

export const SighashAllCodec = mol.table({
  seal: mol.Bytes,
  message: Message,
});

/**
 * Representation of a SighashAll's properties.
 */
export type SighashAllLike = ccc.EncodableType<typeof SighashAllCodec>;

/**
 * Represents a SighashAll witness structure.
 */
@ccc.codec(SighashAllCodec)
export class SighashAll extends ccc.Entity.Base<SighashAllLike, SighashAll>() {
  public seal: ccc.Hex;
  public message: Message;

  /**
   * Constructs a SighashAll instance.
   * @param seal The hex-encoded signature or seal.
   * @param message The Message instance.
   */
  constructor({ seal, message }: ccc.DecodedType<typeof SighashAllCodec>) {
    super();

    this.seal = seal;
    this.message = message;
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
export const WitnessLayoutCodec = mol.union(
  {
    SighashAll,
  },
  WitnessLayoutVariantId,
);

type WitnessLayoutLike = ccc.EncodableType<typeof WitnessLayoutCodec>;

@ccc.codec(WitnessLayoutCodec)
export class WitnessLayout extends ccc.Entity.BaseUnion<
  typeof WitnessLayoutCodec,
  WitnessLayoutLike,
  WitnessLayout
>() {}
