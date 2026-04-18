import * as bitcoin from "bitcoinjs-lib";

import {
  ccc,
  SignerSignType,
  SignerType,
  Transaction,
  TransactionLike,
} from "@ckb-ccc/core";
import { spore } from "@ckb-ccc/spore";

import { transactionToHex } from "../bitcoin/transaction/index.js";
import { pollForSpvProof, RgbppSpvProof } from "../data-source/index.js";
import {
  ErrorRgbppInvalidInputLock,
  ErrorRgbppOutputNotFound,
} from "../error.js";
import {
  btcTxIdInReverseByteOrder,
  buildRgbppUnlock,
  deduplicateByOutPoint,
  getTxIdFromRgbppLockArgs,
  isSameScriptTemplate,
  isUsingOneOfScripts,
  pseudoRgbppLockArgs,
  RGBPP_BTC_TX_ID_PLACEHOLDER,
  RGBPP_CONFIG_CELL_INDEX,
  RgbppScriptName,
} from "../script/index.js";
import { removeHexPrefix } from "../utils/index.js";

import {
  DEFAULT_SPV_POLL_INTERVAL,
  RgbppDataSource,
} from "../data-source/index.js";

export interface CkbRgbppUnlockSignerParams {
  ckbClient: ccc.Client;
  rgbppBtcAddress: string;
  rgbppDataSource: RgbppDataSource;
  scriptInfos: Record<RgbppScriptName, ccc.ScriptInfo>;
  /** Polling interval in milliseconds for SPV proof polling (default: 30000, minimum: 5000) */
  spvPollIntervalMs?: number;
  /** SPV proof cache expiry time in milliseconds (default: 600000 = 10 minutes) */
  cacheExpiryMs?: number;
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

  private spvProofCache = new Map<string, Promise<RgbppSpvProof>>();
  private readonly cacheExpiryTime: number;
  private readonly spvPollIntervalMs: number;
  private readonly rgbppBtcAddress: string;
  private readonly rgbppDataSource: RgbppDataSource;

