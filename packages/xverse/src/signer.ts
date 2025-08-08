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
  rpcErrorResponseMessageSchema,
  rpcSuccessResponseMessageSchema,
} from "./advancedBarrel.js";

async function checkResponse<T extends keyof Requests>(
  response: Promise<RpcResponse<T>>,
): Promise<Return<T>> {
  const res = await response;
  if (v.is(rpcErrorResponseMessageSchema, res)) {
    throw res.error;
  }

  if (v.is(rpcSuccessResponseMessageSchema, res)) {
    return res.result as Return<T>;
  }

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

  async signPsbt(_: string): Promise<string> {
    throw new Error("Not implemented");
  }

  async pushPsbt(_: string): Promise<string> {
    throw new Error("Not implemented");
  }
}
