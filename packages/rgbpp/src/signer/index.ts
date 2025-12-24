import * as bitcoin from "bitcoinjs-lib";

import {
  ccc,
  SignerSignType,
  SignerType,
  Transaction,
  TransactionLike,
} from "@ckb-ccc/core";
import { spore } from "@ckb-ccc/spore";

import { transactionToHex } from "../bitcoin/index.js";

import {
  DEFAULT_SPV_POLL_INTERVAL,
  TX_ID_PLACEHOLDER,
} from "../constants/index.js";
import { RgbppBtcDataSource } from "../interfaces/btc.js";
import { RgbppScriptName } from "../types/script.js";
import { SpvProof } from "../types/spv.js";
import { deduplicateByOutPoint } from "../utils/common.js";
import { trimHexPrefix } from "../utils/encoder.js";
import {
  btcTxIdInReverseByteOrder,
  buildRgbppUnlock,
  pseudoRgbppLockArgs,
} from "../utils/rgbpp.js";
import {
  getTxIdFromScriptArgs,
  isSameScriptTemplate,
  isUsingOneOfScripts,
} from "../utils/script.js";
import { pollForSpvProof } from "../utils/spv.js";

export interface CkbRgbppUnlockSignerParams {
  ckbClient: ccc.Client;
  rgbppBtcAddress: string;
  btcDataSource: RgbppBtcDataSource;
  scriptInfos: Record<RgbppScriptName, ccc.ScriptInfo>;
  /** Polling interval in milliseconds for SPV proof polling (default: 30000, minimum: 5000) */
  spvPollInterval?: number;
}

export class CkbRgbppUnlockSigner extends ccc.Signer {
  // map of script code hash to script name
  private readonly scriptMap: Record<string, ccc.KnownScript>;
  private readonly rgbppScriptInfos: {
    [ccc.KnownScript.RgbppLock]: {
      script: ccc.Script;
      cellDep: ccc.CellDep;
    };
    [ccc.KnownScript.BtcTimeLock]: {
      script: ccc.Script;
      cellDep: ccc.CellDep;
    };
  };

  private spvProofCache = new Map<string, Promise<SpvProof>>();
  private cacheExpiryTime = 600_000;
  private readonly spvPollInterval: number;
  private readonly rgbppBtcAddress: string;
  private readonly btcDataSource: RgbppBtcDataSource;

  constructor({
    ckbClient,
    rgbppBtcAddress,
    btcDataSource,
    scriptInfos,
    spvPollInterval,
  }: CkbRgbppUnlockSignerParams) {
    super(ckbClient);
    this.rgbppBtcAddress = rgbppBtcAddress;
    this.btcDataSource = btcDataSource;

    this.scriptMap = Object.fromEntries(
      Object.entries(scriptInfos).map(([key, value]) => [
        value.codeHash,
        key as ccc.KnownScript,
      ]),
    );

    // Convert ccc.ScriptInfo to internal format
    const convertScriptInfo = (info: ccc.ScriptInfo) => ({
      script: ccc.Script.from({
        codeHash: info.codeHash,
        hashType: info.hashType,
        args: "",
      }),
      cellDep: info.cellDeps[0].cellDep,
    });

    this.rgbppScriptInfos = {
      [ccc.KnownScript.RgbppLock]: convertScriptInfo(
        scriptInfos[ccc.KnownScript.RgbppLock],
      ),
      [ccc.KnownScript.BtcTimeLock]: convertScriptInfo(
        scriptInfos[ccc.KnownScript.BtcTimeLock],
      ),
    };
    this.spvPollInterval = Math.max(
      spvPollInterval ?? DEFAULT_SPV_POLL_INTERVAL,
      5_000,
    );
  }

  get type(): SignerType {
    return SignerType.CKB;
  }

  get signType(): SignerSignType {
    return SignerSignType.Unknown;
  }

  getScriptName(script?: ccc.Script): ccc.KnownScript | undefined {
    return script ? this.scriptMap[script.codeHash] : undefined;
  }

