import { ccc } from "@ckb-ccc/core";

import {
  BtcDataProvider,
  BtcUtxo,
  BtcUtxoParams,
} from "../../data-source/index.js";
import {
  ErrorBtcInsufficientFunds,
  ErrorBtcOpReturnUtxo,
  ErrorBtcTransactionNotFound,
  ErrorBtcUtxoNotFound,
} from "../../error.js";
import {
  mapWithConcurrency,
  RetryOptions,
  retryWithBackoff,
} from "../../utils/index.js";
import { AddressType, getAddressType } from "../address.js";
import { NetworkConfig } from "../network.js";
import { PublicKeyProvider } from "../public-key.js";
import {
  BtcFeeEstimator,
  DEFAULT_VIRTUAL_SIZE_BUFFER,
} from "./fee-estimator.js";
import { isOpReturnScriptPubkey } from "./script.js";
import { TxInputData, TxOutput } from "./transaction.js";
import {
  deduplicateUtxoSeals,
  Utxo,
  UtxoSeal,
  utxoToInputData,
} from "./utxo.js";

export interface BtcTransactionBuilderOptions {
  concurrency?: number;
  retryOptions?: RetryOptions;
}

/**
 * Handles BTC transaction building: input construction, UTXO collection,
 * fee estimation, and input/output balancing.
 *
 * Stateless with respect to wallet identity — receives dependencies via constructor.
 */
export class BtcTransactionBuilder {
  private feeEstimator: BtcFeeEstimator;
  private options: Required<BtcTransactionBuilderOptions>;

  constructor(
    private dataSource: BtcDataProvider,
    private networkConfig: NetworkConfig,
    private publicKeyProvider: PublicKeyProvider,
    private getAddress: () => Promise<string>,
    options?: BtcTransactionBuilderOptions,
  ) {
    this.feeEstimator = new BtcFeeEstimator();
    this.options = {
      concurrency: options?.concurrency ?? 5,
      retryOptions: options?.retryOptions ?? { maxRetries: 3, initialDelay: 1 },
    };
  }

  async buildInputs(utxoSeals: UtxoSeal[]): Promise<TxInputData[]> {
    const uniqueSeals = deduplicateUtxoSeals(utxoSeals);

    if (uniqueSeals.length < utxoSeals.length) {
      console.warn(
        `[BtcTransactionBuilder] Removed ${utxoSeals.length - uniqueSeals.length} duplicate UTXO(s) from inputs`,
      );
    }

    const inputs = await mapWithConcurrency(
      uniqueSeals,
      this.options.concurrency,
      async (utxoSeal) => {
        const tx = await retryWithBackoff(
          () => this.dataSource.getTransaction(utxoSeal.txid),
          this.options.retryOptions,
        );
        if (!tx) {
          throw new ErrorBtcTransactionNotFound(utxoSeal.txid);
        }
        const vout = tx.vout[utxoSeal.vout];
        if (!vout) {
          throw new ErrorBtcUtxoNotFound(
            utxoSeal.txid,
            utxoSeal.vout,
            tx.vout.length,
          );
        }

        const scriptBuffer = ccc.bytesFrom(vout.scriptpubkey);
        if (isOpReturnScriptPubkey(scriptBuffer)) {
          throw new ErrorBtcOpReturnUtxo(utxoSeal.txid, utxoSeal.vout);
        }

        return utxoToInputData(
          {
            txid: utxoSeal.txid,
            vout: utxoSeal.vout,
            value: vout.value,
            scriptPk: vout.scriptpubkey,
            address: vout.scriptpubkey_address,
            addressType: getAddressType(vout.scriptpubkey_address),
          } as Utxo,
          this.publicKeyProvider,
        );
      },
    );
    return inputs;
  }

  async balanceInputsOutputs(
    inputs: TxInputData[],
    outputs: TxOutput[],
    btcUtxoParams?: BtcUtxoParams,
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
    params?: BtcUtxoParams,
    knownInputs?: TxInputData[],
  ): Promise<{ inputs: TxInputData[]; changeValue: number }> {
    const utxos = await this.dataSource.getUtxos(
      await this.getAddress(),
      params,
    );

    let filteredUtxos = utxos;
    if (knownInputs) {
      filteredUtxos = utxos.filter((utxo: BtcUtxo) => {
        return !knownInputs.some(
          (input) => input.hash === utxo.txid && input.index === utxo.vout,
        );
      });
    }

    if (filteredUtxos.length === 0) {
      throw new ErrorBtcInsufficientFunds(requiredValue, 0);
    }

    const selectedUtxos: BtcUtxo[] = [];
    let totalValue = 0;

    for (const utxo of filteredUtxos) {
      selectedUtxos.push(utxo);
      totalValue += utxo.value;

      if (totalValue >= requiredValue) {
        break;
      }
    }

    if (totalValue < requiredValue) {
      throw new ErrorBtcInsufficientFunds(requiredValue, totalValue);
    }

    return {
      inputs: await this.buildInputs(
        selectedUtxos.map((utxo) => ({
          txid: utxo.txid,
          vout: utxo.vout,
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
        witnessUtxo: { value: 0, script: new Uint8Array(0) },
      } as unknown as TxInputData;

      if (addressType === AddressType.P2TR) {
        dummyInput.tapInternalKey = new Uint8Array(32);
      } else if (addressType === AddressType.P2WPKH) {
        const script = new Uint8Array(22);
        script[0] = 0x00;
        script[1] = 0x14;
        dummyInput.witnessUtxo.script = script;
      } else if (addressType === AddressType.P2WSH) {
        const script = new Uint8Array(34);
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
        feeRate = (await this.dataSource.getRecommendedFee()).fastestFee;
      } catch (error) {
        feeRate = this.networkConfig.btcFeeRate;
        console.warn(
          `Failed to get recommended fee rate: ${String(error)}, using default fee rate ${this.networkConfig.btcFeeRate}`,
        );
      }
    }

    return Math.ceil(bufferedVirtualSize * feeRate);
  }
}
