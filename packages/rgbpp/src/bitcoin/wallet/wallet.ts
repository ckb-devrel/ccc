import { Psbt, Transaction } from "bitcoinjs-lib";

import { ccc } from "@ckb-ccc/core";

import {
  btcTxIdInReverseByteOrder,
  buildBtcRgbppOutputs,
  calculateCommitment,
  isSameScriptTemplate,
  parseUtxoSealFromScriptArgs,
  pseudoRgbppLockArgs,
  pseudoRgbppLockArgsForCommitment,
  retryWithBackoff,
  u32ToHex,
} from "../../utils/index.js";
import { RetryOptions } from "../../utils/retry.js";

import {
  BLANK_TX_ID,
  BTC_TX_PSEUDO_INDEX,
  TX_ID_PLACEHOLDER,
} from "../../constants/index.js";

import { UtxoSeal } from "../../types/rgbpp/rgbpp.js";

import { BtcAssetsApiBase } from "../service/base.js";
import { BtcAssetApiConfig } from "../types/btc-assets-api.js";
import { RgbppBtcTxParams } from "../types/rgbpp.js";
import {
  BtcApiBalance,
  BtcApiBalanceParams,
  BtcApiRecommendedFeeRates,
  BtcApiSentTransaction,
  BtcApiTransaction,
  BtcApiTransactionHex,
  BtcApiUtxo,
  BtcApiUtxoParams,
  TxInputData,
  TxOutput,
  Utxo,
  UtxoSealOptions,
} from "../types/tx.js";
import {
  getAddressType,
  isOpReturnScriptPubkey,
  toBtcNetwork,
  utxoToInputData,
} from "../utils/index.js";
import { transactionToHex } from "./pk/account.js";

import { NetworkConfig } from "../../types/network.js";
import { RgbppApiSpvProof } from "../../types/spv.js";

const DEFAULT_VIRTUAL_SIZE_BUFFER = 20;

export abstract class RgbppBtcWallet extends BtcAssetsApiBase {
  constructor(
    protected networkConfig: NetworkConfig,
    btcAssetApiConfig: BtcAssetApiConfig,
  ) {
    super(btcAssetApiConfig);
  }

