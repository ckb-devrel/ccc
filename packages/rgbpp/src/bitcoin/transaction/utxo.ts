import { ccc } from "@ckb-ccc/core";

import {
  AddressType,
  isSupportedAddressType,
  SUPPORTED_ADDRESS_TYPES,
} from "../address.js";
import { PublicKeyProvider, toXOnly } from "../public-key.js";
import { TxInputData } from "./transaction.js";

interface OutPoint {
  txid: string;
  vout: number;
}

export type UtxoSeal = OutPoint;

/**
 * Deduplicate UTXO seals based on txid and vout
 */
export function deduplicateUtxoSeals(utxoSeals: UtxoSeal[]): UtxoSeal[] {
  if (!utxoSeals || utxoSeals.length === 0) {
    return [];
  }

  const seen = new Map<string, UtxoSeal>();

  for (const seal of utxoSeals) {
    const normalizedTxId = seal.txid?.toLowerCase() ?? "";
    const key = `${normalizedTxId}:${seal.vout}`;

    if (!seen.has(key)) {
      seen.set(key, seal);
    }
  }

  return Array.from(seen.values());
}

import { BtcUtxoParams } from "../../data-source/index.js";

export interface UtxoSealOptions {
  targetValue?: number;
  feeRate?: number;
  btcUtxoParams?: BtcUtxoParams;
  /** Polling interval in milliseconds for waiting transaction confirmation (default: 30000) */
  confirmationPollInterval?: number;
}

export interface Output extends OutPoint {
  value: number;
  scriptPk: string;
}

export interface Utxo extends Output {
  addressType: AddressType;
  address: string;
  pubkey?: string;
}

/**
 * Convert UTXO to PSBT input data
 *
 * @param utxo - The UTXO to convert
 * @param publicKeyProvider - Optional provider to lookup public keys for P2TR addresses
 * @returns PSBT input data
 *
 * @throws Error if address type is unsupported or public key is missing for P2TR
 */
export async function utxoToInputData(
  utxo: Utxo,
  publicKeyProvider?: PublicKeyProvider,
): Promise<TxInputData> {
  if (!isSupportedAddressType(utxo.addressType)) {
    throw new Error(
      `Unsupported address type, only support ${SUPPORTED_ADDRESS_TYPES.join(
        ", ",
      )}`,
    );
  }

  if (utxo.addressType === AddressType.P2WPKH) {
    const data = {
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        value: utxo.value,
        script: Buffer.from(ccc.bytesFrom(utxo.scriptPk)),
      },
    };
    return data;
  }

  if (utxo.addressType === AddressType.P2TR) {
    let pubkey = utxo.pubkey;

    if (!pubkey && publicKeyProvider) {
      pubkey = await publicKeyProvider.getPublicKey(
        utxo.address,
        utxo.addressType,
      );
    }

    if (!pubkey) {
      throw new Error(
        `Missing pubkey for P2TR address ${utxo.address}. ` +
          `Please provide a PublicKeyProvider or add pubkey to UTXO data.`,
      );
    }

    const data = {
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        value: utxo.value,
        script: Buffer.from(ccc.bytesFrom(utxo.scriptPk)),
      },
      tapInternalKey: toXOnly(Buffer.from(ccc.bytesFrom(pubkey))),
    };
    return data;
  }

  throw new Error("Unsupported address type");
}
