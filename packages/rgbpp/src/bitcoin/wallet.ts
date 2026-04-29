import { sha256 } from "@noble/hashes/sha2";
import * as bitcoin from "bitcoinjs-lib";

import { ccc } from "@ckb-ccc/core";

import {
  ErrorRgbppInvalidCellLock,
  ErrorRgbppMaxCellExceeded,
  ErrorRgbppNoTypedOutput,
} from "../error.js";
import { Logger, RetryOptions, retryWithBackoff } from "../utils/index.js";

import {
  RGBPP_BTC_BLANK_TX_ID,
  RGBPP_BTC_TX_ID_PLACEHOLDER,
  RGBPP_BTC_TX_PSEUDO_INDEX,
  isSameScriptTemplate,
  parseUtxoSealFromRgbppLockArgs,
} from "../script/index.js";

import {
  BtcTransactionBuilder,
  BtcTransactionBuilderOptions,
  InitOutput,
  TxInputData,
  TxOutput,
  convertToOutput,
  transactionToHex,
} from "./transaction/index.js";

import {
  BtcDataProvider,
  BtcTransaction,
  BtcUtxoParams,
} from "../data-source/index.js";
import {
  btcTxIdInReverseByteOrder,
  isUsingOneOfScripts,
  pseudoRgbppLockArgs,
  pseudoRgbppLockArgsForCommitment,
} from "../script/index.js";
import { RgbppUdtClient } from "../udt/index.js";
import { removeHexPrefix } from "../utils/index.js";
import { BtcAccount, createBtcAccount, tweakSigner } from "./account.js";
import { AddressType, addressToScriptPublicKeyHex } from "./address.js";
import { NetworkConfig, toBtcNetwork } from "./network.js";
import {
  CachedPublicKeyProvider,
  CompositePublicKeyProvider,
  PublicKeyProvider,
  WalletPublicKeyProvider,
  toXOnly,
} from "./public-key.js";
/** Default polling interval in milliseconds for waiting transaction confirmation */
export const BTC_DEFAULT_CONFIRMATION_POLL_INTERVAL = 30_000;

/** Options for waiting for a BTC transaction to be confirmed */
export interface WaitForConfirmationOptions {
  /** Polling interval in milliseconds (default: 30000, minimum: 5000) */
  pollInterval?: number;
  /** Maximum time to wait in milliseconds (default: unlimited) */
  timeout?: number;
  /** AbortSignal to cancel the wait */
  signal?: AbortSignal;
  /** Retry options for initial transaction indexing (default: maxRetries=10, initialDelay=5) */
  retryOptions?: RetryOptions;
}

/** Parameters for building a seal UTXO PSBT */
export interface UtxoSealParams {
  /** Target UTXO value in satoshis (default: btcDustLimit) */
  targetValue?: number;
  /** Fee rate for the transaction */
  feeRate?: number;
  /** UTXO selection parameters */
  btcUtxoParams?: BtcUtxoParams;
}

/** Result of building a seal UTXO PSBT */
export interface UtxoSealPsbt {
  /** The constructed PSBT, ready to be signed */
  psbt: bitcoin.Psbt;
  /** The output index of the seal UTXO in the transaction */
  sealOutputIndex: number;
}

export interface RgbppBtcTxParams {
  ckbPartialTx: ccc.Transaction;
  ckbClient: ccc.Client;
  rgbppUdtClient: RgbppUdtClient;
  receiverBtcAddresses: string[];
  btcChangeAddress: string;
  btcUtxoParams?: BtcUtxoParams;
  feeRate?: number;
}

export interface RgbppBtcWalletOptions {
  btcTxBuilderOptions?: BtcTransactionBuilderOptions;
  logger?: Logger;
}

export abstract class RgbppBtcWallet {
  protected publicKeyProvider: PublicKeyProvider;
  protected txBuilder: BtcTransactionBuilder;
  private cachedPubKeyProvider: CachedPublicKeyProvider;

  constructor(
    protected networkConfig: NetworkConfig,
    protected dataSource: BtcDataProvider,
    protected options?: RgbppBtcWalletOptions,
  ) {
    // Initialize public key providers
    this.cachedPubKeyProvider = new CachedPublicKeyProvider();
    this.publicKeyProvider = new CompositePublicKeyProvider([
      this.cachedPubKeyProvider,
      new WalletPublicKeyProvider(this),
    ]);

    this.txBuilder = new BtcTransactionBuilder(
      this.dataSource,
      this.networkConfig,
      this.publicKeyProvider,
      () => this.getAddress(),
      {
        ...this.options?.btcTxBuilderOptions,
        logger: this.options?.logger,
      },
    );
  }

