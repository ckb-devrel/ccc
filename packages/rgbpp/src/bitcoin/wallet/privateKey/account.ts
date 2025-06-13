import ecc from "@bitcoinerlab/secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";

import { trimHexPrefix } from "../../../utils/index.js";
import { AddressType } from "../../types/tx.js";
import {
  isSupportedAddressType,
  SUPPORTED_ADDRESS_TYPES,
  toBtcNetwork,
  toXOnly,
} from "../../utils/index.js";

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
    throw new Error(
      `Unsupported address type, only support ${SUPPORTED_ADDRESS_TYPES.join(
        ", ",
      )}`,
    );
  }

  const network = toBtcNetwork(networkType);
  const key = Buffer.from(trimHexPrefix(privateKey), "hex");
  const keyPair = ECPair.fromPrivateKey(key, { network });

  if (addressType === AddressType.P2WPKH) {
    const p2wpkh = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(keyPair.publicKey),
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
      fromPubkey: keyPair.publicKey.toString("hex"),
      payment: p2tr,
      keyPair,
      addressType,
      networkType,
    };
  }

  throw new Error("Unsupported address type, only support P2WPKH and P2TR");
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

export function signPsbt(
  psbt: bitcoin.Psbt,
  account: BtcAccount,
): bitcoin.Psbt {
  const accountScript = addressToScriptPublicKeyHex(
    account.from,
    account.networkType,
  );
  const tweakedSigner = tweakSigner(account.keyPair, {
    network: account.payment.network,
  });

  psbt.data.inputs.forEach((input, index) => {
    if (input.witnessUtxo) {
      const script = input.witnessUtxo.script.toString("hex");
      if (
        script === accountScript &&
        account.addressType === AddressType.P2WPKH
      ) {
        psbt.signInput(index, account.keyPair);
      }
      if (
        script === accountScript &&
        account.addressType === AddressType.P2TR
      ) {
        psbt.signInput(index, tweakedSigner);
      }
    }
  });

  return psbt;
}

interface TweakableSigner extends bitcoin.Signer {
  privateKey?: Buffer;
}

export function tweakSigner<T extends TweakableSigner>(
  signer: T,
  options?: {
    network?: bitcoin.Network;
    tweakHash?: Buffer;
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

  return ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
    network: options?.network,
  });
}

function tapTweakHash(publicKey: Buffer, hash: Buffer | undefined): Buffer {
  return bitcoin.crypto.taggedHash(
    "TapTweak",
    Buffer.concat(hash ? [publicKey, hash] : [publicKey]),
  );
}

/**
 * Convert a bitcoin.Transaction to hex string.
 * Note if using for RGBPP proof, shouldn't set the "withWitness" param to "true".
 */
export function transactionToHex(
  tx: bitcoin.Transaction,
  withWitness?: boolean,
): string {
  const buffer: Buffer = tx["__toBuffer"](
    undefined,
    undefined,
    withWitness ?? false,
  );
  return buffer.toString("hex");
}
