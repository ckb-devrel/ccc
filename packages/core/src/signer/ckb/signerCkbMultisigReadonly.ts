import { Address } from "../../address/index.js";
import {
  Script,
  SinceLike,
  Transaction,
  TransactionLike,
} from "../../ckb/index.js";
import { CellDepInfo, Client, KnownScript } from "../../client/index.js";
import { Hex, hexConcat, hexFrom, HexLike } from "../../hex/index.js";
import {
  hashCkb,
  numToBytes,
  ScriptInfoLike,
  ScriptLike,
  Since,
  WitnessArgs,
} from "../../index.js";
import { Signer, SignerSignType, SignerType } from "../signer/index.js";

export const MULTISIG_SCRIPT_DEFAULT = KnownScript.Secp256k1MultisigV2;
export const MULTISIG_SCRIPTS = [
  KnownScript.Secp256k1MultisigV2,
  KnownScript.Secp256k1Multisig,
];

export type MultisigInfoLike = {
  pubkeys: HexLike[];
  threshold: number;
  mustMatch: number;
  since?: SinceLike;
  multisigScript?:
    | ScriptInfoLike
    | KnownScript.Secp256k1Multisig
    | KnownScript.Secp256k1MultisigV2;
};

/**
 * A class representing multisig information, holding information ingredients and containing utilities.
 * @public
 */
export class MultisigInfo {
  public readonly pubkeys: Hex[];
  public readonly threshold: number;
  public readonly mustMatch: number;
  public readonly since?: Since;
  public readonly knownMultisigScript:
    | ScriptInfoLike
    | KnownScript.Secp256k1Multisig
    | KnownScript.Secp256k1MultisigV2;

  public readonly pubkeyBlake160Hashes: Hex[];
  public readonly metadata: Hex;

  private constructor(multisig: MultisigInfoLike) {
    this.pubkeys = multisig.pubkeys.map(hexFrom);
    this.threshold = multisig.threshold;
    this.mustMatch = multisig.mustMatch;
    this.since = multisig.since ? Since.from(multisig.since) : undefined;
    this.knownMultisigScript =
      multisig.multisigScript ?? MULTISIG_SCRIPT_DEFAULT;
    if (
      typeof this.knownMultisigScript === "string" &&
      this.knownMultisigScript !== MULTISIG_SCRIPT_DEFAULT
    ) {
      console.warn(
        `Multisig script '${this.knownMultisigScript}' is marked as **Deprecated**, please using '${MULTISIG_SCRIPT_DEFAULT}' instead`,
      );
    }
    if (this.threshold < 0 || this.threshold > 255) {
      throw new Error("`threshold` must be positive and less than 256!");
    }
    if (this.mustMatch < 0 || this.mustMatch > 255) {
      throw new Error("`mustMatch` must be positive and less than 256!");
    }
    if (this.mustMatch > this.threshold) {
      throw new Error("`mustMatch` must be less than or equal to `threshold`!");
    }
    if (
      this.pubkeys.length < this.mustMatch ||
      this.pubkeys.length < this.threshold ||
      this.pubkeys.length > 255
    ) {
      throw new Error(
        "length of `pubkeys` must be greater than or equal to `mustMatch` and `threshold` and less than 256!",
      );
    }
    this.pubkeyBlake160Hashes = this.pubkeys.map(
      (pubkey) => hashCkb(hexFrom(pubkey)).slice(0, 42) as Hex,
    );
    this.metadata = hexConcat(
      "0x00",
      hexFrom(numToBytes(this.mustMatch)),
      hexFrom(numToBytes(this.threshold)),
      hexFrom(numToBytes(this.pubkeyBlake160Hashes.length)),
      ...this.pubkeyBlake160Hashes,
    );
  }

  static from(multisig: MultisigInfoLike): MultisigInfo {
    return new MultisigInfo(multisig);
  }

  multisigScriptArgs(): Hex {
    const metadataBlake160Hash = hashCkb(this.metadata).slice(0, 42) as Hex;
    if (this.since) {
      const sinceBytes = this.since.toBytes();
      return hexConcat(metadataBlake160Hash, hexFrom(sinceBytes));
    } else {
      return metadataBlake160Hash;
    }
  }

  async defaultMultisigScript(client: Client): Promise<Script> {
    const args = this.multisigScriptArgs();
    if (typeof this.knownMultisigScript === "string") {
      return await Script.fromKnownScript(
        client,
        this.knownMultisigScript,
        args,
      );
    }
    return Script.from({
      ...this.knownMultisigScript,
      args,
    });
  }

  async multisigScripts(client: Client): Promise<Script[]> {
    const args = this.multisigScriptArgs();
    const builtInScripts = await Promise.all(
      MULTISIG_SCRIPTS.map(async (script) => {
        return await Script.fromKnownScript(client, script, args);
      }),
    );
    if (typeof this.knownMultisigScript === "string") {
      return builtInScripts;
    }
    const manualScript = Script.from({
      ...this.knownMultisigScript,
      args,
    });
    return [manualScript, ...builtInScripts];
  }
}

/**
 * A class extending Signer that provides access to a CKB multisig script.
 * This class does not support signing operations.
 * @public
 */
export class SignerCkbMultisigReadonly extends Signer {
  get type(): SignerType {
    return SignerType.CKB;
  }

  get signType(): SignerSignType {
    return SignerSignType.CkbMultisigSecp256k1;
  }

  public readonly multisigInfo: MultisigInfo;

