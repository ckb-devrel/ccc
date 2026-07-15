import { Address } from "../../address/index.js";
import { Bytes, BytesLike, bytesConcat, bytesFrom } from "../../bytes/index.js";
import {
  Script,
  Transaction,
  TransactionLike,
  WitnessArgs,
} from "../../ckb/index.js";
import { KnownScript } from "../../client/index.js";
import { Hasher, HasherKeecak256 } from "../../hasher/index.js";
import { Hex, HexLike, hexFrom } from "../../hex/index.js";
import { numToBytes } from "../../num/index.js";
import { reduceAsync } from "../../utils/index.js";
import { Signer, SignerSignType, SignerType } from "../signer/index.js";

/**
 * An abstract class extending Signer for Ethereum Virtual Machine (EVM) based signing operations.
 * This class provides methods to get EVM account, internal address, and signing transactions.
 * @public
 */
export abstract class SignerEvm extends Signer {
  get type(): SignerType {
    return SignerType.EVM;
  }

  get signType(): SignerSignType {
    return SignerSignType.EvmPersonal;
  }

  /**
   * Gets the EVM account associated with the signer.
   *
   * @returns A promise that resolves to a string representing the EVM account.
   */
  abstract getEvmAccount(): Promise<Hex>;

  /**
   * Gets the internal address, which is the EVM account in this case.
   *
   * @returns A promise that resolves to a string representing the internal address.
   */
  async getInternalAddress(): Promise<string> {
    return this.getEvmAccount();
  }

  /**
   * Gets an array of Address objects representing the known script addresses for the signer.
   *
   * @returns A promise that resolves to an array of Address objects.
   */
  async getAddressObjs(): Promise<Address[]> {
    const account = await this.getEvmAccount();
    const addresses = await Promise.all([
      this._getOmniLockAddresses(account),
      this._getPWLockAddresses(account),
    ]);

    return addresses.flat();
  }

  _getOmniLockAddresses(account: HexLike): Promise<Address[]> {
    return Promise.all([
      this._getOmniLockEvmAddressObj(account),
      this._getOmniLockOldEvmAddressObj(account),
    ]);
  }

  async _getPWLockAddresses(account: HexLike): Promise<Address[]> {
    const addr = await this._getPWLockEvmAddressObj(account);
    if (!addr) {
      return [];
    }
    return [addr];
  }

  async _getOmniLockEvmAddressObj(account: HexLike): Promise<Address> {
    return Address.fromKnownScript(
      this.client,
      KnownScript.OmniLock,
      hexFrom([0x12, ...bytesFrom(account), 0x00]),
    );
  }

  async _getOmniLockOldEvmAddressObj(account: HexLike): Promise<Address> {
    return Address.fromKnownScript(
      this.client,
      KnownScript.OmniLock,
      hexFrom([0x1, ...bytesFrom(account), 0x00]),
    );
  }

  async _getPWLockEvmAddressObj(
    account: HexLike,
  ): Promise<Address | undefined> {
    try {
      return Address.fromKnownScript(
        this.client,
        KnownScript.PWLock,
        hexFrom(bytesFrom(account)),
      );
    } catch {}
    return;
  }

