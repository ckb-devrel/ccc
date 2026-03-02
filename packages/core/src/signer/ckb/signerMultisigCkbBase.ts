import { Address } from "../../address/index.js";
import {
  Script,
  ScriptLike,
  Transaction,
  TransactionLike,
  WitnessArgs,
  WitnessArgsLike,
} from "../../ckb/index.js";
import { CellDepInfo, CellDepInfoLike, Client } from "../../client/index.js";
import { Hex, hexFrom } from "../../hex/index.js";
import { reduceAsync } from "../../utils/index.js";
import { SignerMultisig, SignerSignType, SignerType } from "../signer/index.js";
import {
  MultisigCkbWitness,
  MultisigCkbWitnessLike,
} from "./multisigCkbWitness.js";
import {
  recoverMessageSecp256k1,
  SECP256K1_SIGNATURE_LENGTH,
} from "./secp256k1Signing.js";

/**
 * Abstract base class for CKB-family multisig signers.
 *
 * Provides shared logic for witness preparation, signature counting,
 * aggregation, etc. Subclasses implement two template methods that
 * control witness encoding (plain multisig bytes vs. OmniLock envelope).
 *
 * @public
 */
export abstract class SignerMultisigCkbBase extends SignerMultisig {
  static EmptySignature = hexFrom("00".repeat(SECP256K1_SIGNATURE_LENGTH));

  get type(): SignerType {
    return SignerType.CKB;
  }

  get signType(): SignerSignType {
    return SignerSignType.Unknown;
  }

  public readonly multisigInfo: MultisigCkbWitness;
  public readonly scriptInfos: Promise<
    {
      script: Script;
      cellDeps: CellDepInfo[];
    }[]
  >;

  /**
   * @param client - The client instance.
   * @param multisigInfo - The resolved multisig witness info.
   * @param scriptInfos - Promise resolving to the script(s) this signer manages.
   */
  constructor(
    client: Client,
    multisigInfo: MultisigCkbWitness,
    scriptInfos: Promise<{ script: Script; cellDeps: CellDepInfo[] }[]>,
  ) {
    super(client);
    this.multisigInfo = multisigInfo;
    this.scriptInfos = scriptInfos;
  }

  /**
   * Encode a MultisigCkbWitness into the bytes stored in WitnessArgs.lock.
   * CKB multisig: raw multisig hex. OmniLock: wrapped in OmniLockWitnessLock.
   */
  protected abstract encodeWitnessLock(witness: MultisigCkbWitness): Hex;

  /**
   * Decode WitnessArgs.lock bytes back into a MultisigCkbWitness.
   * Returns undefined if the data does not match this signer's format.
   */
  protected abstract decodeWitnessLock(
    lock: Hex,
  ): MultisigCkbWitness | undefined;

  async getMemberCount(): Promise<number> {
    return this.multisigInfo.publicKeyHashes.length;
  }

  async getMemberThreshold(): Promise<number> {
    return this.multisigInfo.threshold;
  }

  async connect(): Promise<void> {}

  async isConnected(): Promise<boolean> {
    return true;
  }

  async getInternalAddress(): Promise<string> {
    return this.getRecommendedAddress();
  }

  async getAddressObjs(): Promise<Address[]> {
    return (await this.scriptInfos).map(({ script }) =>
      Address.fromScript(script, this.client),
    );
  }

  /**
   * Decode the witness args at a specific index.
   */
  decodeWitnessArgsAt(
    txLike: TransactionLike,
    index: number,
  ): MultisigCkbWitness | undefined {
    const tx = Transaction.from(txLike);
    return this.decodeWitnessArgs(tx.getWitnessArgsAt(index));
  }

  /**
   * Decode the witness args.
   */
  decodeWitnessArgs(
    witnessLike?: WitnessArgsLike | null,
  ): MultisigCkbWitness | undefined {
    if (!witnessLike) {
      return;
    }
    const witness = WitnessArgs.from(witnessLike);

    if (witness.lock == null) {
      return;
    }

    try {
      const decoded = this.decodeWitnessLock(witness.lock);
      if (decoded && decoded.eqInfo(this.multisigInfo)) {
        return decoded;
      }
    } catch (_) {
      // Returns undefined for invalid data
    }
  }

  /**
   * Prepare the witness args at a specific index.
   */
  async prepareWitnessArgsAt(
    txLike: TransactionLike,
    index: number,
    transformer?:
      | ((
          witness: MultisigCkbWitness,
          witnessArgs: WitnessArgs,
        ) =>
          | MultisigCkbWitnessLike
          | undefined
          | null
          | void
          | Promise<MultisigCkbWitnessLike | undefined | null | void>)
      | null,
  ): Promise<Transaction> {
    const tx = Transaction.from(txLike);

    const witnessArgs = tx.getWitnessArgsAt(index) ?? WitnessArgs.from({});
    const multisigWitness =
      this.decodeWitnessArgs(witnessArgs) ?? this.multisigInfo.clone();

    multisigWitness.signatures = multisigWitness.signatures.slice(
      0,
      this.multisigInfo.threshold,
    );
    multisigWitness.signatures.push(
      ...Array.from(
        new Array(
          this.multisigInfo.threshold - multisigWitness.signatures.length,
        ),
        () => SignerMultisigCkbBase.EmptySignature,
      ),
    );

    witnessArgs.lock = this.encodeWitnessLock(
      MultisigCkbWitness.from(
        (await transformer?.(multisigWitness, witnessArgs)) ?? multisigWitness,
      ),
    );
    tx.setWitnessArgsAt(index, witnessArgs);

    return tx;
  }

