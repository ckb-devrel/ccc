import { Address } from "../../address/index.js";
import { Bytes, bytesConcat, bytesFrom } from "../../bytes/index.js";
import {
  Script,
  ScriptLike,
  Since,
  SinceLike,
  Transaction,
  TransactionLike,
  WitnessArgs,
  WitnessArgsLike,
} from "../../ckb/index.js";
import {
  CellDepInfo,
  CellDepInfoLike,
  Client,
  KnownScript,
  ScriptInfo,
  ScriptInfoLike,
} from "../../client/index.js";
import { codec, Entity } from "../../codec/index.js";
import { HASH_CKB_SHORT_LENGTH, hashCkb } from "../../hasher/index.js";
import { Hex, hexFrom, HexLike } from "../../hex/index.js";
import { numFrom, NumLike, numToBytes } from "../../num/index.js";
import { apply, reduceAsync } from "../../utils/index.js";
import { SignerMultisig, SignerSignType, SignerType } from "../signer/index.js";
import {
  recoverMessageSecp256k1,
  SECP256K1_SIGNATURE_LENGTH,
} from "./secp256k1Signing.js";

export type MultisigCkbWitnessLike = (
  | {
      publicKeyHashes: HexLike[];
      publicKeys?: undefined | null;
    }
  | {
      publicKeyHashes?: undefined | null;
      publicKeys: HexLike[];
    }
) & {
  threshold: NumLike;
  mustMatch?: NumLike | null;
  signatures?: HexLike[] | null;
};

/**
 * A class representing multisig information, holding information ingredients and containing utilities.
 * @public
 */
@codec({
  encode: (encodable: MultisigCkbWitness) => {
    const { publicKeyHashes, threshold, mustMatch, signatures } =
      MultisigCkbWitness.from(encodable);

    if (
      signatures.some((s) => s.length !== SECP256K1_SIGNATURE_LENGTH * 2 + 2)
    ) {
      throw Error("MultisigCkbWitness: invalid signature length");
    }
    if (
      publicKeyHashes.some((s) => s.length !== HASH_CKB_SHORT_LENGTH * 2 + 2)
    ) {
      throw Error("MultisigCkbWitness: invalid public key hash length");
    }

    return bytesConcat(
      "0x00",
      numToBytes(mustMatch ?? 0),
      numToBytes(threshold),
      numToBytes(publicKeyHashes.length),
      ...publicKeyHashes,
      ...signatures,
    );
  },
  decode: (raw: Bytes) => {
    const [
      _reserved,
      mustMatch,
      threshold,
      publicKeyHashesLength,
      ...rawKeyAndSignatures
    ] = raw;

    if (
      rawKeyAndSignatures.length <
      publicKeyHashesLength * HASH_CKB_SHORT_LENGTH
    ) {
      throw Error("MultisigCkbWitness: invalid public key hashes length");
    }

    const signatures = rawKeyAndSignatures.slice(
      publicKeyHashesLength * HASH_CKB_SHORT_LENGTH,
    );

    return MultisigCkbWitness.from({
      publicKeyHashes: Array.from(new Array(publicKeyHashesLength), (_, i) =>
        hexFrom(
          rawKeyAndSignatures.slice(
            i * HASH_CKB_SHORT_LENGTH,
            (i + 1) * HASH_CKB_SHORT_LENGTH,
          ),
        ),
      ),
      threshold: numFrom(threshold),
      mustMatch: numFrom(mustMatch),
      signatures: Array.from(
        new Array(Math.floor(signatures.length / SECP256K1_SIGNATURE_LENGTH)),
        (_, i) =>
          hexFrom(
            signatures.slice(
              i * SECP256K1_SIGNATURE_LENGTH,
              (i + 1) * SECP256K1_SIGNATURE_LENGTH,
            ),
          ),
      ),
    });
  },
})
export class MultisigCkbWitness extends Entity.Base<
  MultisigCkbWitnessLike,
  MultisigCkbWitness
