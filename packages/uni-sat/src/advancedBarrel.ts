import { ccc } from "@ckb-ccc/core";

/**
 * An input to sign, in the shape expected by the UniSat wallet API.
 * Must specify at least one of: address or publicKey.
 *
 * @see https://github.com/unisat-wallet/unisat-dev-docs/blob/master/wallet-api/api-docs/sign-transaction.md
 */
export type SignPsbtInput = {
  /**
   * Which input to sign (index in the PSBT inputs array).
   */
  index: number;
  /**
   * Sighash types to use for signing.
   */
  sighashTypes?: number[];
  /**
   * Sign with the original private key instead of the tweaked one for Taproot inputs.
   */
  disableTweakSigner?: boolean;
} & (
  | {
      /**
       * The address whose corresponding private key to use for signing.
       */
      address: string;
      /**
       * The public key (hex without 0x prefix) whose corresponding private key to use for signing.
       */
      publicKey?: string;
    }
  | {
      /**
       * The address whose corresponding private key to use for signing.
       */
      address?: string;
      /**
       * The public key (hex without 0x prefix) whose corresponding private key to use for signing.
       */
      publicKey: string;
    }
);

/**
 * Options for signing a PSBT, in the shape expected by the UniSat wallet API.
 *
 * @see https://github.com/unisat-wallet/unisat-dev-docs/blob/master/wallet-api/api-docs/sign-transaction.md
 */
export interface SignPsbtOptions {
  /**
   * Whether to finalize the signed inputs after signing. The wallet defaults to true.
   */
  autoFinalized?: boolean;
  /**
   * The inputs to sign. When omitted, the wallet signs every input it can sign
   * with the current account.
   */
  toSignInputs?: SignPsbtInput[];
}

/**
 * Converts CCC-level sign PSBT options into the shape expected by the UniSat
 * wallet API, applying the CCC defaults.
 *
 * Empty `inputsToSign` is translated into an omitted `toSignInputs` so the
 * wallet keeps its default of signing every input it can sign.
 *
 * @param options - The options to convert.
 * @returns The options in UniSat's shape.
 */
export function toUniSatSignPsbtOptions(
  options?: ccc.SignPsbtOptionsLike | ccc.SignPsbtOptions,
): SignPsbtOptions {
  const { autoFinalized, inputsToSign } = ccc.SignPsbtOptions.from(options);

  const toSignInputs = inputsToSign.map(
    ({
      index,
      address,
      publicKey,
      sighashTypes,
      disableTweakSigner,
    }): SignPsbtInput => {
      const input = { index, sighashTypes, disableTweakSigner };
      if (address !== undefined) {
        return {
          ...input,
          address,
          publicKey:
            publicKey !== undefined
              ? ccc.hexFrom(publicKey).slice(2)
              : undefined,
        };
      }
      if (publicKey !== undefined) {
        return { ...input, publicKey: ccc.hexFrom(publicKey).slice(2) };
      }
      throw new Error(
        `Either address or publicKey is required for input #${index}`,
      );
    },
  );

  return {
    autoFinalized,
    ...(toSignInputs.length > 0 ? { toSignInputs } : {}),
  };
}

/**
 * Interface representing a provider for interacting with accounts and signing messages.
 */
export interface Provider {
  /**
   * Signs a PSBT using UniSat wallet.
   *
   * @param psbtHex - The hex string of PSBT to sign
   * @param options - Options for signing the PSBT, in UniSat's shape
   * @returns A promise that resolves to the signed PSBT hex string
   */
  signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string>;

  /**
   * Broadcasts a signed PSBT to the Bitcoin network.
   *
   * @param psbtHex - The hex string of the signed PSBT to broadcast.
   * @returns A promise that resolves to the transaction ID.
   */
  pushPsbt(psbtHex: string): Promise<string>;

  /**
   * Requests user accounts.
   * @returns A promise that resolves to an array of account addresses.
   */
  requestAccounts(): Promise<string[]>;

  /**
   * Gets the current network.
   * @returns current network.
   */
  getNetwork(): Promise<"livenet" | "testnet">;

  /**
   * Switch the current network.
   */
  switchNetwork(chain: "livenet" | "testnet"): Promise<void>;

  /**
   * Gets the current chain.
   * @returns current chain.
   */
  getChain?(): Promise<{ enum: string; name: string; network: string }>;

  /**
   * Switch the current chain.
   */
  switchChain?(
    chain: string,
  ): Promise<{ enum: string; name: string; network: string }>;

  /**
   * Gets the current accounts.
   * @returns A promise that resolves to an array of account addresses.
   */
  getAccounts(): Promise<string[]>;

  /**
   * Gets the public key of the account.
   * @returns A promise that resolves to the public key.
   */
  getPublicKey(): Promise<string>;

  /**
   * Signs a message with the specified type.
   * @param msg - The message to sign.
   * @param type - The type of signature.
   * @returns A promise that resolves to the signed message.
   */
  signMessage(msg: string, type: "ecdsa" | "bip322-simple"): Promise<string>;

  /**
   * Adds an event listener to the provider.
   */
  on: OnMethod;

  /**
   * Removes an event listener from the provider.
   * @param eventName - The name of the event to remove the listener from.
   * @param listener - The listener function to remove.
   * @returns The provider instance.
   */
  removeListener(
    eventName: string,
    listener: (...args: unknown[]) => unknown,
  ): Provider;
}

/**
 * Interface representing a method to add event listeners to the provider.
 */
export interface OnMethod {
  /**
   * Adds an event listener to the provider.
   * @param eventName - The name of the event.
   * @param listener - The listener function.
   * @returns The provider instance.
   */
  (eventName: string, listener: (...args: unknown[]) => unknown): Provider;
}
