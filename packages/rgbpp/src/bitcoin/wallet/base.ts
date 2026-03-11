import { Psbt, Transaction } from "bitcoinjs-lib";

import { ccc } from "@ckb-ccc/core";

// TODO: re-arrange utils
import {
  btcTxIdInReverseByteOrder,
  buildBtcRgbppOutputs,
  calculateCommitment,
  isSameScriptTemplate,
  parseUtxoSealFromRgbppLockArgs,
  pseudoRgbppLockArgs,
  pseudoRgbppLockArgsForCommitment,
  RetryOptions,
  retryWithBackoff,
} from "../../utils/index.js";

import {
  BLANK_TX_ID,
  BTC_TX_PSEUDO_INDEX,
  DEFAULT_CONFIRMATION_POLL_INTERVAL,
  TX_ID_PLACEHOLDER,
} from "../constants.js";

import {
  NetworkConfig,
  PublicKeyProvider,
  RgbppBtcTxParams,
  UtxoSeal,
  UtxoSealOptions,
} from "../types/index.js";

import {
  BtcApiClient,
  BtcAssetApiConfig,
  BtcAssetsApiBase,
} from "../api/index.js";

import { toBtcNetwork, trimHexPrefix } from "../utils/index.js";
import { transactionToHex } from "./account.js";
import {
  CachedPublicKeyProvider,
  CompositePublicKeyProvider,
  WalletPublicKeyProvider,
} from "./public-key.js";
import { BtcTransactionBuilder } from "./tx-builder.js";

export abstract class RgbppBtcWallet {
  protected apiClient: BtcApiClient;
  protected networkConfig: NetworkConfig;
  protected publicKeyProvider: PublicKeyProvider;
  protected txBuilder: BtcTransactionBuilder;
  private cachedPubKeyProvider: CachedPublicKeyProvider;

  constructor(
    networkConfig: NetworkConfig,
    btcAssetApiConfig: BtcAssetApiConfig,
  ) {
    this.apiClient = new BtcApiClient(new BtcAssetsApiBase(btcAssetApiConfig));
    this.networkConfig = networkConfig;

    // Initialize public key providers
    this.cachedPubKeyProvider = new CachedPublicKeyProvider();
    this.publicKeyProvider = new CompositePublicKeyProvider([
      this.cachedPubKeyProvider,
      new WalletPublicKeyProvider(this),
    ]);

    // Initialize transaction builder with wallet dependencies
    this.txBuilder = new BtcTransactionBuilder(
      this.apiClient,
      this.networkConfig,
      this.publicKeyProvider,
      () => this.getAddress(),
    );
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

  async buildPsbt(
    params: RgbppBtcTxParams,
  ): Promise<{ psbt: Psbt; indexedCkbPartialTx: ccc.Transaction }> {
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
                ccc.hexFrom(ccc.numLeToBytes(BTC_TX_PSEUDO_INDEX, 4)).slice(2),
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
                btcTxIdInReverseByteOrder(TX_ID_PLACEHOLDER),
                btcTxIdInReverseByteOrder(BLANK_TX_ID),
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

    const rgbppOutputs = await buildBtcRgbppOutputs(
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

    const psbt = new Psbt({ network: toBtcNetwork(this.networkConfig.name) });
    balancedInputs.forEach((input) => {
      psbt.data.addInput(input);
    });
    balancedOutputs.forEach((output) => {
      psbt.addOutput(output);
    });

    return { psbt, indexedCkbPartialTx: indexedTx };
  }

  abstract signAndBroadcast(psbt: Psbt): Promise<string>;

  rawTxHex(tx: Transaction): string {
    return transactionToHex(tx, false);
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

  async prepareUtxoSeal(
    options?: UtxoSealOptions,
    retryOptions?: RetryOptions,
  ): Promise<UtxoSeal> {
    const targetValue = options?.targetValue ?? this.networkConfig.btcDustLimit;
    const feeRate = options?.feeRate ?? this.networkConfig.btcFeeRate;
    const btcUtxoParams = options?.btcUtxoParams ?? {
      only_non_rgbpp_utxos: true,
    };
    const confirmationPollInterval = Math.max(
      options?.confirmationPollInterval ?? DEFAULT_CONFIRMATION_POLL_INTERVAL,
      5_000,
    );

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
    const psbt = new Psbt({ network: toBtcNetwork(this.networkConfig.name) });
    balancedInputs.forEach((input) => {
      psbt.data.addInput(input);
    });
    balancedOutputs.forEach((output) => {
      psbt.addOutput(output);
    });

    const txId = trimHexPrefix(await this.signAndBroadcast(psbt));

    // Wait for transaction to be indexed by API with retry mechanism
    let btcTx = await retryWithBackoff(
      () => this.apiClient.getTransaction(txId),
      {
        maxRetries: retryOptions?.maxRetries,
        initialDelay: retryOptions?.initialDelay,
      },
    );

    // Wait for confirmation
    const intervalSeconds = confirmationPollInterval / 1000;
    while (!btcTx.status.confirmed) {
      console.log(
        `[prepareUtxoSeal] Transaction ${txId} not confirmed, waiting ${intervalSeconds} seconds...`,
      );
      await ccc.sleep(confirmationPollInterval);
      try {
        btcTx = await this.apiClient.getTransaction(txId);
      } catch (error) {
        console.warn(
          `[prepareUtxoSeal] Failed to get transaction ${txId}: ${String(error)}. Retrying...`,
        );
      }
    }

    return {
      txId,
      index: 0,
    };
  }
}