  /**
   * prepare a transaction before signing. This method is not implemented and should be overridden by subclasses.
   *
   * @param txLike - The transaction to prepare, represented as a TransactionLike object.
   * @returns A promise that resolves to the prepared Transaction object.
   */
  async prepareTransaction(txLike: TransactionLike): Promise<Transaction> {
    const tx = Transaction.from(txLike);
    if (
      (await tx.findInputIndexByLockId(
        await this.client.getKnownScript(KnownScript.OmniLock),
        this.client,
      )) !== undefined
    ) {
      await tx.addCellDepsOfKnownScripts(this.client, KnownScript.OmniLock);
    }
    if (
      (await tx.findInputIndexByLockId(
        await this.client.getKnownScript(KnownScript.PWLock),
        this.client,
      )) !== undefined
    ) {
      await tx.addCellDepsOfKnownScripts(this.client, KnownScript.PWLock);
    }

    const account = await this.getEvmAccount();
    const omniLockAddresses = await this._getOmniLockAddresses(account);
    const pwLockAddresses = await this._getPWLockAddresses(account);

    const omniTx = reduceAsync(
      omniLockAddresses,
      (tx: Transaction, { script }) =>
        tx.prepareSighashAllWitness(script, 85, this.client),
      tx,
    );

    return reduceAsync(
      pwLockAddresses,
      (tx: Transaction, { script }) =>
        tx.prepareSighashAllWitness(script, 65, this.client),
      omniTx,
    );
  }

  /**
   * Signs a transaction without modifying it.
   *
   * @param txLike - The transaction to sign, represented as a TransactionLike object.
   * @returns A promise that resolves to a signed Transaction object.
   */
  async signOnlyTransaction(txLike: TransactionLike): Promise<Transaction> {
    let tx = Transaction.from(txLike);

    const account = await this.getEvmAccount();
    const { script: evmScript } = await this._getOmniLockEvmAddressObj(account);
    const { script: oldEvmScript } =
      await this._getOmniLockOldEvmAddressObj(account);

    tx = await this._signOmniLockScriptForTransaction(
      tx,
      evmScript,
      (hash) => `CKB transaction: ${hash}`,
    );
    tx = await this._signOmniLockScriptForTransaction(
      tx,
      oldEvmScript,
      (hash) => bytesFrom(hash),
    );

    const pwAddress = await this._getPWLockEvmAddressObj(account);
    if (pwAddress) {
      tx = await this._signPWLockScriptForTransaction(
        tx,
        pwAddress.script,
        (hash) => bytesFrom(hash),
      );
    }

    return tx;
  }

  async _signOmniLockScriptForTransaction(
    tx: Transaction,
    script: Script,
    messageTransformer: (hash: string) => BytesLike,
  ): Promise<Transaction> {
    const info = await this._signPersonalEvmForTransaction(
      tx,
      script,
      messageTransformer,
    );
    if (!info) {
      return tx;
    }

    const witness = WitnessArgs.fromBytes(tx.witnesses[info.position]);
    witness.lock = hexFrom(
      bytesConcat(
        numToBytes(5 * 4 + info.signature.length, 4),
        numToBytes(4 * 4, 4),
        numToBytes(5 * 4 + info.signature.length, 4),
        numToBytes(5 * 4 + info.signature.length, 4),
        numToBytes(info.signature.length, 4),
        info.signature,
      ),
    );

    tx.setWitnessArgs(info.position, witness);

    return tx;
  }

  async _signPWLockScriptForTransaction(
    tx: Transaction,
    script: Script,
    messageTransformer: (hash: string) => BytesLike,
  ): Promise<Transaction> {
    const info = await this._signPersonalEvmForTransaction(
      tx,
      script,
      messageTransformer,
      new HasherKeecak256(),
    );
    if (!info) {
      return tx;
    }

    const witness = WitnessArgs.fromBytes(tx.witnesses[info.position]);
    witness.lock = hexFrom(info.signature);
    tx.setWitnessArgs(info.position, witness);

    return tx;
  }

  async _signPersonalEvmForTransaction(
    tx: Transaction,
    script: Script,
    messageTransformer: (hash: string) => BytesLike,
    hasher?: Hasher,
  ): Promise<{ signature: Bytes; position: number } | undefined> {
    const info = await tx.getSignHashInfo(script, this.client, hasher);
    if (!info) {
      return;
    }

    const signature = bytesFrom(
      await this.signMessageRaw(messageTransformer(info.message)),
    );
    if (signature[signature.length - 1] >= 27) {
      signature[signature.length - 1] -= 27;
    }

    return { signature, position: info.position };
  }
}