>() {
  /**
   * @param publicKeyHashes - The public key hashes.
   * @param threshold - The threshold.
   * @param mustMatch - The number of signatures that must match.
   * @param signatures - The signatures.
   */
  constructor(
    public publicKeyHashes: Hex[],
    public threshold: number,
    public mustMatch: number,
    public signatures: Hex[],
  ) {
    super();

    const keysLength = publicKeyHashes.length;

    if (threshold <= 0 || threshold > keysLength) {
      throw new Error(
        "threshold should be in range from 1 to public keys length",
      );
    }
    if (mustMatch < 0 || mustMatch > Math.min(keysLength, threshold)) {
      throw new Error(
        "mustMatch should be in range from 0 to min(public keys length, threshold)",
      );
    }
    if (keysLength > 255) {
      throw new Error("public keys length should be less than 256");
    }
  }

  /**
   * Create a MultisigCkbWitness from a MultisigCkbWitnessLike.
   *
   * @param witness - The witness like object.
   * @returns The MultisigCkbWitness.
   */
  static from(witness: MultisigCkbWitnessLike): MultisigCkbWitness {
    const publicKeyHashes = (() => {
      if (witness.publicKeyHashes) {
        return witness.publicKeyHashes;
      }
      return witness.publicKeys.map((k) => hashCkb(k).slice(0, 42));
    })();

    return new MultisigCkbWitness(
      publicKeyHashes.map(hexFrom),
      Number(numFrom(witness.threshold)),
      Number(numFrom(witness.mustMatch ?? 0)),
      witness.signatures?.map(hexFrom) ?? [],
    );
  }

  /**
   * Get the script args of the multisig script.
   *
   * @param since - The since value.
   * @returns The script args.
   */
  scriptArgs(since?: SinceLike | null): Bytes {
    const hash = hashCkb(this.toBytes()).slice(0, 42);

    if (since != null) {
      return bytesConcat(hash, Since.from(since).toBytes());
    }

    return bytesFrom(hash);
  }

  /**
   * Check if the multisig info is equal to another.
   *
   * @param otherLike - The other multisig info.
   * @returns True if the multisig info is equal, false otherwise.
   */
  eqInfo(otherLike: MultisigCkbWitnessLike): boolean {
    const other = MultisigCkbWitness.from(otherLike);
    return (
      this.publicKeyHashes.length === other.publicKeyHashes.length &&
      this.publicKeyHashes.every((h, i) => h === other.publicKeyHashes[i]) &&
      this.threshold === other.threshold &&
      this.mustMatch === other.mustMatch
    );
  }
}

/**
 * A class extending Signer that provides access to a CKB multisig script.
 * This class does not support signing operations.
 * @public
 */
export class SignerMultisigCkbReadonly extends SignerMultisig {
  static EmptySignature = hexFrom("00".repeat(SECP256K1_SIGNATURE_LENGTH));

  get type(): SignerType {
    return SignerType.CKB;
  }

  get signType(): SignerSignType {
    return SignerSignType.Unknown;
  }

  public readonly multisigInfo: MultisigCkbWitness;

  public readonly since?: Since;
  public readonly scriptInfos: Promise<
    {
      script: Script;
      cellDeps: CellDepInfo[];
    }[]
  >;

  /**
   * Creates an instance of SignerMultisigCkbReadonly.
   *
   * @param client - The client instance.
   * @param multisigInfoLike - The multisig information.
   * @param options - The options.
   */
  constructor(
    client: Client,
    multisigInfoLike: MultisigCkbWitnessLike,
    options?: {
      since?: SinceLike | null;
      scriptInfos?: (KnownScript | ScriptInfoLike)[] | null;
    } | null,
  ) {
    super(client);

    this.multisigInfo = MultisigCkbWitness.from(multisigInfoLike);
    this.since = apply(Since.from, options?.since);

    const args = this.multisigInfo.scriptArgs(this.since);
    this.scriptInfos = Promise.all(
      (
        options?.scriptInfos ?? [
          KnownScript.Secp256k1MultisigV2,
          KnownScript.Secp256k1MultisigV2Beta,
          KnownScript.Secp256k1Multisig,
        ]
      ).map(async (v) =>
        typeof v === "string" ? client.getKnownScript(v) : ScriptInfo.from(v),
      ),
    ).then((infos) =>
      infos.map((i) => ({
        script: Script.from({ ...i, args }),
        cellDeps: i.cellDeps,
      })),
    );
  }