  async collectCellDeps(tx: Transaction): Promise<ccc.CellDep[]> {
    const scriptNames = new Set<ccc.KnownScript>(
      [
        ...(
          await Promise.all(
            tx.inputs.map(async (input) => {
              await input.completeExtraInfos(this.client);
              return input.cellOutput
                ? [
                    this.getScriptName(input.cellOutput.lock),
                    this.getScriptName(input.cellOutput.type),
                  ]
                : [];
            }),
          )
        ).flat(),
        ...tx.outputs.map((output) => this.getScriptName(output.type)),
      ].filter((name): name is ccc.KnownScript => !!name),
    );

    const cellDeps = Array.from(scriptNames).flatMap((name) => {
      if (
        name === ccc.KnownScript.RgbppLock ||
        name === ccc.KnownScript.BtcTimeLock
      ) {
        return [
          this.rgbppScriptInfos[name].cellDep,
          ccc.CellDep.from({
            outPoint: {
              ...this.rgbppScriptInfos[name].cellDep.outPoint,
              index: "0x1",
            },
            depType: this.rgbppScriptInfos[name].cellDep.depType,
          }),
        ];
      }
      return [];
    });

    // TODO: extract into a method
    // ? * handle cluster transfer in spore transfer because of not being able to use cluster mode
    const clusterScriptInfos = Object.values(
      spore.getClusterScriptInfos(this.client),
    );
    const clusterIndicesInInputs: number[] = [];
    const clusterIndicesInOutputs: number[] = [];
    await Promise.all(
      tx.inputs.map(async (input, index) => {
        await input.completeExtraInfos(this.client);
        if (input.cellOutput?.type) {
          clusterScriptInfos.forEach((si) => {
            if (si && si.codeHash === input.cellOutput?.type?.codeHash) {
              clusterIndicesInInputs.push(index);
            }
          });
        }
      }),
    );

    tx.outputs.forEach((output, index) => {
      clusterScriptInfos.forEach((si) => {
        if (si && si.codeHash === output.type?.codeHash) {
          clusterIndicesInOutputs.push(index);
        }
      });
    });

    if (
      clusterIndicesInInputs.length > 0 &&
      clusterIndicesInOutputs.length > 0
    ) {
      if (
        clusterIndicesInInputs.length !== 1 ||
        clusterIndicesInOutputs.length !== 1
      ) {
        throw new Error("Invalid cluster indices");
      }
      const inputCluster = tx.inputs[clusterIndicesInInputs[0]];
      await inputCluster.completeExtraInfos(this.client);
      const inputClusterId = inputCluster.cellOutput!.type!.args;
      const { cell: inputClusterCell } = await spore.assertCluster(
        this.client,
        inputClusterId,
      );
      cellDeps.push(
        ccc.CellDep.from({
          outPoint: inputClusterCell.outPoint,
          depType: "code",
        }),
      );
    }

    return deduplicateByOutPoint([...cellDeps, ...tx.cellDeps]);
  }

  async prepareTransaction(txLike: TransactionLike): Promise<Transaction> {
    const tx = ccc.Transaction.from(txLike);

    tx.cellDeps = await this.collectCellDeps(tx);

    const btcTxId = this.parseBtcTxIdFromScriptArgs(tx);
    const spvProof = await this.getSpvProof(btcTxId);
    tx.cellDeps.push(
      ccc.CellDep.from({
        outPoint: spvProof.spvClientOutpoint,
        depType: "code",
      }),
    );

    return tx;
  }

  async signOnlyTransaction(txLike: TransactionLike): Promise<Transaction> {
    const tx = ccc.Transaction.from(txLike);

    const btcTxId = this.parseBtcTxIdFromScriptArgs(tx);
    const spvProof = await this.getSpvProof(btcTxId);

    const rawBtcTxHex = await this.getRawBtcTxHex(btcTxId);
    return Promise.resolve(this.insertWitnesses(tx, rawBtcTxHex, spvProof));
  }

  private async getSpvProof(btcTxId: string): Promise<SpvProof> {
    const spvProof = this.spvProofCache.get(btcTxId);

    if (spvProof) {
      return spvProof;
    }

    const proofPromise = pollForSpvProof(
      this.btcDataSource,
      btcTxId,
      0,
      this.spvPollInterval,
    );
    // Store the promise in cache so concurrent requests can share it
    this.spvProofCache.set(btcTxId, proofPromise);
    try {
      const proof = await proofPromise;
      if (!proof) {
        throw new Error(`SPV proof not found for transaction ${btcTxId}`);
      }

      setTimeout(() => {
        if (this.spvProofCache.get(btcTxId) === proofPromise) {
          this.spvProofCache.delete(btcTxId);
        }
      }, this.cacheExpiryTime);

      return proof;
    } catch (error) {
      if (this.spvProofCache.get(btcTxId) === proofPromise) {
        this.spvProofCache.delete(btcTxId);
      }
      throw error;
    }
  }

  async getRawBtcTxHex(txId: string): Promise<string> {
    const hex = await this.btcDataSource.getTransactionHex(txId);
    const parseTx = bitcoin.Transaction.fromHex(hex);
    return transactionToHex(parseTx, false);
  }

