import { Psbt, Transaction } from "bitcoinjs-lib";

import { ccc } from "@ckb-ccc/shell";

import {
  btcTxIdInReverseByteOrder,
  buildBtcRgbppOutputs,
  calculateCommitment,
  isSameScriptTemplate,
  parseUtxoSealFromScriptArgs,
  pseudoRgbppLockArgs,
  pseudoRgbppLockArgsForCommitment,
  u32ToHex,
} from "../../utils/index.js";

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
import { transactionToHex } from "./privateKey/account.js";

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

  abstract signTx(psbt: Psbt): Promise<Transaction>;

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

  abstract sendTx(tx: Transaction): Promise<string>;

  rawTxHex(tx: Transaction): string {
    return transactionToHex(tx, false);
  }

  async signAndSendTx(psbt: Psbt): Promise<string> {
    const tx = await this.signTx(psbt);
    return this.sendTx(tx);
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

  // TODO: FIX THIS, in extension wallet case, a popup window will be shown to the user to confirm the transaction.
  // TODO: API for Sign & Pay
  async estimateFee(
    inputs: TxInputData[],
    outputs: TxOutput[],
    feeRate?: number,
  ) {
    // Create a temporary PSBT to calculate the fee
    const psbt = new Psbt({ network: toBtcNetwork(this.networkConfig.name) });
    inputs.forEach((input) => psbt.addInput(input));
    outputs.forEach((output) => psbt.addOutput(output));

    // * signTx will fail if inputs value is smaller than outputs value
    let totalInputValue = inputs.reduce(
      (acc, input) => acc + input.witnessUtxo.value,
      0,
    );
    const totalOutputValue = outputs.reduce(
      (acc, output) => acc + output.value,
      0,
    );
    if (totalInputValue < totalOutputValue) {
      const { inputs: extraInputs } = await this.collectUtxos(
        totalOutputValue - totalInputValue,
        {
          only_non_rgbpp_utxos: false,
          min_satoshi: 1000,
        },
      );
      extraInputs.forEach((input) => psbt.addInput(input));
    }

    const tx = await this.signTx(psbt);

    // Calculate virtual size
    const weightWithWitness = tx.byteLength(true);
    const weightWithoutWitness = tx.byteLength(false);
    const weight = weightWithoutWitness * 3 + weightWithWitness + tx.ins.length;
    const virtualSize = Math.ceil(weight / 4);
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

  async prepareUtxoSeal(options?: UtxoSealOptions): Promise<UtxoSeal> {
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

    // TODO: separate construction, signing, and sending
    const signedTx = await this.signTx(psbt);
    const txId = await this.sendTx(signedTx);
    console.log(`[prepareUtxoSeal] Transaction ${txId} sent`);

    let tx = await this.getTransaction(txId);
    while (!tx.status.confirmed) {
      console.log(
        `[prepareUtxoSeal] Transaction ${txId} not confirmed, waiting 30 seconds...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
      tx = await this.getTransaction(txId);
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
