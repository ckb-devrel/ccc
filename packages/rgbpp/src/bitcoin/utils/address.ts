import * as bitcoin from "bitcoinjs-lib";
import { AddressType } from "../types/address.js";
import { PredefinedNetwork } from "../types/network.js";

export enum NetworkType {
  MAINNET,
  TESTNET,
  REGTEST, // deprecated
}

export function decodeAddress(address: string): {
  networkType: NetworkType;
  addressType: AddressType;
} {
  const mainnet = bitcoin.networks.bitcoin;
  const testnet = bitcoin.networks.testnet;
  const regtest = bitcoin.networks.regtest;
  let decodeBase58: bitcoin.address.Base58CheckResult;
  let decodeBech32: bitcoin.address.Bech32Result;
  let networkType: NetworkType | undefined;
  let addressType: AddressType | undefined;
  if (
    address.startsWith("bc1") ||
    address.startsWith("tb1") ||
    address.startsWith("bcrt1")
  ) {
    try {
      decodeBech32 = bitcoin.address.fromBech32(address);
      if (decodeBech32.prefix === mainnet.bech32) {
        networkType = NetworkType.MAINNET;
      } else if (decodeBech32.prefix === testnet.bech32) {
        networkType = NetworkType.TESTNET;
      } else if (decodeBech32.prefix === regtest.bech32) {
        networkType = NetworkType.REGTEST;
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
      if (networkType !== undefined && addressType !== undefined) {
        return {
          networkType,
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
        networkType = NetworkType.MAINNET;
        addressType = AddressType.P2PKH;
      } else if (decodeBase58.version === testnet.pubKeyHash) {
        networkType = NetworkType.TESTNET;
        addressType = AddressType.P2PKH;
      } else if (decodeBase58.version === mainnet.scriptHash) {
        networkType = NetworkType.MAINNET;
        addressType = AddressType.P2SH_P2WPKH;
      } else if (decodeBase58.version === testnet.scriptHash) {
        networkType = NetworkType.TESTNET;
        addressType = AddressType.P2SH_P2WPKH;
      }

      if (networkType !== undefined && addressType !== undefined) {
        return {
          networkType,
          addressType,
        };
      }
    } catch (_e) {
      // Do nothing (no need to throw here)
    }
  }

  return {
    addressType: AddressType.UNKNOWN,
    networkType: NetworkType.MAINNET,
  };
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

export const SUPPORTED_ADDRESS_TYPES = [AddressType.P2WPKH, AddressType.P2TR];

export function isSupportedAddressType(at: AddressType): boolean {
  return SUPPORTED_ADDRESS_TYPES.includes(at);
}

export function toBtcNetwork(network: string): bitcoin.Network {
  return network === (PredefinedNetwork.BitcoinMainnet as string)
    ? bitcoin.networks.bitcoin
    : bitcoin.networks.testnet;
}
