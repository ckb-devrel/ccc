import { ccc } from "@ckb-ccc/core";
import { Psbt } from "bitcoinjs-lib";
import * as v from "valibot";
import {
  Address,
  AddressPurpose,
  BtcProvider,
  MessageSigningProtocols,
  Requests,
  Return,
  RpcErrorCode,
  RpcResponse,
  rpcErrorResponseMessageSchema,
  rpcSuccessResponseMessageSchema,
} from "./advancedBarrel.js";

async function checkResponse<T extends keyof Requests>(
  response: Promise<RpcResponse<T>>,
): Promise<Return<T>> {
  const res = await response;
  if (v.is(rpcErrorResponseMessageSchema, res)) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw res.error;
  }

  if (v.is(rpcSuccessResponseMessageSchema, res)) {
    return res.result as Return<T>;
  }

  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw {
    code: RpcErrorCode.INTERNAL_ERROR,
    message: "Received unknown response from provider.",
    data: res,
  };
}

/**
 * Class representing a Bitcoin signer that extends SignerBtc
 * @public
 */
export class Signer extends ccc.SignerBtc {
  private addressCache: Promise<Address | undefined> | undefined;

  /**
   * Creates an instance of Signer.
   * @param client - The client instance.
   * @param provider - The provider instance.
   */
  constructor(
    client: ccc.Client,
    public readonly provider: BtcProvider,
    private readonly preferredNetworks: ccc.NetworkPreference[] = [
      {
        addressPrefix: "ckb",
        signerType: ccc.SignerType.BTC,
        network: "btc",
      },
      {
        addressPrefix: "ckt",
        signerType: ccc.SignerType.BTC,
        network: "btcTestnet",
      },
    ],
  ) {
    super(client);
  }

  async assertAddress(): Promise<Address> {
    this.addressCache =
      this.addressCache ??
      (async () => {
        if (!(await this.isConnected())) {
          return;
        }

        return (
          await checkResponse(
            this.provider.request("getAddresses", {
              purposes: [AddressPurpose.Payment],
            }),
          )
        ).addresses[0];
      })();
    const address = await this.addressCache;

    if (address) {
      return address;
    }
    throw Error("Not connected");
  }

  /**
   * Gets the Bitcoin account address.
   * @returns A promise that resolves to the Bitcoin account address.
   */
  async getBtcAccount(): Promise<string> {
    return (await this.assertAddress()).address;
  }

  /**
   * Gets the Bitcoin public key.
   * @returns A promise that resolves to the Bitcoin public key.
   */
  async getBtcPublicKey(): Promise<ccc.Hex> {
    return ccc.hexFrom((await this.assertAddress()).publicKey);
  }

  /**
   * Connects to the provider by requesting accounts.
   * @returns A promise that resolves when the connection is established.
   */
  async connect(): Promise<void> {
    if (await this.isConnected()) {
      return;
    }

    await checkResponse(
      this.provider.request("wallet_requestPermissions", undefined),
    );
  }

  async disconnect(): Promise<void> {
    this.addressCache = undefined;
  }

  onReplaced(listener: () => void): () => void {
    const stop: (() => void)[] = [];
    const replacer = () => {
      listener();
      stop[0]?.();
    };
    stop.push(
      this.provider.addListener("accountChange", replacer),
      this.provider.addListener("networkChange", replacer),
    );

    return stop[0];
  }

