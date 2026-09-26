import { bech32m } from "bech32";
import { bytesConcat, bytesFrom } from "../bytes/index.js";
import { Script, ScriptLike, hashTypeToBytes } from "../ckb/index.js";
import { Client, KnownScript } from "../client/index.js";
import { HexLike } from "../hex/index.js";
import {
  ADDRESS_BECH32_LIMIT,
  AddressFormat,
  addressFromPayload,
  addressPayloadFromString,
} from "./address.advanced.js";

/**
 * @public
 */
export type AddressLike = {
  script: ScriptLike;
  prefix: string;
};

/**
 * Represents a ckb address with associated script and prefix.
 * @public
 */
export class Address {
  /**
   * Creates an instance of Address.
   *
   * @param script - The script associated with the address.
   * @param prefix - The address prefix.
   */
  constructor(
    public script: Script,
    public prefix: string,
  ) {}

  /**
   * Creates an Address instance from an AddressLike object.
   *
   * @param address - An AddressLike object or an instance of Address.
   * @returns An Address instance.
   */

  static from(address: AddressLike): Address {
    if (address instanceof Address) {
      return address;
    }

    return new Address(Script.from(address.script), address.prefix);
  }

  /**
   * Creates an Address instance from an address string.
   *
   * @param address - The address string to parse. If it does not parse, a
   * single Client's `addressResolver` may resolve it.
   * @param clients - A Client instance or a record of Client instances keyed by prefix.
   * @returns A promise that resolves to an Address instance.
   *
   * @throws Will throw an error if the address prefix is unknown or mismatched,
   * or if the resolver handles the address but does not find it.
   */

  static async fromString(
    address: string,
    clients: Client | Record<string, Client>,
  ): Promise<Address> {
    let parsed: ReturnType<typeof addressPayloadFromString>;
    try {
      parsed = addressPayloadFromString(address);
    } catch (error) {
      // A record of clients is keyed by prefix, which an unparsed address does not have.
      const client =
        "addressPrefix" in clients ? (clients as Client) : undefined;
      const resolver = client?.addressResolver;
      if (!client || !resolver?.shouldResolve(address)) {
        throw error;
      }
      const script = await resolver.resolve(address, client);
      if (!script) {
        throw new Error(`Address ${address} not found`, { cause: error });
      }
      return Address.fromScript(script, client);
    }
    const { prefix, format, payload } = parsed;

    const client = (clients as Record<string, Client>)[prefix] ?? clients;
    if (!client) {
      throw new Error(`Unknown address prefix ${prefix}`);
    }
    const expectedPrefix = client.addressPrefix;
    if (expectedPrefix !== prefix) {
      throw new Error(
        `Unknown address prefix ${prefix}, expected ${expectedPrefix}`,
      );
    }

    return Address.from(
      await addressFromPayload(prefix, format, payload, client),
    );
  }

  /**
   * Creates an Address instance from a script and client.
   *
   * @param script - The script-like object.
   * @param client - The client instance used to fetch the address prefix.
   * @returns A promise that resolves to an Address instance.
   */

  static fromScript(script: ScriptLike, client: Client): Address {
    return Address.from({ script, prefix: client.addressPrefix });
  }

  static async fromKnownScript(
    client: Client,
    script: KnownScript,
    args: HexLike,
  ): Promise<Address> {
    return Address.from({
      script: await Script.fromKnownScript(client, script, args),
      prefix: client.addressPrefix,
    });
  }

  /**
   * Converts the Address instance to a string.
   *
   * @returns The address as a string.
   */

  toString(): string {
    const data = bytesConcat(
      [AddressFormat.Full],
      bytesFrom(this.script.codeHash),
      hashTypeToBytes(this.script.hashType),
      bytesFrom(this.script.args),
    );

    return bech32m.encode(
      this.prefix,
      bech32m.toWords(data),
      ADDRESS_BECH32_LIMIT,
    );
  }
}
