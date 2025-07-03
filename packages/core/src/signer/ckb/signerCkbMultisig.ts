import { Address } from "../../address/index.js";
import {
  multisigMetadataFromPubkeys,
  SignerCkbPrivateKey,
  SinceLike,
  Transaction,
  TransactionLike,
} from "../../barrel.js";
import { Script } from "../../ckb/index.js";
import { CellDepInfo, Client, KnownScript } from "../../client/index.js";
import { Hex, hexConcat, hexFrom, HexLike } from "../../hex/index.js";

export interface MultisigInfo {
  pubkeys: HexLike[];
  threshold: number;
  mustMatch: number;
  since?: SinceLike;
  multisigScript?:
    | KnownScript.Secp256k1Multisig
    | KnownScript.Secp256k1MultisigV2;
}

/**
 * A class extending Signer that provides access to a CKB multisig script.
 * This class supports signing operations.
 * @public
 */
export class SignerCkbMultisig extends SignerCkbPrivateKey {
  public readonly multisig: MultisigInfo;

  /**
   * Creates an instance of SignerCkbMultisig.
   *
   * @param client - The client instance used for communication.
   * @param privateKey - The private key associated with the signer.
   * @param multisig - The multisig information assembled from pubkeys, threshold, mustMatch and since.
   */
  constructor(client: Client, privateKey: HexLike, multisig: MultisigInfo) {
    super(client, privateKey);

    this.multisig = multisig;
  }

  async getAddressObjSecp256k1(): Promise<Address> {
    const multisigScript = await Script.fromKnownMultisigScript(
      this.client,
      this.getMultisigMetadata(),
      this.multisig.since,
      this.multisig.multisigScript,
    );
    return Address.fromScript(multisigScript, this.client);
  }

  getMultisigInfo(): MultisigInfo {
    return this.multisig;
  }

  getMultisigMetadata(): Hex {
    return multisigMetadataFromPubkeys(
      this.multisig.pubkeys,
      this.multisig.threshold,
      this.multisig.mustMatch,
    );
  }

  async getAddressObjs(): Promise<Address[]> {
    const secp256k1 = await this.getAddressObjSecp256k1();
    return [secp256k1];
  }

  async getRelatedScripts(
    txLike: TransactionLike,
  ): Promise<{ script: Script; cellDeps: CellDepInfo[] }[]> {
    const tx = Transaction.from(txLike);
    const secp256k1 = await this.getAddressObjSecp256k1();

    const scripts: { script: Script; cellDeps: CellDepInfo[] }[] = [];
    for (const input of tx.inputs) {
      const {
        cellOutput: { lock },
      } = await input.getCell(this.client);

      if (scripts.some(({ script }) => script.eq(lock))) {
        continue;
      }

      if (lock.eq(secp256k1.script)) {
        const scriptInfo = await this.client.findKnownScript(lock);
        if (scriptInfo) {
          scripts.push({
            script: lock,
            cellDeps: scriptInfo.cellDeps,
          });
        }
      }
    }

    return scripts;
  }

  /**
   * @warning
   * Since transaction preparation will be automatically done in signOnlyTransaction, so
   * this method is not recommended to explicitly use.
   */
  async prepareTransaction(txLike: TransactionLike): Promise<Transaction> {
    const tx = Transaction.from(txLike);
    const metadata = this.getMultisigMetadata();

    await Promise.all(
      (await this.getRelatedScripts(tx)).map(async ({ script, cellDeps }) => {
        await tx.prepareMultisigWitness(
          script,
          metadata,
          this.multisig.threshold,
          this.client,
        );
        await tx.addCellDepInfos(this.client, cellDeps);
      }),
    );
    return tx;
  }

  async signOnlyTransaction(txLike: TransactionLike): Promise<Transaction> {
    let lastIndex = -1;
    let tx = Transaction.from(txLike);
    const metadata = this.getMultisigMetadata();
    const emptySignature = hexFrom(Array.from(new Array(65), () => 0));

    for (const { script } of await this.getRelatedScripts(tx)) {
      const index = await tx.findInputIndexByLock(script, this.client);
      if (!index) {
        return tx;
      }
      if (index === lastIndex) {
        continue;
      } else {
        lastIndex = index;
      }

      let witness = tx.getWitnessArgsAt(index);
      if (!witness || !witness.lock?.startsWith(metadata)) {
        tx = await this.prepareTransaction(tx);
      }

      witness = tx.getWitnessArgsAt(index);
      if (!witness || !witness.lock) {
        throw new Error("Multisig witness not prepared");
      }

      // Signatures array is placed after the multisig metadata, in 65 bytes per signature
      const signatures =
        witness.lock
          .slice(metadata.length)
          .match(/.{1,130}/g)
          ?.map(hexFrom) || [];
      const insertIndex = signatures.findIndex((sig) => sig === emptySignature);
      if (signatures.length < this.multisig.threshold) {
        throw new Error("Not enough signature slots to threshold");
      }
      if (insertIndex === -1) {
        throw new Error("Signatures have been filled");
      }

      // Empty multisig witness for current signing
      witness.lock = hexConcat(
        metadata,
        ...Array.from(new Array(this.multisig.threshold), () => emptySignature),
      );
      tx.setWitnessArgsAt(index, witness);
      const info = await tx.getSignHashInfo(script, this.client);
      if (!info) {
        return tx;
      }

      const signature = await this._signMessage(info.message);
      signatures[insertIndex] = signature;

      witness.lock = hexConcat(metadata, ...signatures);
      tx.setWitnessArgsAt(index, witness);
    }

    return tx;
  }

  /**
   * Check if the multisig witness is fulfilled
   *
   * @param txLike - The transaction to check.
   * @returns A promise that resolves to true if the multisig witness is fulfilled, false otherwise.
   */
  async signaturesFulfilled(txLike: TransactionLike): Promise<boolean> {
    const tx = Transaction.from(txLike);
    const metadata = this.getMultisigMetadata();
    const emptySignature = hexFrom(Array.from(new Array(65), () => 0));

    for (const { script } of await this.getRelatedScripts(tx)) {
      const index = await tx.findInputIndexByLock(script, this.client);
      if (!index) {
        return false;
      }

      const witness = tx.getWitnessArgsAt(index);
      if (!witness || !witness.lock?.startsWith(metadata)) {
        return false;
      }

      const signatures =
        witness.lock
          .slice(metadata.length)
          .match(/.{1,130}/g)
          ?.map(hexFrom) || [];
      if (
        signatures.length < this.multisig.threshold ||
        signatures.some((sig) => sig === emptySignature)
      ) {
        return false;
      }
    }

    return true;
  }
}
