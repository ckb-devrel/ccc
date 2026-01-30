import { Hex, HexLike, hexFrom } from "../../hex/index.js";

/**
 * Options for signing a PSBT (Partially Signed Bitcoin Transaction)
 */
export type SignPsbtOptionsLike = {
  /**
   * Whether to finalize the PSBT after signing.
   * Default is true.
   */
  autoFinalized?: boolean;
  /**
   * Array of inputs to sign
   */
  inputsToSign?: InputToSignLike[];
};

export class SignPsbtOptions {
  constructor(
    public autoFinalized: boolean,
    public inputsToSign: InputToSign[],
  ) {}

  static from(options?: SignPsbtOptionsLike): SignPsbtOptions {
    if (options instanceof SignPsbtOptions) {
      return options;
    }
    return new SignPsbtOptions(
      options?.autoFinalized ?? true,
      options?.inputsToSign?.map((i) => InputToSign.from(i)) ?? [],
    );
  }
}

/**
 * Specification for an input to sign in a PSBT.
 * Must specify at least one of: address or pubkey.
 */
export type InputToSignLike = {
  /**
   * Which input to sign (index in the PSBT inputs array)
   */
  index: number;
  /**
   * (Optional) Sighash types to use for signing.
   */
  sighashTypes?: number[];
  /**
   * (Optional) When signing and unlocking Taproot addresses, the tweakSigner is used by default
   * for signature generation. Setting this to true allows for signing with the original private key.
   * Default value is false.
   */
  disableTweakSigner?: boolean;
} & (
  | {
      /**
       * The address whose corresponding private key to use for signing.
       */
      address: string;
      /**
       * The public key whose corresponding private key to use for signing.
       */
      publicKey?: HexLike;
    }
  | {
      /**
       * The address whose corresponding private key to use for signing.
       */
      address?: string;
      /**
       * The public key whose corresponding private key to use for signing.
       */
      publicKey: HexLike;
    }
);

export class InputToSign {
  constructor(
    public index: number,
    public sighashTypes?: number[],
    public disableTweakSigner?: boolean,
    public address?: string,
    public publicKey?: Hex,
  ) {}

  static from(input: InputToSignLike): InputToSign {
    if (input instanceof InputToSign) {
      return input;
    }
    return new InputToSign(
      input.index,
      input.sighashTypes,
      input.disableTweakSigner,
      input.address,
      input.publicKey ? hexFrom(input.publicKey) : undefined,
    );
  }
}
