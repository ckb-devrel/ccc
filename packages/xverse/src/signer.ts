import { finalizeReadyInputs, isFinalized, parsePsbt } from "@ckb-ccc/btc-psbt";
import { ccc } from "@ckb-ccc/core";
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
  WalletNetworkName,
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
    return res.result;
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
    _preferredNetworks?: ccc.NetworkPreference[],
    public readonly network?: WalletNetworkName,
  ) {
    super(client);
  }

  async assertAddress(): Promise<Address> {
    const request = this.addressCache ?? this.requestAddress();
    this.addressCache = request;

    let address: Address | undefined;
    try {
      address = await request;
    } catch (error) {
      if (this.addressCache === request) {
        this.addressCache = undefined;
      }
      throw error;
    }

    if (address) {
      return address;
    }
    this.addressCache = undefined;
    throw Error("Not connected");
  }

  private async requestAddress(): Promise<Address | undefined> {
    if (this.network && (await this.getNetwork()) !== this.network) {
      return;
    }

    return (
      await checkResponse(
        this.provider.request("getAddresses", {
          purposes: [AddressPurpose.Payment],
        }),
      )
    ).addresses[0];
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
    const currentNetwork = this.network ? await this.getNetwork() : undefined;
    if (this.network && currentNetwork !== this.network) {
      await checkResponse(
        this.provider.request("wallet_changeNetwork", { name: this.network }),
      );
      this.addressCache = undefined;
    }
  }

  async disconnect(): Promise<void> {
    this.addressCache = undefined;
  }

  onReplaced(listener: () => void): () => void {
    const stops: (() => void)[] = [];
    const stop = () => {
      stops.splice(0).forEach((unregister) => unregister());
    };
    const replacer = () => {
      listener();
      stop();
    };
    stops.push(
      this.provider.addListener("accountChange", replacer),
      this.provider.addListener("networkChange", replacer),
    );

    return stop;
  }

  /**
   * Checks if the signer is connected.
   * @returns A promise that resolves to true if connected, false otherwise.
   */
  async isConnected(): Promise<boolean> {
    try {
      const address = await this.requestAddress();
      if (address) {
        this.addressCache = Promise.resolve(address);
      } else {
        this.addressCache = undefined;
      }
      return address !== undefined;
    } catch (_error) {
      this.addressCache = undefined;
      return false;
    }
  }

  private async getNetwork(): Promise<WalletNetworkName> {
    return (
      await checkResponse(this.provider.request("wallet_getNetwork", null))
    ).bitcoin.name;
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

  private async prepareSignPsbtParams(
    psbtHex: ccc.Hex,
    options: ccc.SignPsbtOptions,
  ): Promise<{
    psbtBase64: string;
    signInputs: Record<string, number[]>;
  }> {
    const unsigned = parsePsbt(ccc.bytesFrom(psbtHex));
    const inputsToSign = [...options.inputsToSign];

    if (!inputsToSign.length) {
      const address = await this.getBtcAccount();
      for (let index = 0; index < unsigned.inputsLength; index++) {
        const input = unsigned.getInput(index);
        if (
          !isFinalized(input) &&
          !input.tapKeySig &&
          !input.partialSig?.length &&
          !input.tapScriptSig?.length
        ) {
          inputsToSign.push(ccc.InputToSign.from({ index, address }));
        }
      }
    }

    const psbtBase64 = ccc.bytesTo(psbtHex, "base64");

    const signInputs = inputsToSign.reduce(
      (acc, input) => {
        if (!input.address) {
          throw new Error(
            "Xverse only supports signing with address. Please provide 'address' in inputsToSign.",
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
   * @param psbtHex - The hex string of PSBT to sign.
   * @param options - Options for signing the PSBT
   * @returns A promise that resolves to the signed PSBT as a Hex string
   *
   * @remarks
   * Xverse accepts:
   * - psbt: A string representing the PSBT to sign, encoded in base64
   * - signInputs: A Record<string, number[]> where:
   *   - keys are the addresses to use for signing
   *   - values are the indexes of the inputs to sign with each address
   *
   * Xverse returns:
   * - psbt: The base64 encoded signed PSBT, which is not finalized
   *
   * Xverse has no equivalent of `autoFinalized`, so when it is enabled the
   * ready supported inputs are finalized locally after signing. The RPC does not
   * support `sighashTypes` or `disableTweakSigner`.
   *
   * @see https://docs.xverse.app/sats-connect/bitcoin-methods/signpsbt
   */
  async signPsbt(
    psbtHex: ccc.HexLike,
    options?: ccc.SignPsbtOptionsLike,
  ): Promise<ccc.Hex> {
    const normalized = ccc.SignPsbtOptions.from(options);
    const { psbtBase64, signInputs } = await this.prepareSignPsbtParams(
      ccc.hexFrom(psbtHex),
      normalized,
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

    const signedPsbt = parsePsbt(ccc.bytesFrom(signedPsbtBase64, "base64"));
    if (!normalized.autoFinalized) {
      return ccc.hexFrom(signedPsbt.toPSBT());
    }
    finalizeReadyInputs(signedPsbt);
    return ccc.hexFrom(signedPsbt.toPSBT());
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
    _options?: ccc.SignPsbtOptionsLike,
  ): Promise<ccc.Hex> {
    throw new Error(
      "Xverse does not support broadcasting signed PSBTs directly. Use signAndBroadcastPsbt instead.",
    );
  }

  async signAndBroadcastPsbt(
    psbtHex: ccc.HexLike,
    options?: ccc.SignPsbtOptionsLike,
  ): Promise<ccc.Hex> {
    // Xverse finalizes and broadcasts on its own side, so autoFinalized is
    // not needed here.
    const { psbtBase64, signInputs } = await this.prepareSignPsbtParams(
      ccc.hexFrom(psbtHex),
      ccc.SignPsbtOptions.from(options),
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

    return ccc.hexFrom(result.txid);
  }
}