  get btcDataSource(): BtcDataProvider {
    return this.dataSource;
  }

  /**
   * Get the current wallet address
   */
  abstract getAddress(): Promise<string>;

  /**
   * Get the public key for the current wallet address
   * @returns Public key in hex format (33-byte compressed format)
   */
  abstract getPublicKey(): Promise<string>;

  /**
   * Register a public key for a specific address
   * This is useful when you need to spend UTXOs from addresses other than the current wallet
   *
   * @param address - Bitcoin address
   * @param publicKey - Public key in hex format (33-byte compressed or 32-byte x-only format)
   *
   * @example
   * ```typescript
   * // Register a public key for a service address
   * wallet.registerPublicKey(
   *   "bc1p_service_address_xxx",
   *   "02abc123..." // 33-byte compressed public key
   * );
   * ```
   */
  registerPublicKey(address: string, publicKey: string): void {
    this.cachedPubKeyProvider.addMapping(address, publicKey);
  }

  /**
   * Set a custom public key provider
   * This will replace the default composite provider
   *
   * @param provider - The public key provider to use
   */
  setPublicKeyProvider(provider: PublicKeyProvider): void {
    this.publicKeyProvider = provider;
  }

  private async buildBtcRgbppOutputs(
    ckbPartialTx: ccc.Transaction,
    btcChangeAddress: string,
    receiverBtcAddresses: string[],
    btcDustLimit: number,
    rgbppUdtClient: RgbppUdtClient,
  ): Promise<TxOutput[]> {
    const rgbppLockScriptTemplate =
      await rgbppUdtClient.rgbppLockScriptTemplate();
    const btcTimeLockScriptTemplate =
      await rgbppUdtClient.btcTimeLockScriptTemplate();

    const outputs: InitOutput[] = [];
    let lastCkbTypedOutputIndex = -1;
    ckbPartialTx.outputs.forEach((output, index) => {
      // If output.type is not null, then the output.lock must be RGB++ Lock or BTC Time Lock
      if (output.type) {
        if (
          !isUsingOneOfScripts(output.lock, [
            rgbppLockScriptTemplate,
            btcTimeLockScriptTemplate,
          ])
        ) {
          throw new ErrorRgbppInvalidCellLock(
            ["RgbppLock", "BtcTimeLock"],
            output.lock.codeHash,
          );
        }
        lastCkbTypedOutputIndex = index;
      }

      // If output.lock is RGB++ Lock, generate a corresponding output in outputs
      if (isSameScriptTemplate(output.lock, rgbppLockScriptTemplate)) {
        outputs.push({
          fixed: true,
          // Out-of-range index indicates this is a RGB++ change output returning to the BTC address
          address: receiverBtcAddresses[index] ?? btcChangeAddress,
          value: btcDustLimit,
          minUtxoSatoshi: btcDustLimit,
        });
      }
    });

    if (lastCkbTypedOutputIndex < 0) {
      throw new ErrorRgbppNoTypedOutput();
    }

    const rgbppPartialTx = ccc.Transaction.from({
      inputs: ckbPartialTx.inputs,
      outputs: ckbPartialTx.outputs.slice(0, lastCkbTypedOutputIndex + 1),
      outputsData: ckbPartialTx.outputsData.slice(
        0,
        lastCkbTypedOutputIndex + 1,
      ),
    });

    const commitment = calculateCommitment(rgbppPartialTx);

    // place the commitment as the first output
    outputs.unshift({
      data: commitment,
      value: 0,
      fixed: true,
    });

    return outputs.map((output) => convertToOutput(output));
  }

  /**
   * Assemble a PSBT from balanced inputs and outputs.
   * Shared helper used by buildPsbt and buildSealPsbt.
   */
  private assemblePsbt(
    balancedInputs: TxInputData[],
    balancedOutputs: TxOutput[],
  ): bitcoin.Psbt {
    const psbt = new bitcoin.Psbt({
      network: toBtcNetwork(this.networkConfig.name),
    });
    balancedInputs.forEach((input) => {
      psbt.data.addInput({
        ...input,
        witnessUtxo: {
          ...input.witnessUtxo,
          value: BigInt(input.witnessUtxo.value),
        },
      });
    });
    balancedOutputs.forEach((output) => {
      if ("address" in output) {
        psbt.addOutput({
          address: output.address,
          value: BigInt(output.value),
        });
      } else {
        psbt.addOutput({ script: output.script, value: BigInt(output.value) });
      }
    });
    return psbt;
  }