  abstract getAddress(): Promise<string>;

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
        return parseUtxoSealFromScriptArgs(input.cellOutput!.lock.args);
      }),
    );

    const inputs = await this.buildInputs(utxoSeals);

    // adjust index in rgbpp lock args of outputs
    let rgbppIndex = 0;
    const commitmentOutputs: ccc.CellOutput[] = [];
    const indexedOutputs: ccc.CellOutput[] = [];
    for (const output of ckbPartialTx.outputs) {
      if (
        isSameScriptTemplate(
          output.lock,
          rgbppUdtClient.rgbppLockScriptTemplate(),
        )
      ) {
        indexedOutputs.push(
          ccc.CellOutput.from({
            ...output,
            lock: {
              ...output.lock,
              args: output.lock.args.replace(
                u32ToHex(BTC_TX_PSEUDO_INDEX, true),
                u32ToHex(rgbppIndex + 1, true),
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
      } else if (
        isSameScriptTemplate(
          output.lock,
          rgbppUdtClient.btcTimeLockScriptTemplate(),
        )
      ) {
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

    const rgbppOutputs = buildBtcRgbppOutputs(
      commitmentTx,
      btcChangeAddress,
      receiverBtcAddresses,
      this.networkConfig.btcDustLimit,
      rgbppUdtClient,
    );

    const { balancedInputs, balancedOutputs } = await this.balanceInputsOutputs(
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

  async buildInputs(utxoSeals: UtxoSeal[]): Promise<TxInputData[]> {
    const inputs: TxInputData[] = [];
    // TODO: parallel
    for (const utxoSeal of utxoSeals) {
      const tx = await this.getTransaction(utxoSeal.txId);
      if (!tx) {
        continue;
      }
      const vout = tx.vout[utxoSeal.index];
      if (!vout) {
        continue;
      }

      const scriptBuffer = Buffer.from(vout.scriptpubkey, "hex");
      if (isOpReturnScriptPubkey(scriptBuffer)) {
        inputs.push(
          utxoToInputData({
            txid: utxoSeal.txId,
            vout: utxoSeal.index,
            value: vout.value,
            scriptPk: vout.scriptpubkey,
          } as Utxo),
        );
        continue;
      }

      inputs.push(
        utxoToInputData({
          txid: utxoSeal.txId,
          vout: utxoSeal.index,
          value: vout.value,
          scriptPk: vout.scriptpubkey,
          address: vout.scriptpubkey_address,
          addressType: getAddressType(vout.scriptpubkey_address),
        } as Utxo),
      );
    }
    return inputs;
  }

  rawTxHex(tx: Transaction): string {
    return transactionToHex(tx, false);
  }

  async balanceInputsOutputs(
    inputs: TxInputData[],
    outputs: TxOutput[],
    btcUtxoParams?: BtcApiUtxoParams,
    feeRate?: number,
  ): Promise<{
    balancedInputs: TxInputData[];
    balancedOutputs: TxOutput[];
  }> {
    let ins = inputs.slice();

    let fulfilled = false;
    let changeValue = 0;
    const outsValue = outputs.reduce((acc, output) => acc + output.value, 0);

    while (!fulfilled) {
      const insValue = ins.reduce(
        (acc, input) => acc + input.witnessUtxo.value,
        0,
      );
      const requiredFee = await this.estimateFee(ins, outputs, feeRate);

      if (insValue > outsValue + requiredFee) {
        changeValue = insValue - outsValue - requiredFee;
        fulfilled = true;
      } else {
        const { inputs: extraInputs } = await this.collectUtxos(
          outsValue + requiredFee - insValue,
          btcUtxoParams ?? {
            only_non_rgbpp_utxos: true,
          },
          ins,
        );
        ins = [...ins, ...extraInputs];
      }
    }

    if (changeValue >= this.networkConfig.btcDustLimit) {
      outputs.push({
        address: await this.getAddress(),
        value: changeValue,
      });
    }

    return {
      balancedInputs: ins,
      balancedOutputs: outputs,
    };
  }

  async collectUtxos(
    requiredValue: number,
    params?: BtcApiUtxoParams,
    knownInputs?: TxInputData[],
  ): Promise<{ inputs: TxInputData[]; changeValue: number }> {
    const utxos = await this.getUtxos(await this.getAddress(), params);

    let filteredUtxos = utxos;
    if (knownInputs) {
      filteredUtxos = utxos.filter((utxo) => {
        return !knownInputs.some(
          (input) => input.hash === utxo.txid && input.index === utxo.vout,
        );
      });
    }

    if (filteredUtxos.length === 0) {
      throw new Error("Insufficient funds");
    }

    const selectedUtxos: BtcApiUtxo[] = [];
    let totalValue = 0;

    for (const utxo of filteredUtxos) {
      selectedUtxos.push(utxo);
      totalValue += utxo.value;

      if (totalValue >= requiredValue) {
        break;
      }
    }

    if (totalValue < requiredValue) {
      throw new Error(
        `Insufficient funds: needed ${requiredValue}, but only found ${totalValue}`,
      );
    }

    return {
      inputs: await this.buildInputs(
        selectedUtxos.map((utxo) => ({
          txId: utxo.txid,
          index: utxo.vout,
        })),
      ),
      changeValue: totalValue - requiredValue,
    };
  }

  /**
   * Estimate transaction fee without requiring actual signing
   * This avoids triggering wallet confirmation dialogs for fee estimation
   */
  async estimateFee(
    inputs: TxInputData[],
    outputs: TxOutput[],
    feeRate?: number,
  ) {
    // Ensure we have enough inputs to cover outputs
    let totalInputValue = inputs.reduce(
      (acc, input) => acc + input.witnessUtxo.value,
      0,
    );
    const totalOutputValue = outputs.reduce(
      (acc, output) => acc + output.value,
      0,
    );

    let balancedInputs = [...inputs];
    if (totalInputValue < totalOutputValue) {
      const { inputs: extraInputs } = await this.collectUtxos(
        totalOutputValue - totalInputValue,
        {
          only_non_rgbpp_utxos: false,
          min_satoshi: 1000,
        },
      );
      balancedInputs = [...inputs, ...extraInputs];
    }

    // Estimate transaction size based on input/output types without signing
    const virtualSize = this.estimateVirtualSize(balancedInputs, outputs);
    const bufferedVirtualSize = virtualSize + DEFAULT_VIRTUAL_SIZE_BUFFER;

    if (!feeRate) {
      try {
        feeRate = (await this.getRecommendedFee()).fastestFee;
      } catch (error) {
        feeRate = this.networkConfig.btcFeeRate;
        console.warn(
          `Failed to get recommended fee rate: ${String(error)}, using default fee rate ${this.networkConfig.btcFeeRate}`,
        );
      }
    }

    return Math.ceil(bufferedVirtualSize * feeRate);
  }

  /**
   * Estimate virtual size of a transaction
   * Based on Bitcoin transaction structure and different address types
   */
  private estimateVirtualSize(
    inputs: TxInputData[],
    outputs: TxOutput[],
  ): number {
    // Base transaction size (version + locktime + input count + output count)
    let baseSize =
      4 +
      4 +
      this.getVarIntSize(inputs.length) +
      this.getVarIntSize(outputs.length);

    // Calculate input sizes
    let witnessSize = 0;
    for (const input of inputs) {
      // Each input: txid (32) + vout (4) + scriptSig length + scriptSig + sequence (4)
      baseSize += 32 + 4 + 4; // txid + vout + sequence

      // Determine address type from the input
      const addressType = this.getInputAddressType(input);

      switch (addressType) {
        case "P2WPKH":
          // P2WPKH: scriptSig is empty, witness has 2 items (signature + pubkey)
          baseSize += 1; // empty scriptSig
          witnessSize += 1 + 1 + 72 + 1 + 33; // witness stack count + sig length + sig + pubkey length + pubkey
          break;
        case "P2TR":
          // P2TR: scriptSig is empty, witness has 1 item (signature)
          baseSize += 1; // empty scriptSig
          witnessSize += 1 + 1 + 64; // witness stack count + sig length + sig
          break;
        case "P2PKH":
          // P2PKH: scriptSig has signature + pubkey, no witness
          baseSize += 1 + 72 + 33; // scriptSig length + sig + pubkey
          break;
        default:
          // Default estimation for unknown types
          baseSize += 1 + 107; // average scriptSig size
          break;
      }
    }

    // Calculate output sizes
    for (const output of outputs) {
      // Each output: value (8) + scriptPubKey length + scriptPubKey
      baseSize += 8; // value

      if ("address" in output && output.address) {
        const addressType = this.getOutputAddressType(output.address);
        switch (addressType) {
          case "P2WPKH":
            baseSize += 1 + 22; // length + scriptPubKey
            break;
          case "P2TR":
            baseSize += 1 + 34; // length + scriptPubKey
            break;
          case "P2PKH":
            baseSize += 1 + 25; // length + scriptPubKey
            break;
          default:
            baseSize += 1 + 25; // default size
            break;
        }
      } else if ("script" in output && output.script) {
        // For script outputs, use the actual script length
        baseSize +=
          this.getVarIntSize(output.script.length) + output.script.length;
      } else {
        // Default for unknown output types
        baseSize += 1 + 25;
      }
    }

    // Add witness header if there are witness inputs
    if (witnessSize > 0) {
      witnessSize += 2; // witness marker + flag
    }

    // Calculate weight: base_size * 4 + witness_size
    const weight = baseSize * 4 + witnessSize;

    // Virtual size is weight / 4, rounded up
    return Math.ceil(weight / 4);
  }

  /**
   * Get the size of a variable integer
   */
  private getVarIntSize(value: number): number {
    if (value < 0xfd) return 1;
    if (value <= 0xffff) return 3;
    if (value <= 0xffffffff) return 5;
    return 9;
  }

  /**
   * Determine address type from input data
   */
  private getInputAddressType(input: TxInputData): string {
    // Check if it's a Taproot input
    if (input.tapInternalKey) {
      return "P2TR";
    }

    // Check if it has witness data (P2WPKH or P2WSH)
    if (input.witnessUtxo) {
      const script = input.witnessUtxo.script;
      if (script.length === 22 && script[0] === 0x00 && script[1] === 0x14) {
        return "P2WPKH";
      }
      if (script.length === 34 && script[0] === 0x00 && script[1] === 0x20) {
        return "P2WSH";
      }
    }

    // Default to P2PKH for legacy inputs
    return "P2PKH";
  }

  /**
   * Determine address type from output address
   */
  private getOutputAddressType(address: string): string {
    if (
      address.startsWith("bc1p") ||
      address.startsWith("tb1p") ||
      address.startsWith("bcrt1p")
    ) {
      return "P2TR";
    }
    if (
      address.startsWith("bc1") ||
      address.startsWith("tb1") ||
      address.startsWith("bcrt1")
    ) {
      return "P2WPKH";
    }
    if (address.startsWith("3") || address.startsWith("2")) {
      return "P2SH";
    }
    return "P2PKH";
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

    const outputs = [
      {
        address: await this.getAddress(),
        value: targetValue,
      },
    ];

    const utxos = await this.getUtxos(await this.getAddress(), btcUtxoParams);
    if (utxos.length === 0) {
      throw new Error("Insufficient funds");
    }
    const inputs = await this.buildInputs([
      {
        txId: utxos[0].txid,
        index: utxos[0].vout,
      },
    ]);

    const { balancedInputs, balancedOutputs } = await this.balanceInputsOutputs(
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

    const txId = await this.signAndBroadcast(psbt);

    // Wait for transaction to be indexed by API with retry mechanism
    let btcTx = await retryWithBackoff(
      () => this.getTransaction(txId),
      {
        maxRetries: retryOptions?.maxRetries,
        initialDelay: retryOptions?.initialDelay,
      },
    );

    // Wait for confirmation
    while (!btcTx.status.confirmed) {
      console.log(
        `[prepareUtxoSeal] Transaction ${txId} not confirmed, waiting 30 seconds...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
      btcTx = await this.getTransaction(txId);
    }

    return {
      txId,
      index: 0,
    };
  }

  getTransaction(txId: string) {
    return this.request<BtcApiTransaction>(`/bitcoin/v1/transaction/${txId}`);
  }

  async getTransactionHex(txId: string) {
    const { hex } = await this.request<BtcApiTransactionHex>(
      `/bitcoin/v1/transaction/${txId}/hex`,
    );
    return hex;
  }

  getUtxos(address: string, params?: BtcApiUtxoParams) {
    return this.request<BtcApiUtxo[]>(
      `/bitcoin/v1/address/${address}/unspent`,
      {
        params,
      },
    );
  }

  /**
   * Get the balance of a Bitcoin address
   * @param address The Bitcoin address
   * @param params Optional parameters for balance query
   * @returns Balance information including total, available, pending, dust, and RGB++ satoshi amounts
   */
  getBalance(address: string, params?: BtcApiBalanceParams) {
    return this.request<BtcApiBalance>(
      `/bitcoin/v1/address/${address}/balance`,
      {
        params,
      },
    );
  }

  async getRgbppSpvProof(btcTxId: string, confirmations: number) {
    const spvProof: RgbppApiSpvProof | null =
      await this.request<RgbppApiSpvProof>("/rgbpp/v1/btc-spv/proof", {
        params: {
          btc_txid: btcTxId,
          confirmations,
        },
      });

    return spvProof
      ? {
          proof: spvProof.proof as ccc.Hex,
          spvClientOutpoint: ccc.OutPoint.from({
            txHash: spvProof.spv_client.tx_hash,
            index: spvProof.spv_client.index,
          }),
        }
      : null;
  }

  getRecommendedFee() {
    return this.request<BtcApiRecommendedFeeRates>(
      `/bitcoin/v1/fees/recommended`,
    );
  }

  async sendTransaction(txHex: string): Promise<string> {
    const { txid: txId } = await this.post<BtcApiSentTransaction>(
      "/bitcoin/v1/transaction",
      {
        body: JSON.stringify({
          txhex: txHex,
        }),
      },
    );
    return txId;
  }

  async getRgbppCellOutputs(btcAddress: string) {
    const res = await this.request<{ cellOutput: ccc.CellOutput }[]>(
      `/rgbpp/v1/address/${btcAddress}/assets`,
    );

    return res.map((item) => item.cellOutput);
  }
}