  /**
   * Prepare multisig witness for a single script variant.
   */
  async prepareTransactionOneScript(
    txLike: TransactionLike,
    script: ScriptLike,
    cellDeps: CellDepInfoLike[],
  ): Promise<Transaction> {
    const tx = Transaction.from(txLike);
    const position = await tx.findInputIndexByLock(script, this.client);
    if (position === undefined) {
      return tx;
    }

    await tx.addCellDepInfos(this.client, cellDeps);
    return this.prepareWitnessArgsAt(tx, position);
  }

  /**
   * Prepare transaction for multisig witness and adding related cell deps.
   */
  async prepareTransaction(txLike: TransactionLike): Promise<Transaction> {
    return await reduceAsync(
      await this.scriptInfos,
      (tx, { script, cellDeps }) =>
        this.prepareTransactionOneScript(tx, script, cellDeps),
      Transaction.from(txLike),
    );
  }

  /**
   * Get the number of signatures in the transaction.
   */
  async getSignaturesCount(
    txLike: TransactionLike,
  ): Promise<number | undefined> {
    const tx = Transaction.from(txLike);
    let minSignaturesCount = undefined;

    for (const { script } of await this.scriptInfos) {
      const index = await tx.findInputIndexByLock(script, this.client);
      if (index === undefined) {
        continue;
      }

      const multisigWitness = this.decodeWitnessArgsAt(tx, index);

      if (!multisigWitness) {
        minSignaturesCount = 0;
      } else {
        minSignaturesCount = Math.min(
          minSignaturesCount ?? 256,
          multisigWitness.signatures.reduce(
            (acc, s) =>
              acc + (s === SignerMultisigCkbBase.EmptySignature ? 0 : 1),
            0,
          ),
        );
      }
    }

    return minSignaturesCount;
  }

  /**
   * Check if the transaction needs more signatures.
   */
  async needMoreSignatures(txLike: TransactionLike): Promise<boolean> {
    const count = await this.getSignaturesCount(txLike);
    if (count == null) {
      return false;
    }
    return count < (await this.getMemberThreshold());
  }

  /**
   * Get the sign info for a script.
   */
  async getSignInfo(
    txLike: TransactionLike,
    script: ScriptLike,
  ): Promise<{ message: Hex; position: number } | undefined> {
    const tx = Transaction.from(txLike);

    const position = await tx.findInputIndexByLock(script, this.client);
    if (position == null) {
      return;
    }

    // === Replace the witness with a dummy one ===
    const witness = tx.getWitnessArgsAt(position) ?? WitnessArgs.from({});
    witness.lock = this.encodeWitnessLock(
      MultisigCkbWitness.from({
        ...this.multisigInfo,
        signatures: Array.from(
          new Array(this.multisigInfo.threshold),
          () => SignerMultisigCkbBase.EmptySignature,
        ),
      }),
    );

    const clonedTx = tx.clone();
    clonedTx.setWitnessArgsAt(position, witness);
    // === Replace the witness with a dummy one ===

    return clonedTx.getSignHashInfo(script, this.client);
  }

  /**
   * Aggregate transactions.
   */
  async aggregateTransactions(txs: TransactionLike[]): Promise<Transaction> {
    if (txs.length === 0) {
      throw Error("No transaction to aggregate");
    }

    let res = Transaction.from(txs[0]);
    for (const { script } of await this.scriptInfos) {
      const info = await this.getSignInfo(res, script);
      if (info === undefined) {
        continue;
      }

      const signatures = new Map<Hex, Hex>();
      for (const txLike of txs) {
        const tx = Transaction.from(txLike);
        const multisigWitness = this.decodeWitnessArgsAt(tx, info.position);

        if (!multisigWitness) {
          continue;
        }

        for (const sig of multisigWitness.signatures) {
          try {
            signatures.set(recoverMessageSecp256k1(info.message, sig), sig);
          } catch (_) {
            // Ignore invalid signatures
          }
          if (signatures.size >= this.multisigInfo.threshold) {
            break;
          }
        }

        if (signatures.size >= this.multisigInfo.threshold) {
          break;
        }
      }

      res = await this.prepareWitnessArgsAt(res, info.position, (witness) => {
        witness.signatures = Array.from(signatures.values());
      });
    }

    return res;
  }
}