  async buildPsbt(
    params: RgbppBtcTxParams,
  ): Promise<{ psbt: bitcoin.Psbt; indexedCkbPartialTx: ccc.Transaction }> {
    const {
      ckbPartialTx,
      ckbClient,
      rgbppUdtClient,
      btcChangeAddress,
      receiverBtcAddresses,
      feeRate,
      btcUtxoParams,
    } = params;

    const commitmentTx = ckbPartialTx.clone();
    const indexedTx = ckbPartialTx.clone();

    const utxoSeals = await Promise.all(
      ckbPartialTx.inputs.map(async (input) => {
        await input.completeExtraInfos(ckbClient);
        return parseUtxoSealFromRgbppLockArgs(input.cellOutput!.lock.args);
      }),
    );

    const inputs = await this.txBuilder.buildInputs(utxoSeals);

    // Pre-fetch script templates for comparison
    const rgbppLockTemplate = await rgbppUdtClient.rgbppLockScriptTemplate();
    const btcTimeLockTemplate =
      await rgbppUdtClient.btcTimeLockScriptTemplate();

    // adjust index in rgbpp lock args of outputs
    let rgbppIndex = 0;
    const commitmentOutputs: ccc.CellOutput[] = [];
    const indexedOutputs: ccc.CellOutput[] = [];
    for (const output of ckbPartialTx.outputs) {
      if (isSameScriptTemplate(output.lock, rgbppLockTemplate)) {
        indexedOutputs.push(
          ccc.CellOutput.from({
            ...output,
            lock: {
              ...output.lock,
              args: output.lock.args.replace(
                ccc
                  .hexFrom(ccc.numLeToBytes(RGBPP_BTC_TX_PSEUDO_INDEX, 4))
                  .slice(2),
                ccc.hexFrom(ccc.numLeToBytes(rgbppIndex + 1, 4)).slice(2),
              ),
            },
          }),
        );
        commitmentOutputs.push(
          ccc.CellOutput.from({
            ...output,
            lock: {
              ...output.lock,
              args: output.lock.args.replace(
                pseudoRgbppLockArgs(),
                pseudoRgbppLockArgsForCommitment(rgbppIndex + 1),
              ),
            },
          }),
        );
        rgbppIndex++;
      } else if (isSameScriptTemplate(output.lock, btcTimeLockTemplate)) {
        indexedOutputs.push(output);
        commitmentOutputs.push(
          ccc.CellOutput.from({
            ...output,
            lock: {
              ...output.lock,
              args: output.lock.args.replace(
                btcTxIdInReverseByteOrder(RGBPP_BTC_TX_ID_PLACEHOLDER),
                btcTxIdInReverseByteOrder(RGBPP_BTC_BLANK_TX_ID),
              ),
            },
          }),
        );
      } else {
        indexedOutputs.push(output);
        commitmentOutputs.push(output);
      }
    }
    commitmentTx.outputs = commitmentOutputs;
    indexedTx.outputs = indexedOutputs;

    const rgbppOutputs = await this.buildBtcRgbppOutputs(
      commitmentTx,
      btcChangeAddress,
      receiverBtcAddresses,
      this.networkConfig.btcDustLimit,
      rgbppUdtClient,
    );

    const { balancedInputs, balancedOutputs } =
      await this.txBuilder.balanceInputsOutputs(
        inputs,
        rgbppOutputs,
        btcUtxoParams,
        feeRate,
      );

    const psbt = this.assemblePsbt(balancedInputs, balancedOutputs);

    return { psbt, indexedCkbPartialTx: indexedTx };
  }

  abstract signAndBroadcast(psbt: bitcoin.Psbt): Promise<string>;

  rawTxHex(tx: bitcoin.Transaction, withWitness: boolean = false): string {
    return transactionToHex(tx, withWitness);
  }

  isCommitmentMatched(
    commitment: string,
    ckbPartialTx: ccc.Transaction,
    lastCkbTypedOutputIndex: number,
  ): boolean {
    return (
      commitment ===
      calculateCommitment(
        ccc.Transaction.from({
          inputs: ckbPartialTx.inputs,
          outputs: ckbPartialTx.outputs.slice(0, lastCkbTypedOutputIndex + 1),
          outputsData: ckbPartialTx.outputsData.slice(
            0,
            lastCkbTypedOutputIndex + 1,
          ),
        }),
      )
    );
  }