  constructor({
    ckbClient,
    rgbppBtcAddress,
    rgbppDataSource,
    scriptInfos,
    spvPollIntervalMs,
    cacheExpiryMs,
  }: CkbRgbppUnlockSignerParams) {
    super(ckbClient);
    this.rgbppBtcAddress = rgbppBtcAddress;
    this.rgbppDataSource = rgbppDataSource;

    // Validate required script infos
    const requiredScripts = [
      ccc.KnownScript.RgbppLock,
      ccc.KnownScript.BtcTimeLock,
    ] as const;
    for (const name of requiredScripts) {
      const info = scriptInfos[name];
      if (!info || !info.cellDeps?.[0]?.cellDep) {
        throw new Error(
          `Missing or invalid ScriptInfo for ${name}. ` +
            `scriptInfos must include both RgbppLock and BtcTimeLock with valid cellDeps.`,
        );
      }
    }

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
    this.spvPollIntervalMs = Math.max(
      spvPollIntervalMs ?? DEFAULT_SPV_POLL_INTERVAL,
      5_000,
    );
    this.cacheExpiryTime = cacheExpiryMs ?? 600_000;
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
              index: RGBPP_CONFIG_CELL_INDEX,
            },
            depType: this.rgbppScriptInfos[name].cellDep.depType,
          }),
        ];
      }
      return [];
    });

    const clusterCellDeps = await this.collectClusterCellDeps(tx);

    return deduplicateByOutPoint([
      ...cellDeps,
      ...clusterCellDeps,
      ...tx.cellDeps,
    ]);
  }

  private async collectClusterCellDeps(
    tx: Transaction,
  ): Promise<ccc.CellDep[]> {
    const clusterScriptInfos = Object.values(
      spore.getClusterScriptInfos(this.client),
    );

    const clusterIndicesInInputs: number[] = [];
    const clusterIndicesInOutputs: number[] = [];

    tx.inputs.forEach((input, index) => {
      if (input.cellOutput?.type) {
        clusterScriptInfos.forEach((si) => {
          if (si && si.codeHash === input.cellOutput?.type?.codeHash) {
            clusterIndicesInInputs.push(index);
          }
        });
      }
    });

    tx.outputs.forEach((output, index) => {
      clusterScriptInfos.forEach((si) => {
        if (si && si.codeHash === output.type?.codeHash) {
          clusterIndicesInOutputs.push(index);
        }
      });
    });

    if (
      clusterIndicesInInputs.length === 0 ||
      clusterIndicesInOutputs.length === 0
    ) {
      return [];
    }

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

    return [
      ccc.CellDep.from({
        outPoint: inputClusterCell.outPoint,
        depType: "code",
      }),
    ];
  }

  async prepareTransaction(txLike: TransactionLike): Promise<Transaction> {
    const tx = ccc.Transaction.from(txLike);

    tx.cellDeps = await this.collectCellDeps(tx);

    const btcTxId = this.parseBtcTxIdFromScriptArgs(tx);
    const spvProof = await this.getRgbppSpvProof(btcTxId);
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
    const spvProof = await this.getRgbppSpvProof(btcTxId);

    const rawBtcTxHex = await this.getRawBtcTxHex(btcTxId);
    return Promise.resolve(this.insertWitnesses(tx, rawBtcTxHex, spvProof));
  }

  private async getRgbppSpvProof(btcTxId: string): Promise<RgbppSpvProof> {
    const spvProof = this.spvProofCache.get(btcTxId);

    if (spvProof) {
      return spvProof;
    }

    const proofPromise = pollForSpvProof(
      this.rgbppDataSource,
      btcTxId,
      0,
      this.spvPollIntervalMs,
    );
    // Store the promise in cache so concurrent requests can share it
    this.spvProofCache.set(btcTxId, proofPromise);
    try {
      const proof = await proofPromise;

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

  private async getRawBtcTxHex(txId: string): Promise<string> {
    const hex = await this.rgbppDataSource.getTransactionHex(txId);
    return transactionToHex(bitcoin.Transaction.fromHex(hex), false);
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
      throw new ErrorRgbppOutputNotFound();
    }
    return getTxIdFromRgbppLockArgs(rgbppOutput.lock.args);
  }

  async insertWitnesses(
    partialTx: ccc.Transaction,
    btcLikeTxBytes: string,
    spvClient: RgbppSpvProof,
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
    }).toBytes();

    // Validate all inputs use RGBPP lock — fail fast if not
    for (const input of tx.inputs) {
      await input.completeExtraInfos(this.client);
      const scriptName = input.cellOutput
        ? this.getScriptName(input.cellOutput.lock)
        : undefined;
      if (scriptName !== ccc.KnownScript.RgbppLock) {
        throw new ErrorRgbppInvalidInputLock(
          input.cellOutput?.lock.codeHash ?? "unknown",
        );
      }
    }

    tx.inputs.forEach((_, index) => {
      tx.setWitnessAt(index, rgbppWitness);
    });

    await this.handleSporeWitness(tx);

    return tx;
  }

  async handleSporeWitness(tx: ccc.Transaction): Promise<void> {
    if (tx.witnesses.length === tx.inputs.length) {
      return;
    }

    const pseudoCobuild = tx.witnesses[tx.witnesses.length - 1];
    if (!pseudoCobuild) {
      throw new Error(
        "Expected a cobuild witness at the end of the witnesses array, but found none.",
      );
    }
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
        btcTxId = getTxIdFromRgbppLockArgs(output.lock.args);
        rgbppLockArgs.push(output.lock.args);
      } else if (
        isSameScriptTemplate(
          output.lock,
          this.rgbppScriptInfos[ccc.KnownScript.BtcTimeLock].script,
        )
      ) {
        btcTxId = getTxIdFromRgbppLockArgs(output.lock.args);
      }
    }

    if (!btcTxId) {
      throw new Error("Invalid transaction");
    }

    let cobuildWitness: string = pseudoCobuild;
    if (rgbppLockArgs.length > 0) {
      let currentCobuild: string = pseudoCobuild;
      const pseudoArg = removeHexPrefix(pseudoRgbppLockArgs());
      let lastIndex = 0;

      for (const lockArg of rgbppLockArgs) {
        const index = currentCobuild.indexOf(pseudoArg, lastIndex);
        if (index === -1) {
          break;
        }

        currentCobuild =
          currentCobuild.substring(0, index) +
          removeHexPrefix(lockArg) +
          currentCobuild.substring(index + pseudoArg.length);
        lastIndex = index + removeHexPrefix(lockArg).length;
      }
      cobuildWitness = currentCobuild;
    }

    const txIdPlaceholder = btcTxIdInReverseByteOrder(
      RGBPP_BTC_TX_ID_PLACEHOLDER,
    );
    const txIdReplacement = btcTxIdInReverseByteOrder(btcTxId);
    const finalCobuild = cobuildWitness.replace(
      new RegExp(txIdPlaceholder, "g"),
      txIdReplacement,
    ) as ccc.Hex;

    tx.witnesses.push(finalCobuild);
  }

  async connect(): Promise<void> {}

  async isConnected(): Promise<boolean> {
    return true;
  }

  async getInternalAddress(): Promise<string> {
    return this.getRecommendedAddress();
  }

  async getAddressObjs(): Promise<ccc.Address[]> {
    const rgbppCellOutputs = await this.rgbppDataSource.getRgbppCellOutputs(
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
