export interface WalletAccount {
  address: string;
  publicKey: string;
  name: string;
  createdAt: number;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface WalletState {
  isUnlocked: boolean;
  currentAccount: WalletAccount | null;
  accounts: WalletAccount[];
  balance: string;
  transactions: Transaction[];
}

export interface BiometricConfig {
  enabled: boolean;
  type: 'fingerprint' | 'face' | 'iris' | null;
}

export interface SecureStorageKeys {
  PRIVATE_KEY: string;
  MNEMONIC: string;
  PASSWORD_HASH: string;
  BIOMETRIC_ENABLED: string;
}