  /**
   * Checks if the signer is connected.
   * @returns A promise that resolves to true if connected, false otherwise.
   */
  async isConnected(): Promise<boolean> {
    try {
      await checkResponse(this.provider.request("getBalance", undefined));
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Signs a raw message with the Bitcoin account.
   * @param message - The message to sign.
   * @returns A promise that resolves to the signed message.
   */
  async signMessageRaw(message: string | ccc.BytesLike): Promise<string> {
    const challenge =
      typeof message === "string" ? message : ccc.hexFrom(message).slice(2);

    return (
      await checkResponse(
        this.provider.request("signMessage", {
          message: challenge,
          address: (await this.assertAddress()).address,
          protocol: MessageSigningProtocols.ECDSA,
        }),
      )
    ).signature;
  }

  /**
   * Build default toSignInputs for all unsigned inputs
   */
  private buildDefaultToSignInputs(
    psbtHex: ccc.Hex,
    address: string,
  ): ccc.ToSignInput[] {
    const toSignInputs: ccc.ToSignInput[] = [];

    try {
      // Collect all unsigned inputs
      const psbt = Psbt.fromHex(psbtHex.slice(2));
      psbt.data.inputs.forEach((input, index) => {
        const isSigned =
          input.finalScriptSig ||
          input.finalScriptWitness ||
          input.tapKeySig ||
          (input.partialSig && input.partialSig.length > 0) ||
          (input.tapScriptSig && input.tapScriptSig.length > 0);

        if (!isSigned) {
          toSignInputs.push({ index, address });
        }
      });

      // If no unsigned inputs found, the PSBT is already fully signed
      // Let the wallet handle this case (likely a no-op or error)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to parse PSBT hex. Please provide toSignInputs explicitly in options. Original error: ${errorMessage}`,
      );
    }

    return toSignInputs;
  }

  private async prepareSignPsbtParams(
    psbtHex: ccc.Hex,
    options?: ccc.SignPsbtOptions,
  ): Promise<{
    psbtBase64: string;
    signInputs: Record<string, number[]>;
  }> {
    let toSignInputs = options?.toSignInputs;
    if (!toSignInputs || !toSignInputs.length) {
      const address = await this.getBtcAccount();
      toSignInputs = this.buildDefaultToSignInputs(psbtHex, address);
    }

    const psbtBase64 = ccc.bytesTo(psbtHex, "base64");

    const signInputs = toSignInputs.reduce(
      (acc, input) => {
        if (!input.address) {
          throw new Error(
            "Xverse only supports signing with address. Please provide 'address' in toSignInputs.",
          );
        }
        if (acc[input.address]) {
          acc[input.address].push(input.index);
        } else {
          acc[input.address] = [input.index];
        }
        return acc;
      },
      {} as Record<string, number[]>,
    );

    return { psbtBase64, signInputs };
  }

  /**
   * Signs a PSBT using Xverse wallet.
   *
   * @param psbtHex - The hex string (without 0x prefix) of PSBT to sign.
   * @param options - Options for signing the PSBT
   * @returns A promise that resolves to the signed PSBT hex string (without 0x prefix)
   *
   * @remarks
   * Xverse accepts:
   * - psbt: A string representing the PSBT to sign, encoded in base64
   * - signInputs: A Record<string, number[]> where:
   *   - keys are the addresses to use for signing
   *   - values are the indexes of the inputs to sign with each address
   *
   * Xverse returns:
   * - psbt: The base64 encoded signed PSBT
   *
   * @see https://docs.xverse.app/sats-connect/bitcoin-methods/signpsbt
   */
  async signPsbt(
    psbtHex: ccc.HexLike,
    options?: ccc.SignPsbtOptions,
  ): Promise<string> {
    const { psbtBase64, signInputs } = await this.prepareSignPsbtParams(
      ccc.hexFrom(psbtHex),
      options,
    );

    const signedPsbtBase64 = (
      await checkResponse(
        this.provider.request("signPsbt", {
          psbt: psbtBase64,
          signInputs,
          broadcast: false,
        }),
      )
    ).psbt;

    const signedPsbtBytes = ccc.bytesFrom(signedPsbtBase64, "base64");
    return ccc.bytesTo(signedPsbtBytes, "hex"); // no leading "0x"
  }

  /**
   * Broadcasts a PSBT to the Bitcoin network.
   *
   * @remarks
   * Xverse does not support broadcasting a signed PSBT directly.
   * It only supports "Sign and Broadcast" as a single atomic operation via `signAndBroadcastPsbt`.
   */
  async broadcastPsbt(
    _psbtHex: ccc.HexLike,
    _options?: ccc.SignPsbtOptions,
  ): Promise<string> {
    throw new Error(
      "Xverse does not support broadcasting signed PSBTs directly. Use signAndBroadcastPsbt instead.",
    );
  }

  async signAndBroadcastPsbt(
    psbtHex: ccc.HexLike,
    options?: ccc.SignPsbtOptions,
  ): Promise<string> {
    // ccc.hexFrom adds 0x prefix, but BTC expects non-0x
    const { psbtBase64, signInputs } = await this.prepareSignPsbtParams(
      ccc.hexFrom(psbtHex),
      options,
    );

    const result = await checkResponse(
      this.provider.request("signPsbt", {
        psbt: psbtBase64,
        signInputs,
        broadcast: true,
      }),
    );

    if (!result.txid) {
      throw new Error("Failed to broadcast PSBT");
    }

    return result.txid;
  }
}
