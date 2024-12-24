import { bech32, bech32m } from "bech32";
import { Script, hashTypeFromBytes } from "../ckb/index.js";
import { Client, KnownScript } from "../client/index.js";
import { hexFrom } from "../hex/index.js";
import { type AddressLike } from "./index.js";

/**
 * Parses an address string into an address information object.
 *
 * @param address - The address string to parse.
 * @returns An object containing the address prefix, address format, and payload array.
 *
 * @throws Will throw an error if the address format is unknown.
 *
 * @example
 * ```typescript
 * const addressInfo = addressPayloadFromString("ckt1112139193129");
 * console.log(addressInfo.prefix); // Outputs the address prefix
 * console.log(addressInfo.format); // Outputs the address format
 * console.log(addressInfo.payload); // Outputs the payload array
 * ```
 */

export function addressPayloadFromString(address: string): {
  prefix: string;
  format: AddressFormat;
  payload: number[];
} {
  // Try parse full format address
  try {
    const { words, prefix } = bech32m.decode(address, ADDRESS_BECH32_LIMIT);
    const decoded = bech32m.fromWords(words);
    const formatType = decoded[0];
    const payload = decoded.slice(1);

    if (formatType === (AddressFormat.Full as number)) {
      return { prefix, format: AddressFormat.Full, payload };
    }
  } catch (_) {}

  // Try parse legacy 2019 format address
  try {
    const { prefix, words } = bech32.decode(address, ADDRESS_BECH32_LIMIT);
    const decoded = bech32.fromWords(words);
    const formatType = decoded[0];
    const payload = decoded.slice(1);
    if (
      [
        AddressFormat.FullData,
        AddressFormat.FullType,
        AddressFormat.Short,
      ].includes(formatType)
    ) {
      return { prefix, format: formatType, payload };
    }
  } catch (_) {}

  throw Error(`Unknown address format ${address}`);
}

/**
 * Converts an address payload into an address-like object.
 *
 * @param prefix - The address prefix.
 * @param format - The format of the address, as defined by the AddressFormat enum.
 * @param payload - The payload array containing the address data.
 * @param client - The client instance used to fetch known scripts.
 * @returns A promise that resolves to an AddressLike object.
 *
 * @throws Will throw an error if the payload length is insufficient or if the script type is unknown.
 *
 * @example
 * ```typescript
 * const address = await addressFromPayload("ckt", AddressFormat.Full, [/* payload data *\/], client);
 * console.log(address.script); // Outputs the script object
 * console.log(address.prefix); // Outputs the address prefix
 * ```
 */

export async function addressFromPayload(
  prefix: string,
  format: AddressFormat,
  payload: number[],
  client: Client,
): Promise<AddressLike> {
  if (format === AddressFormat.Full) {
    if (payload.length < 32 + 1) {
      throw new Error(
        `Invalid full address without enough payload ${hexFrom(payload)}`,
      );
    }

    return {
      script: {
        codeHash: payload.slice(0, 32),
        hashType: hashTypeFromBytes(payload.slice(32, 33)),
        args: payload.slice(33),
      },
      prefix,
    };
  }

  if (format === AddressFormat.FullData) {
    if (payload.length < 32) {
      throw new Error(
        `Invalid full data address without enough payload ${hexFrom(payload)}`,
      );
    }

    return {
      script: {
        codeHash: payload.slice(0, 32),
        hashType: "data",
        args: payload.slice(32),
      },
      prefix,
    };
  }

  if (format === AddressFormat.FullType) {
    if (payload.length < 32) {
      throw new Error(
        `Invalid full type address without enough payload ${hexFrom(payload)}`,
      );
    }

    return {
      script: {
        codeHash: payload.slice(0, 32),
        hashType: "type",
        args: payload.slice(32),
      },
      prefix,
    };
  }

  // format === AddressFormat.Short
  if (payload.length !== 21) {
    throw new Error(
      `Invalid short address without enough payload ${hexFrom(payload)}`,
    );
  }
  const script = [
    KnownScript.Secp256k1Blake160,
    KnownScript.Secp256k1Multisig,
    KnownScript.AnyoneCanPay,
  ][payload[0]];
  if (script === undefined) {
    throw new Error(
      `Invalid short address with unknown script ${hexFrom(payload)}`,
    );
  }

  return {
    script: await Script.fromKnownScript(client, script, payload.slice(1)),
    prefix,
  };
}

export enum AddressFormat {
  /**
   * full version identifies the hashType
   */
  Full = 0x00,
  /**
   * @deprecated
   * short version for locks with Known codeHash, deprecated
   */
  Short = 0x01,
  /**
   * @deprecated
   * full version with hashType = "Data", deprecated
   */
  FullData = 0x02,
  /**
   * @deprecated
   * full version with hashType = "Type", deprecated
   */
  FullType = 0x04,
}

export const ADDRESS_BECH32_LIMIT = 1023;