  /**
   * Build a PSBT that creates a dust UTXO for use as an RGB++ seal.
   *
   * This only constructs the PSBT without signing or broadcasting.
   * Use this when you need custom signing flows.
   *
   * @returns The PSBT and the output index of the seal UTXO.
   */
  async buildSealPsbt(options?: UtxoSealParams): Promise<UtxoSealPsbt> {
    const targetValue = options?.targetValue ?? this.networkConfig.btcDustLimit;
    const feeRate = options?.feeRate ?? this.networkConfig.btcFeeRate;
    const btcUtxoParams = options?.btcUtxoParams ?? {
      only_non_rgbpp_utxos: true,
    };

    // The seal output is always the first output
    const sealOutputIndex = 0;
    const outputs = [
      {
        address: await this.getAddress(),
        value: targetValue,
      },
    ];

    const { inputs } = await this.txBuilder.collectUtxos(
      targetValue,
      btcUtxoParams,
    );

    const { balancedInputs, balancedOutputs } =
      await this.txBuilder.balanceInputsOutputs(
        inputs,
        outputs,
        btcUtxoParams,
        feeRate,
      );

    const psbt = this.assemblePsbt(balancedInputs, balancedOutputs);

    return { psbt, sealOutputIndex };
  }

  /**
   * Wait for a BTC transaction to be confirmed.
   *
   * Supports bounded polling with optional timeout and AbortSignal cancellation.
   *
   * @param txId - The transaction ID to wait for.
   * @param options - Polling, timeout, and cancellation options.
   * @returns The confirmed BTC transaction.
   *
   * @throws Error if timeout is reached or signal is aborted.
   */
  async waitForConfirmation(
    txId: string,
    options?: WaitForConfirmationOptions,
  ): Promise<BtcTransaction> {
    const pollInterval = Math.max(
      options?.pollInterval ?? BTC_DEFAULT_CONFIRMATION_POLL_INTERVAL,
      5_000,
    );
    const deadline = options?.timeout
      ? Date.now() + options.timeout
      : undefined;
    const logger = this.options?.logger;

    // Initial fetch with retry (transaction may not be indexed yet)
    let btcTx = await retryWithBackoff(
      () => this.dataSource.getTransaction(txId),
      {
        maxRetries: options?.retryOptions?.maxRetries ?? 10,
        initialDelay: options?.retryOptions?.initialDelay ?? 5,
      },
    );

    while (!btcTx.status.confirmed) {
      if (options?.signal?.aborted) {
        throw new Error(
          `[waitForConfirmation] Aborted while waiting for ${txId}`,
        );
      }
      if (deadline && Date.now() >= deadline) {
        throw new Error(
          `[waitForConfirmation] Timeout waiting for ${txId} confirmation after ${options!.timeout}ms`,
        );
      }

      logger?.info?.(
        `[waitForConfirmation] Transaction ${txId} not confirmed, waiting ${pollInterval / 1000}s...`,
      );

      await ccc.sleep(pollInterval);

      try {
        btcTx = await this.dataSource.getTransaction(txId);
      } catch (error) {
        logger?.warn?.(
          `[waitForConfirmation] Failed to get transaction ${txId}: ${String(error)}. Retrying...`,
        );
      }
    }

    return btcTx;
  }
}

export class RgbppPrivateKeyBtcWallet extends RgbppBtcWallet {
  private account: BtcAccount;

  constructor(
    privateKey: string,
    addressType: AddressType,
    networkConfig: NetworkConfig,
    dataSource: BtcDataProvider,
    options?: RgbppBtcWalletOptions,
  ) {
    super(networkConfig, dataSource, options);
    this.account = createBtcAccount(
      privateKey,
      addressType,
      networkConfig.name,
    );
  }

  async getAddress(): Promise<string> {
    return this.account.from;
  }

  async getPublicKey(): Promise<string> {
    return ccc.bytesTo(this.account.keyPair.publicKey, "hex");
  }

