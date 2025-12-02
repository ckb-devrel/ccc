import * as bitcoin from "bitcoinjs-lib";
import { Psbt, Transaction } from "bitcoinjs-lib";

import { ccc } from "@ckb-ccc/core";

import {
  addressToScriptPublicKeyHex,
  BtcAccount,
  createBtcAccount,
  toXOnly,
  tweakSigner,
} from "../../index.js";
import { BtcAssetApiConfig } from "../../types/btc-assets-api.js";
import { AddressType } from "../../types/tx.js";

import { NetworkConfig } from "../../../types/network.js";
import { RgbppBtcWallet } from "../wallet.js";

export class PrivateKeyRgbppBtcWallet extends RgbppBtcWallet {
  private account: BtcAccount;

  constructor(
    privateKey: string,
    addressType: AddressType,
    protected networkConfig: NetworkConfig,
    btcAssetApiConfig: BtcAssetApiConfig,
  ) {
    super(networkConfig, btcAssetApiConfig);
    this.account = createBtcAccount(
      privateKey,
      addressType,
      networkConfig.name,
    );
  }

  async getAddress(): Promise<string> {
    return this.account.from;
  }

  /**
   * Format SignPsbtOptions to actual inputs that need to be signed
   * @private
   */
  private formatOptionsToSignInputs(
    psbt: Psbt,
    options?: ccc.SignPsbtOptions,
  ): Array<{ index: number; disableTweakSigner?: boolean }> {
    const account = this.account;
    const accountScript = addressToScriptPublicKeyHex(
      account.from,
      account.networkType,
    );

    // If options are provided, validate and use them
    if (options?.toSignInputs && options.toSignInputs.length > 0) {
      return options.toSignInputs.map((input: ccc.ToSignInput) => {
        const index = Number(input.index);
        if (isNaN(index)) {
          throw new Error("Invalid index in toSignInput");
        }

        // Validate address if provided
        if (input.address && input.address !== account.from) {
          throw new Error(
            `Invalid address in toSignInput. Expected ${account.from}, got ${input.address}`,
          );
        }

        // Validate pubkey if provided
        if (input.publicKey) {
          const fullPubkey = account.keyPair.publicKey.toString("hex");
          const xOnlyPubkey =
            account.addressType === AddressType.P2TR
              ? toXOnly(account.keyPair.publicKey).toString("hex")
              : fullPubkey;

          // Accept both full pubkey and x-only pubkey for Taproot
          if (input.publicKey !== fullPubkey && input.publicKey !== xOnlyPubkey) {
            throw new Error(
              `Invalid public key in toSignInput. Expected ${fullPubkey} or ${xOnlyPubkey}, got ${input.publicKey}`,
            );
          }
        }

        return {
          index,
          disableTweakSigner: input.disableTweakSigner,
        };
      });
    }

    // If no options, auto-detect inputs that match this account
    const toSignInputs: Array<{ index: number; disableTweakSigner?: boolean }> =
      [];

    psbt.data.inputs.forEach((input, index) => {
      let script: Buffer | null = null;

      // Get script from witnessUtxo or nonWitnessUtxo
      if (input.witnessUtxo) {
        script = input.witnessUtxo.script;
      } else if (input.nonWitnessUtxo) {
        const tx = bitcoin.Transaction.fromBuffer(input.nonWitnessUtxo);
        const outputIndex = psbt.txInputs[index].index;
        if (outputIndex >= tx.outs.length) {
          throw new Error(
            `Invalid PSBT: input ${index} references output ${outputIndex}, but transaction only has ${tx.outs.length} outputs`,
          );
        }
        const output = tx.outs[outputIndex];
        script = output.script;
      }

      // Check if already signed
      const isSigned =
        input.finalScriptSig ||
        input.finalScriptWitness ||
        input.tapKeySig ||
        (input.partialSig && input.partialSig.length > 0) ||
        (input.tapScriptSig && input.tapScriptSig.length > 0);

      // Only sign if script matches and not already signed
      if (script && !isSigned) {
        const inputScriptHex = script.toString("hex");
        if (inputScriptHex === accountScript) {
          toSignInputs.push({ index });
        }
      }
    });

    // If no matching inputs found, do NOT sign any inputs
    // This prevents accidentally signing inputs that don't belong to this account
    if (toSignInputs.length === 0) {
      // Don't throw error, just return empty array
      // This allows the PSBT to pass through without signing
    }

    return toSignInputs;
  }

  async signPsbt(
    psbt: Psbt,
    options?: ccc.SignPsbtOptions,
  ): Promise<Transaction> {
    const account = this.account;
    const tweaked = tweakSigner(account.keyPair, {
      network: account.payment.network,
    });

    // Get inputs to sign based on options
    const toSignInputs = this.formatOptionsToSignInputs(psbt, options);

    // Sign each input
    for (const { index, disableTweakSigner } of toSignInputs) {
      const input = psbt.data.inputs[index];
      if (!input) {
        throw new Error(`Input at index ${index} not found`);
      }

      // Determine which signer to use
      let signer: bitcoin.Signer;
      if (account.addressType === AddressType.P2TR) {
        // For Taproot, use tweaked signer unless disabled
        signer = disableTweakSigner ? account.keyPair : tweaked;
      } else {
        // For other address types (P2WPKH, etc), use regular keyPair
        signer = account.keyPair;
      }

      // Sign the input
      try {
        psbt.signInput(index, signer);
      } catch (error) {
        throw new Error(
          `Failed to sign input ${index}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Finalize if autoFinalized is not explicitly false
    const autoFinalize = options?.autoFinalized ?? true;
    if (autoFinalize) {
      psbt.finalizeAllInputs();
      return psbt.extractTransaction(true);
    } else {
      // For multi-sig scenarios, return a partial transaction
      // Note: This will throw if you try to broadcast it
      try {
        return psbt.extractTransaction(false);
      } catch {
        throw new Error("Cannot extract transaction from incomplete PSBT. ");
      }
    }
  }

  async sendTx(tx: Transaction): Promise<string> {
    const txHex = tx.toHex();
    return this.sendTransaction(txHex);
  }

  async signAndBroadcast(
    psbt: Psbt,
    options?: ccc.SignPsbtOptions,
  ): Promise<string> {
    // Always finalize for signAndBroadcast
    const finalOptions: ccc.SignPsbtOptions = {
      ...options,
      autoFinalized: true, // Force finalization
      toSignInputs: options?.toSignInputs || [],
    };

    const tx = await this.signPsbt(psbt, finalOptions);
    return this.sendTx(tx);
  }
}
