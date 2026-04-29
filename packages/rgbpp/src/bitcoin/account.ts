import * as ecc from "@bitcoinerlab/secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";

import { ccc } from "@ckb-ccc/core";

import { ErrorBtcUnsupportedAddressType } from "../error.js";
import { removeHexPrefix } from "../utils/index.js";
import {
  AddressType,
  isSupportedAddressType,
  SUPPORTED_ADDRESS_TYPES,
} from "./address.js";
import { toBtcNetwork } from "./network.js";
import { toXOnly } from "./public-key.js";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

export interface BtcAccount {
  from: string;
  fromPubkey?: string;
  keyPair: bitcoin.Signer;
  payment: bitcoin.Payment;
  addressType: AddressType;
  networkType: string;
}

export function createBtcAccount(
  privateKey: string,
  addressType: AddressType,
  networkType: string,
): BtcAccount {
  if (!isSupportedAddressType(addressType)) {
    throw new ErrorBtcUnsupportedAddressType(
      addressType,
      SUPPORTED_ADDRESS_TYPES,
    );
  }

  const network = toBtcNetwork(networkType);
  const key = ccc.bytesFrom(removeHexPrefix(privateKey));
  const keyPair = ECPair.fromPrivateKey(key, { network });

  if (addressType === AddressType.P2WPKH) {
    const p2wpkh = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network,
    });
    return {
      from: p2wpkh.address!,
      payment: p2wpkh,
      keyPair,
      addressType,
      networkType,
    };
  } else if (addressType === AddressType.P2TR) {
    const p2tr = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(keyPair.publicKey),
      network,
    });
    return {
      from: p2tr.address!,
      fromPubkey: ccc.bytesTo(keyPair.publicKey, "hex"),
      payment: p2tr,
      keyPair,
      addressType,
      networkType,
    };
  }

  throw new ErrorBtcUnsupportedAddressType(
    addressType,
    SUPPORTED_ADDRESS_TYPES,
  );
}

interface TweakableSigner extends bitcoin.Signer {
  privateKey?: Uint8Array;
}

export function tweakSigner<T extends TweakableSigner>(
  signer: T,
  options?: {
    network?: bitcoin.Network;
    tweakHash?: Uint8Array;
  },
): bitcoin.Signer {
  if (!signer.privateKey) {
    throw new Error("Private key is required for tweaking signer!");
  }

  let privateKey: Uint8Array = signer.privateKey;
  if (signer.publicKey[0] === 3) {
    privateKey = ecc.privateNegate(privateKey);
  }

  const tweakedPrivateKey = ecc.privateAdd(
    privateKey,
    tapTweakHash(toXOnly(signer.publicKey), options?.tweakHash),
  );
  if (!tweakedPrivateKey) {
    throw new Error("Invalid tweaked private key!");
  }

  return ECPair.fromPrivateKey(tweakedPrivateKey, {
    network: options?.network,
  });
}

function tapTweakHash(
  publicKey: Uint8Array,
  hash: Uint8Array | undefined,
): Uint8Array {
  return bitcoin.crypto.taggedHash(
    "TapTweak",
    hash ? new Uint8Array([...publicKey, ...hash]) : publicKey,
  );
}