  /**
   * Format SignPsbtOptions to actual inputs that need to be signed
   * @private
   */
  private formatOptionsToSignInputs(
    psbt: bitcoin.Psbt,
    options?: ccc.SignPsbtOptionsLike,
  ): Array<{ index: number; disableTweakSigner?: boolean }> {
    const account = this.account;
    const accountScript = addressToScriptPublicKeyHex(
      account.from,
      account.networkType,
    );

    // If options are provided, validate and use them
    if (options?.inputsToSign && options.inputsToSign.length > 0) {
      return options.inputsToSign.map((input: ccc.InputToSignLike) => {
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
          const fullPubkey = ccc.bytesTo(account.keyPair.publicKey, "hex");
          const xOnlyPubkey =
            account.addressType === AddressType.P2TR
              ? ccc.bytesTo(toXOnly(account.keyPair.publicKey), "hex")
              : fullPubkey;
          const inputPubkeyStr = ccc
            .hexFrom(input.publicKey)
            .replace(/^0x/i, "");

          // Accept both full pubkey and x-only pubkey for Taproot
          if (inputPubkeyStr !== fullPubkey && inputPubkeyStr !== xOnlyPubkey) {
            throw new Error(
              `Invalid public key in toSignInput. Expected ${fullPubkey} or ${xOnlyPubkey}, got ${inputPubkeyStr}`,
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
      let script: Uint8Array | null = null;

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
        const inputScriptHex = ccc.bytesTo(script, "hex");
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
    psbt: bitcoin.Psbt,
    options?: ccc.SignPsbtOptionsLike,
  ): Promise<bitcoin.Transaction> {
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

  async sendTx(tx: bitcoin.Transaction): Promise<string> {
    const txHex = tx.toHex();
    return this.dataSource.sendTransaction(txHex);
  }

  async signAndBroadcast(
    psbt: bitcoin.Psbt,
    options?: ccc.SignPsbtOptionsLike,
  ): Promise<string> {
    // Always finalize for signAndBroadcast
    const finalOptions: ccc.SignPsbtOptionsLike = {
      ...options,
      autoFinalized: true, // Force finalization
      inputsToSign: options?.inputsToSign ?? [],
    };

    const tx = await this.signPsbt(psbt, finalOptions);
    return this.sendTx(tx);
  }
}

// TODO: add default btc asset api URL
export class RgbppBrowserBtcWallet extends RgbppBtcWallet {
  constructor(
    protected signer: ccc.SignerBtc,
    networkConfig: NetworkConfig,
    dataSource: BtcDataProvider,
    options?: RgbppBtcWalletOptions,
  ) {
    super(networkConfig, dataSource, options);
  }

  async getAddress(): Promise<string> {
    return this.signer.getBtcAccount();
  }

  async getPublicKey(): Promise<string> {
    const pubkey = await this.signer.getBtcPublicKey();
    const hexString: string =
      typeof pubkey === "string"
        ? pubkey
        : (pubkey as { toString(): string }).toString();
    return hexString.startsWith("0x") ? hexString.slice(2) : hexString;
  }

  async signAndBroadcast(
    psbt: bitcoin.Psbt,
    options?: ccc.SignPsbtOptionsLike,
  ): Promise<string> {
    return this.signer
      .signAndBroadcastPsbt(psbt.toHex(), options)
      .then((hex) => removeHexPrefix(hex));
  }
}

/**
 * Create a RgbppBrowserBtcWallet from a SignerBtc.
 *
 * TODO: Wallet capability validation (e.g. whether the signer fully implements
 * signAndBroadcastPsbt) should be enforced at the ccc.SignerBtc.
 */
export function createRgbppBrowserBtcWallet(
  signer: ccc.SignerBtc,
  networkConfig: NetworkConfig,
  dataSource: BtcDataProvider,
): RgbppBrowserBtcWallet {
  return new RgbppBrowserBtcWallet(signer, networkConfig, dataSource);
}

export const RGBPP_CKB_MAX_CELL = 255;

// The maximum length of inputs and outputs is 255, and the field type representing the length in the RGB++ protocol is Uint8
// refer to https://github.com/ckb-cell/rgbpp/blob/0c090b039e8d026aad4336395b908af283a70ebf/contracts/rgbpp-lock/src/main.rs#L173-L211
export const calculateCommitment = (ckbPartialTx: ccc.Transaction): string => {
  const hash = sha256.create();
  hash.update(ccc.bytesFrom("RGB++", "utf8"));
  const version = new Uint8Array([0, 0]);
  hash.update(version);

  const { inputs, outputs, outputsData } = ckbPartialTx;

  if (
    inputs.length > RGBPP_CKB_MAX_CELL ||
    outputs.length > RGBPP_CKB_MAX_CELL
  ) {
    throw new ErrorRgbppMaxCellExceeded(
      Math.max(inputs.length, outputs.length),
      RGBPP_CKB_MAX_CELL,
    );
  }
  hash.update(new Uint8Array([inputs.length, outputs.length]));

  for (const input of inputs) {
    hash.update(input.previousOutput.toBytes());
  }
  for (let index = 0; index < outputs.length; index++) {
    const outputData = outputsData[index];
    hash.update(outputs[index].toBytes());

    const od = ccc.bytesFrom(outputData);
    const outputDataLen = ccc.numLeToBytes(od.length, 4);
    hash.update(outputDataLen);
    hash.update(od);
  }
  // double sha256
  return ccc.bytesTo(sha256(hash.digest()), "hex");
};