  /**
   * Creates an instance of SignerCkbMultisig.
   *
   * @param client - The client instance used for communication.
   * @param privateKey - The private key associated with the signer.
   * @param multisigInfoLike - The multisig information assembled from pubkeys, threshold, mustMatch and since.
   */
  constructor(client: Client, multisigInfoLike: MultisigInfoLike) {
    super(client);

    this.multisigInfo = MultisigInfo.from(multisigInfoLike);
  }

  async connect(): Promise<void> {}

  async isConnected(): Promise<boolean> {
    return true;
  }

  async getInternalAddress(): Promise<string> {
    return this.getRecommendedAddress();
  }

  async getAddressObjSecp256k1(): Promise<Address> {
    const multisigScript = await this.multisigInfo.defaultMultisigScript(
      this.client,
    );
    return Address.fromScript(multisigScript, this.client);
  }

  async getAddressObjs(): Promise<Address[]> {
    const multisigScripts = await this.multisigInfo.multisigScripts(
      this.client,
    );
    return multisigScripts.map((script) =>
      Address.fromScript(script, this.client),
    );
  }

  async getRelatedScripts(
    txLike: TransactionLike,
  ): Promise<{ script: Script; cellDeps: CellDepInfo[] }[]> {
    const tx = Transaction.from(txLike);
    const multisig = await this.getAddressObjSecp256k1();

    const scripts: { script: Script; cellDeps: CellDepInfo[] }[] = [];
    for (const input of tx.inputs) {
      const {
        cellOutput: { lock },
      } = await input.getCell(this.client);

      if (scripts.some(({ script }) => script.eq(lock))) {
        continue;
      }

      if (lock.eq(multisig.script)) {
        const scriptInfo = await this.client.findKnownScript(lock);
        if (scriptInfo) {
          scripts.push({
            script: lock,
            cellDeps: scriptInfo.cellDeps,
          });
        } else {
          if (typeof this.multisigInfo.knownMultisigScript === "string") {
            // Generally, this branch could not be reached
            throw new Error(
              `Unsupported multisig script: ${this.multisigInfo.knownMultisigScript}`,
            );
          }
          scripts.push({
            script: lock,
            cellDeps: this.multisigInfo.knownMultisigScript.cellDeps.map(
              (cellDep) => CellDepInfo.from(cellDep),
            ),
          });
        }
      }
    }

    return scripts;
  }

  /**
   * Prepare multisig witness, if the existence of multisig witness is detected, nothing happens
   *
   * @param txLike - The transaction to prepare.
   * @param scriptLike - The script to prepare.
   * @returns A promise that resolves to the prepared transaction
   */
  async prepareTxMultisigWitness(
    txLike: TransactionLike,
    scriptLike: ScriptLike,
  ) {
    const tx = Transaction.from(txLike);
    const position = await tx.findInputIndexByLock(scriptLike, this.client);
    if (position === undefined) {
      return;
    }

    // Prepare signature placeholder
    const emptySignature = hexFrom(Array.from(new Array(65), () => 0));
    const signaturePlaceholder = hexConcat(
      ...Array.from(
        new Array(this.multisigInfo.threshold),
        () => emptySignature,
      ),
    );

    // Check if the multisig witness is already prepared
    const witness = tx.getWitnessArgsAt(position) ?? WitnessArgs.from({});
    if (
      witness.lock?.startsWith(this.multisigInfo.metadata) &&
      witness.lock.length ===
        this.multisigInfo.metadata.length + signaturePlaceholder.slice(2).length
    ) {
      return;
    }

    // Reset multisig witness to signature placeholder
    witness.lock = hexConcat(this.multisigInfo.metadata, signaturePlaceholder);
    tx.setWitnessArgsAt(position, witness);
  }

  /**
   * Prepare transaction for multisig witness and adding related cell deps
   *
   * @param txLike - The transaction to prepare.
   * @returns A promise that resolves to the prepared transaction
   */
  async prepareTransaction(txLike: TransactionLike): Promise<Transaction> {
    const tx = Transaction.from(txLike);

    await Promise.all(
      (await this.getRelatedScripts(tx)).map(async ({ script, cellDeps }) => {
        await this.prepareTxMultisigWitness(tx, script);
        await tx.addCellDepInfos(this.client, cellDeps);
      }),
    );
    return tx;
  }

  /**
   * Check if the multisig witness is fulfilled
   *
   * @param txLike - The transaction to check.
   * @param restrict - If true, throw an error if the multisig script is not found in Inputs.
   * @returns A promise that resolves to true if the multisig witness is fulfilled, false otherwise.
   */
  async signaturesFulfilled(
    txLike: TransactionLike,
    restrict: boolean = false,
  ): Promise<boolean> {
    const tx = Transaction.from(txLike);
    const emptySignature = hexFrom(Array.from(new Array(65), () => 0));

    for (const { script } of await this.getRelatedScripts(tx)) {
      const index = await tx.findInputIndexByLock(script, this.client);
      if (index === undefined) {
        if (restrict) {
          throw new Error("Multisig script not found in Inputs");
        }
        return false;
      }

      const witness = tx.getWitnessArgsAt(index);
      if (!witness || !witness.lock?.startsWith(this.multisigInfo.metadata)) {
        return false;
      }

      const signatures =
        witness.lock
          .slice(this.multisigInfo.metadata.length)
          .match(/.{1,130}/g)
          ?.map(hexFrom) || [];
      if (signatures.length !== this.multisigInfo.threshold) {
        if (restrict) {
          throw new Error(
            `Not enough signatures to threshold (${signatures.length}/${this.multisigInfo.threshold})`,
          );
        }
        return false;
      }
      if (
        signatures.filter((sig) => sig !== emptySignature).length <
        this.multisigInfo.threshold
      ) {
        return false;
      }
    }

    return true;
  }
}