  /**
   * Get the number of members in the multisig script.
   *
   * @returns The number of members.
   */
  async getMemberCount() {
    return this.multisigInfo.publicKeyHashes.length;
  }

  /**
   * Get the threshold of the multisig script.
   *
   * @returns The threshold.
   */
  async getMemberThreshold() {
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
   *
   * @param txLike - The transaction.
   * @param index - The index of the witness args.
   * @returns The decoded MultisigCkbWitness.
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
   *
   * @param witnessLike - The witness args like object.
   * @returns The decoded MultisigCkbWitness.
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
      const decoded = MultisigCkbWitness.decode(witness.lock);
      if (decoded.eqInfo(this.multisigInfo)) {
        return decoded;
      }
    } catch (_) {
      // Returns undefined for invalid data
    }
  }

  /**
   * Prepare the witness args at a specific index.
   *
   * @param txLike - The transaction.
   * @param index - The index of the witness args.
   * @param transformer - The transformer function.
   * @returns The prepared transaction.
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
        () => SignerMultisigCkbReadonly.EmptySignature,
      ),
    );

    witnessArgs.lock = MultisigCkbWitness.from(
      (await transformer?.(multisigWitness, witnessArgs)) ?? multisigWitness,
    ).toHex();
    tx.setWitnessArgsAt(index, witnessArgs);

    return tx;
  }

  /**
   * Prepare multisig witness, if the existence of multisig witness is detected, nothing happens
   *
   * @param txLike - The transaction to prepare.
   * @param scriptLike - The script to prepare.
   * @returns A promise that resolves to the prepared transaction
   */
  async prepareTransactionOneScript(
    txLike: TransactionLike,
    script: ScriptLike,
    cellDeps: CellDepInfoLike[],
  ) {
    const tx = Transaction.from(txLike);
    const position = await tx.findInputIndexByLock(script, this.client);
    if (position === undefined) {
      return tx;
    }

    await tx.addCellDepInfos(this.client, cellDeps);
    return this.prepareWitnessArgsAt(tx, position);
  }

  /**
   * Prepare transaction for multisig witness and adding related cell deps
   *
   * @param txLike - The transaction to prepare.
   * @returns A promise that resolves to the prepared transaction
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
   *
   * @param txLike - The transaction.
   * @returns The number of signatures.
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
              acc + (s === SignerMultisigCkbReadonly.EmptySignature ? 0 : 1),
            0,
          ),
        );
      }
    }

    return minSignaturesCount;
  }

  /**
   * Check if the transaction needs more signatures
   *
   * @param txLike - The transaction to check.
   * @returns A promise that resolves to true if the multisig witness is fulfilled, false otherwise.
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
   *
   * @param txLike - The transaction.
   * @param script - The script.
   * @returns The sign info.
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
    witness.lock = MultisigCkbWitness.from({
      ...this.multisigInfo,
      signatures: Array.from(
        new Array(this.multisigInfo.threshold),
        () => SignerMultisigCkbReadonly.EmptySignature,
      ),
    }).toHex();

    const clonedTx = tx.clone();
    clonedTx.setWitnessArgsAt(position, witness);
    // === Replace the witness with a dummy one ===

    return clonedTx.getSignHashInfo(script, this.client);
  }

  /**
   * Aggregate transactions.
   *
   * @param txs - The transactions to aggregate.
   * @returns The aggregated transaction.
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
