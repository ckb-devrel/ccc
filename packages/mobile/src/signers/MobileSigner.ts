import {ccc} from '@ckb-ccc/core';
import {SecureKeystore} from '../services/keystore';
import {WalletAccount} from '../types';

/**
 * Mobile signer for CKB blockchain using secure keystore
 * @public
 */
export class MobileSigner extends ccc.Signer {
  private account: WalletAccount | null = null;
  private privateKey: string | null = null;

  constructor(
    client: ccc.Client,
    private readonly useBiometric: boolean = false,
  ) {
    super(client);
  }

  get type(): ccc.SignerType {
    return ccc.SignerType.CKB;
  }

  get signType(): ccc.SignerSignType {
    return ccc.SignerSignType.CkbSecp256k1;
  }

  /**
   * Create a new account with generated private key
   */
  async createAccount(accountName: string): Promise<WalletAccount> {
    const privateKey = SecureKeystore.generatePrivateKey();

    // Store private key securely
    if (this.useBiometric) {
      await SecureKeystore.storePrivateKeyWithBiometric(privateKey, accountName);
    } else {
      await SecureKeystore.storePrivateKey(privateKey, accountName);
    }

    // Derive public key and address
    const signer = new ccc.SignerCkbPrivateKey(this.client, privateKey);
    const address = await signer.getRecommendedAddress();
    const publicKeyHash = await this.getPublicKeyFromPrivateKey(privateKey);

    this.account = {
      address,
      publicKey: publicKeyHash,
      name: accountName,
      createdAt: Date.now(),
    };

    this.privateKey = privateKey;

    return this.account;
  }

  /**
   * Import account from private key
   */
  async importAccount(
    privateKey: string,
    accountName: string,
  ): Promise<WalletAccount> {
    // Validate private key
    if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
      throw new Error('Invalid private key format');
    }

    // Store private key securely
    if (this.useBiometric) {
      await SecureKeystore.storePrivateKeyWithBiometric(privateKey, accountName);
    } else {
      await SecureKeystore.storePrivateKey(privateKey, accountName);
    }

    // Derive public key and address
    const signer = new ccc.SignerCkbPrivateKey(this.client, privateKey);
    const address = await signer.getRecommendedAddress();
    const publicKeyHash = await this.getPublicKeyFromPrivateKey(privateKey);

    this.account = {
      address,
      publicKey: publicKeyHash,
      name: accountName,
      createdAt: Date.now(),
    };

    this.privateKey = privateKey;

    return this.account;
  }

  /**
   * Connect to an existing account
   */
  async connect(account: WalletAccount): Promise<void> {
    this.account = account;

    // Load private key from keystore
    if (this.useBiometric) {
      this.privateKey = await SecureKeystore.getPrivateKeyWithBiometric(
        account.name,
      );
    } else {
      this.privateKey = await SecureKeystore.getPrivateKey(account.name);
    }

    if (!this.privateKey) {
      throw new Error('Failed to load private key from keystore');
    }
  }

  async disconnect(): Promise<void> {
    await super.disconnect();
    this.account = null;
    this.privateKey = null;
  }

  async isConnected(): Promise<boolean> {
    return this.account !== null && this.privateKey !== null;
  }

  async getInternalAddress(): Promise<string> {
    if (!this.account) {
      throw new Error('Not connected');
    }
    return this.account.address;
  }

  async getIdentity(): Promise<string> {
    if (!this.account) {
      throw new Error('Not connected');
    }
    return JSON.stringify({
      address: this.account.address,
      publicKey: this.account.publicKey,
      name: this.account.name,
    });
  }

  async getAddressObjs(): Promise<ccc.Address[]> {
    const address = await this.getInternalAddress();
    return [await ccc.Address.fromString(address, this.client)];
  }

  /**
   * Sign a transaction
   */
  async signOnlyTransaction(
    txLike: ccc.TransactionLike,
  ): Promise<ccc.Transaction> {
    if (!this.privateKey) {
      throw new Error('Not connected');
    }

    // Use the built-in CKB private key signer to sign
    const signer = new ccc.SignerCkbPrivateKey(this.client, this.privateKey);
    return signer.signOnlyTransaction(txLike);
  }

  /**
   * Sign a message
   */
  async signMessageRaw(message: string | ccc.BytesLike): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Not connected');
    }

    // Use the built-in CKB private key signer to sign messages
    const signer = new ccc.SignerCkbPrivateKey(this.client, this.privateKey);
    return signer.signMessageRaw(message);
  }

  /**
   * Get public key from private key
   */
  private async getPublicKeyFromPrivateKey(
    privateKey: string,
  ): Promise<string> {
    const signer = new ccc.SignerCkbPrivateKey(this.client, privateKey);
    const address = await signer.getAddressObjs();
    return address[0].script.args;
  }

  /**
   * Delete account
   */
  async deleteAccount(accountName: string): Promise<void> {
    await SecureKeystore.deletePrivateKey(accountName);
    if (this.account?.name === accountName) {
      this.account = null;
      this.privateKey = null;
    }
  }

  /**
   * Get current account
   */
  getCurrentAccount(): WalletAccount | null {
    return this.account;
  }
}
