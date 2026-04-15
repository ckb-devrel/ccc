import * as bitcoin from "bitcoinjs-lib";

import { ErrorBtcInvalidAddress } from "../error.js";
import { toBtcNetwork } from "./network.js";

// Read more about the available address types:
// - P2WPKH: https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki#p2wpkh
// - P2TR: https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki
export enum AddressType {
  P2PKH = "P2PKH",
  P2WPKH = "P2WPKH",
  P2TR = "P2TR",
  P2SH_P2WPKH = "P2SH_P2WPKH",
  P2WSH = "P2WSH",
  P2SH = "P2SH",
  UNKNOWN = "UNKNOWN",
}

export const SUPPORTED_ADDRESS_TYPES = [
  AddressType.P2WPKH,
  AddressType.P2TR,
] as const;

export function isSupportedAddressType(at: AddressType): boolean {
  return (SUPPORTED_ADDRESS_TYPES as readonly AddressType[]).includes(at);
}

export function addressToScriptPublicKeyHex(
  address: string,
  networkType: string,
): string {
  const network = toBtcNetwork(networkType);
  const script = bitcoin.address.toOutputScript(address, network);
  if (!script) {
    throw new Error("Invalid address!");
  }
  return script.toString("hex");
}

export function decodeAddress(address: string): {
  network: bitcoin.Network;
  addressType: AddressType;
} {
  const mainnet = bitcoin.networks.bitcoin;
  const testnet = bitcoin.networks.testnet;
  const regtest = bitcoin.networks.regtest;
  let decodeBase58: bitcoin.address.Base58CheckResult;
  let decodeBech32: bitcoin.address.Bech32Result;
  let network: bitcoin.Network | undefined;
  let addressType: AddressType | undefined;
  if (
    address.startsWith("bc1") ||
    address.startsWith("tb1") ||
    address.startsWith("bcrt1")
  ) {
    try {
      decodeBech32 = bitcoin.address.fromBech32(address);
      if (decodeBech32.prefix === mainnet.bech32) {
        network = mainnet;
      } else if (decodeBech32.prefix === testnet.bech32) {
        network = testnet;
      } else if (decodeBech32.prefix === regtest.bech32) {
        network = regtest;
      }
      if (decodeBech32.version === 0) {
        if (decodeBech32.data.length === 20) {
          addressType = AddressType.P2WPKH;
        } else if (decodeBech32.data.length === 32) {
          addressType = AddressType.P2WSH;
        }
      } else if (decodeBech32.version === 1) {
        if (decodeBech32.data.length === 32) {
          addressType = AddressType.P2TR;
        }
      }
      if (network !== undefined && addressType !== undefined) {
        return {
          network,
          addressType,
        };
      }
    } catch (_e) {
      // Do nothing (no need to throw here)
    }
  } else {
    try {
      decodeBase58 = bitcoin.address.fromBase58Check(address);
      if (decodeBase58.version === mainnet.pubKeyHash) {
        network = mainnet;
        addressType = AddressType.P2PKH;
      } else if (decodeBase58.version === testnet.pubKeyHash) {
        network = testnet;
        addressType = AddressType.P2PKH;
      } else if (decodeBase58.version === mainnet.scriptHash) {
        network = mainnet;
        addressType = AddressType.P2SH_P2WPKH;
      } else if (decodeBase58.version === testnet.scriptHash) {
        network = testnet;
        addressType = AddressType.P2SH_P2WPKH;
      }

      if (network !== undefined && addressType !== undefined) {
        return {
          network,
          addressType,
        };
      }
    } catch (_e) {
      // Do nothing (no need to throw here)
    }
  }

  throw new ErrorBtcInvalidAddress(address);
}

export function getAddressType(address: string): AddressType {
  return decodeAddress(address).addressType;
}

export function parseAddressType(
  addressType: AddressType | string,
): AddressType {
  if (typeof addressType === "string") {
    const type = AddressType[addressType as keyof typeof AddressType];
    if (!type) {
      throw new Error(`Invalid address type: ${addressType}`);
    }
    return type;
  }

  return addressType;
}
