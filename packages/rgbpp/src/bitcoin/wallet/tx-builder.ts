import {
  AddressType,
  BtcApiUtxo,
  BtcApiUtxoParams,
  NetworkConfig,
  PublicKeyProvider,
  TxInputData,
  TxOutput,
  Utxo,
  UtxoSeal,
} from "../types/index.js";

import { BtcApiClient } from "../api/index.js";

import {
  deduplicateUtxoSeals,
  getAddressType,
  isOpReturnScriptPubkey,
  utxoToInputData,
} from "../utils/index.js";
import {
  BtcFeeEstimator,
  DEFAULT_VIRTUAL_SIZE_BUFFER,
} from "./fee-estimator.js";

/**
 * Handles BTC transaction building: input construction, UTXO collection,
 * fee estimation, and input/output balancing.
 *
 * Stateless with respect to wallet identity — receives dependencies via constructor.
 */
export class BtcTransactionBuilder {
  private feeEstimator: BtcFeeEstimator;

  constructor(
    private apiClient: BtcApiClient,
    private networkConfig: NetworkConfig,
    private publicKeyProvider: PublicKeyProvider,
    private getAddress: () => Promise<string>,
  ) {
    this.feeEstimator = new BtcFeeEstimator();
  }

  async buildInputs(utxoSeals: UtxoSeal[]): Promise<TxInputData[]> {
    const uniqueSeals = deduplicateUtxoSeals(utxoSeals);

    if (uniqueSeals.length < utxoSeals.length) {
      console.warn(
        `[BtcTransactionBuilder] Removed ${utxoSeals.length - uniqueSeals.length} duplicate UTXO(s) from inputs`,
      );
    }

    const inputs: TxInputData[] = [];
    // TODO: parallel
    for (const utxoSeal of uniqueSeals) {
      const tx = await this.apiClient.getTransaction(utxoSeal.txId);
      if (!tx) {
        throw new Error(
          `Transaction ${utxoSeal.txId} not found. The referenced UTXO may not exist or the API may be unavailable.`,
        );
      }
      const vout = tx.vout[utxoSeal.index];
      if (!vout) {
        throw new Error(
          `Output index ${utxoSeal.index} not found in transaction ${utxoSeal.txId} (tx has ${tx.vout.length} outputs).`,
        );
      }

      const scriptBuffer = Buffer.from(vout.scriptpubkey, "hex");
      if (isOpReturnScriptPubkey(scriptBuffer)) {
        throw new Error(
          `Output ${utxoSeal.index} of transaction ${utxoSeal.txId} is an OP_RETURN output, which is unspendable. ` +
            `RGBPP lock args should not reference OP_RETURN outputs.`,
        );
      }

      inputs.push(
        await utxoToInputData(
          {
            txid: utxoSeal.txId,
            vout: utxoSeal.index,
            value: vout.value,
            scriptPk: vout.scriptpubkey,
            address: vout.scriptpubkey_address,
            addressType: getAddressType(vout.scriptpubkey_address),
          } as Utxo,
          this.publicKeyProvider,
        ),
      );
    }
    return inputs;
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

      // Estimate fee assuming we will need a dummy change output
      const dummyChangeOutput = {
        address: await this.getAddress(),
        value: 0,
      };

      const requiredFeeWithChange = await this.estimateFee(
        ins,
        [...outputs, dummyChangeOutput],
        feeRate,
      );
      const requiredFeeWithoutChange = await this.estimateFee(
        ins,
        outputs,
        feeRate,
      );

      if (
        insValue >
        outsValue + requiredFeeWithChange + this.networkConfig.btcDustLimit
      ) {
        // We have enough to create a change output
        changeValue = insValue - outsValue - requiredFeeWithChange;
        fulfilled = true;
      } else if (insValue >= outsValue + requiredFeeWithoutChange) {
        // We have enough to cover the fee without change output, but not enough to create a change output
        // The remaining value will just go to miners as fee
        changeValue = 0;
        fulfilled = true;
      } else {
        const { inputs: extraInputs } = await this.collectUtxos(
          outsValue +
            requiredFeeWithChange +
            this.networkConfig.btcDustLimit -
            insValue,
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
    const utxos = await this.apiClient.getUtxos(
      await this.getAddress(),
      params,
    );

    let filteredUtxos = utxos;
    if (knownInputs) {
      filteredUtxos = utxos.filter((utxo: BtcApiUtxo) => {
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
   * Estimate transaction fee without requiring actual signing.
   * This avoids triggering wallet confirmation dialogs for fee estimation.
   */
  async estimateFee(
    inputs: TxInputData[],
    outputs: TxOutput[],
    feeRate?: number,
  ) {
    const totalInputValue = inputs.reduce(
      (acc, input) => acc + input.witnessUtxo.value,
      0,
    );
    const totalOutputValue = outputs.reduce(
      (acc, output) => acc + output.value,
      0,
    );

    let balancedInputs = [...inputs];
    if (totalInputValue < totalOutputValue) {
      const address = await this.getAddress();
      const addressType = getAddressType(address);
      const dummyInput = {
        witnessUtxo: { value: 0, script: Buffer.alloc(0) },
      } as unknown as TxInputData;

      if (addressType === AddressType.P2TR) {
        dummyInput.tapInternalKey = Buffer.alloc(32);
      } else if (addressType === AddressType.P2WPKH) {
        const script = Buffer.alloc(22);
        script[0] = 0x00;
        script[1] = 0x14;
        dummyInput.witnessUtxo.script = script;
      } else if (addressType === AddressType.P2WSH) {
        const script = Buffer.alloc(34);
        script[0] = 0x00;
        script[1] = 0x20;
        dummyInput.witnessUtxo.script = script;
      }
      balancedInputs = [...inputs, dummyInput];
    }

    const virtualSize = this.feeEstimator.estimateVirtualSize(
      balancedInputs,
      outputs,
    );
    const bufferedVirtualSize = virtualSize + DEFAULT_VIRTUAL_SIZE_BUFFER;

    if (!feeRate) {
      try {
        feeRate = (await this.apiClient.getRecommendedFee()).fastestFee;
      } catch (error) {
        feeRate = this.networkConfig.btcFeeRate;
        console.warn(
          `Failed to get recommended fee rate: ${String(error)}, using default fee rate ${this.networkConfig.btcFeeRate}`,
        );
      }
    }

    return Math.ceil(
      bufferedVirtualSize * (feeRate ?? this.networkConfig.btcFeeRate),
    );
  }
}