  parseBtcTxIdFromScriptArgs(tx: ccc.Transaction): string {
    const outputs = tx.outputs.filter((output) => output.lock);
    const rgbppOutput = outputs.find((output) =>
      isUsingOneOfScripts(output.lock, [
        this.rgbppScriptInfos[ccc.KnownScript.RgbppLock].script,
        this.rgbppScriptInfos[ccc.KnownScript.BtcTimeLock].script,
      ]),
    );
    if (!rgbppOutput) {
      throw new Error("Rgbpp or btcTimeLock output not found");
    }
    return getTxIdFromScriptArgs(rgbppOutput.lock.args);
  }

  // all cell deps with depType of `code` should be at the start of the array
  sortCellDeps(cellDeps: ccc.CellDep[]): ccc.CellDep[] {
    return cellDeps.sort((a, b) => {
      if (a.depType === "code" && b.depType !== "code") {
        return -1;
      }
      if (a.depType !== "code" && b.depType === "code") {
        return 1;
      }
      return 0;
    });
  }

  async insertWitnesses(
    partialTx: ccc.Transaction,
    btcLikeTxBytes: string,
    spvClient: SpvProof,
  ): Promise<ccc.Transaction> {
    const tx = partialTx.clone();

    const rgbppUnlock = buildRgbppUnlock(
      btcLikeTxBytes,
      spvClient.proof,
      tx.inputs.length,
      tx.outputs.length,
    );

    const rgbppWitness = ccc.WitnessArgs.from({
      lock: rgbppUnlock,
      inputType: "",
      outputType: "",
    }).toBytes();

    tx.inputs.forEach((_, index) => {
      tx.setWitnessAt(index, rgbppWitness);
    });

    await this.handleSporeWitness(tx);

    return tx;
  }

  async handleSporeWitness(tx: ccc.Transaction): Promise<void> {
    if (tx.witnesses.length == tx.inputs.length) {
      return;
    }

    let pseudoCobuild: ccc.Hex | undefined;
    pseudoCobuild = tx.witnesses[tx.witnesses.length - 1];
    tx.witnesses = tx.witnesses.slice(0, tx.inputs.length);

    let btcTxId: string | undefined;
    const rgbppLockArgs: ccc.Hex[] = [];
    for (const output of tx.outputs) {
      if (
        isSameScriptTemplate(
          output.lock,
          this.rgbppScriptInfos[ccc.KnownScript.RgbppLock].script,
        )
      ) {
        btcTxId = getTxIdFromScriptArgs(output.lock.args);
        rgbppLockArgs.push(output.lock.args);
      } else if (
        isSameScriptTemplate(
          output.lock,
          this.rgbppScriptInfos[ccc.KnownScript.BtcTimeLock].script,
        )
      ) {
        btcTxId = getTxIdFromScriptArgs(output.lock.args);
      }
    }

    if (!btcTxId) {
      throw new Error("Invalid transaction");
    }

    if (rgbppLockArgs.length > 0) {
      let currentCobuild = pseudoCobuild;
      const pseudoArg = trimHexPrefix(pseudoRgbppLockArgs());
      let lastIndex = 0;

      for (const lockArg of rgbppLockArgs) {
        const index = currentCobuild.indexOf(pseudoArg, lastIndex);
        if (index === -1) {
          break;
        }

        currentCobuild =
          currentCobuild.substring(0, index) +
          trimHexPrefix(lockArg) +
          currentCobuild.substring(index + pseudoArg.length);
        lastIndex = index + trimHexPrefix(lockArg).length;
      }
      pseudoCobuild = currentCobuild;
    }

    const cobuild = pseudoCobuild.replace(
      btcTxIdInReverseByteOrder(TX_ID_PLACEHOLDER),
      btcTxIdInReverseByteOrder(btcTxId),
    ) as ccc.Hex;

    tx.witnesses.push(cobuild);
  }

  async connect(): Promise<void> {}

  async isConnected(): Promise<boolean> {
    return true;
  }

  async getInternalAddress(): Promise<string> {
    return this.getRecommendedAddress();
  }

  async getAddressObjs(): Promise<ccc.Address[]> {
    const rgbppCellOutputs = await this.btcDataSource.getRgbppCellOutputs(
      this.rgbppBtcAddress,
    );

    // output.type in each cell output must be present except for issuance
    // if (rgbppCellOutputs.some((output) => !output.type)) {
    //   throw new Error("Rgbpp cell output type not found");
    // }

    const ckbAddresses = rgbppCellOutputs.map((output) => {
      return ccc.Address.from({
        script: output.lock,
        prefix: this.client.addressPrefix,
      });
    });

    return ckbAddresses;
  }

  async getAddressObj(): Promise<ccc.Address> {
    return await ccc.Address.fromString(
      await this.getInternalAddress(),
      this.client,
    );
  }
}
