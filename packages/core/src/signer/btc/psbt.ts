/**
 * Options for signing a PSBT (Partially Signed Bitcoin Transaction)
 */
export type SignPsbtOptions = {
  /**
   * Whether to finalize the PSBT after signing.
   * Default is true.
   */
  autoFinalized: boolean;
  /**
   * Array of inputs to sign
   */
  toSignInputs: ToSignInput[];
};

/**
 * Specification for an input to sign in a PSBT.
 * Must specify at least one of: address or pubkey.
 */
export type ToSignInput = {
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
      publicKey?: string;
    }
  | {
      /**
       * The address whose corresponding private key to use for signing.
       */
      address?: string;
      /**
       * The public key whose corresponding private key to use for signing.
       */
      publicKey: string;
    }
);
