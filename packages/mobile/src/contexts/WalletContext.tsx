import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ccc} from '@ckb-ccc/core';
import {MobileSigner} from '../signers/MobileSigner';
import {WalletAccount, Transaction} from '../types';

interface WalletContextType {
  // Wallet state
  isUnlocked: boolean;
  currentAccount: WalletAccount | null;
  accounts: WalletAccount[];
  balance: string;
  transactions: Transaction[];
  isLoading: boolean;

  // Signer
  signer: MobileSigner | null;
  client: ccc.Client;

  // Actions
  createAccount: (name: string) => Promise<WalletAccount>;
  importAccount: (privateKey: string, name: string) => Promise<WalletAccount>;
  switchAccount: (account: WalletAccount) => Promise<void>;
  deleteAccount: (accountName: string) => Promise<void>;
  unlock: (account: WalletAccount) => Promise<void>;
  lock: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  sendTransaction: (to: string, amount: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ACCOUNTS: '@wallet_accounts',
  CURRENT_ACCOUNT: '@wallet_current_account',
  BIOMETRIC_ENABLED: '@wallet_biometric_enabled',
};

interface WalletProviderProps {
  children: ReactNode;
  clientUrl?: string;
  isMainnet?: boolean;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({
  children,
  clientUrl,
  isMainnet = false,
}) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<WalletAccount | null>(
    null,
  );
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [balance, setBalance] = useState('0');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [signer, setSigner] = useState<MobileSigner | null>(null);

  // Initialize CKB client
  const client = new ccc.ClientPublicTestnet();

  // Load accounts from storage on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const accountsJson = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      if (accountsJson) {
        const loadedAccounts = JSON.parse(accountsJson) as WalletAccount[];
        setAccounts(loadedAccounts);
      }

      const currentAccountJson = await AsyncStorage.getItem(
        STORAGE_KEYS.CURRENT_ACCOUNT,
      );
      if (currentAccountJson) {
        const loadedAccount = JSON.parse(currentAccountJson) as WalletAccount;
        setCurrentAccount(loadedAccount);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const saveAccounts = async (newAccounts: WalletAccount[]) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.ACCOUNTS,
        JSON.stringify(newAccounts),
      );
      setAccounts(newAccounts);
    } catch (error) {
      console.error('Failed to save accounts:', error);
      throw error;
    }
  };

  const saveCurrentAccount = async (account: WalletAccount | null) => {
    try {
      if (account) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.CURRENT_ACCOUNT,
          JSON.stringify(account),
        );
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_ACCOUNT);
      }
      setCurrentAccount(account);
    } catch (error) {
      console.error('Failed to save current account:', error);
      throw error;
    }
  };

  const createAccount = async (name: string): Promise<WalletAccount> => {
    try {
      setIsLoading(true);

      const biometricEnabled = await AsyncStorage.getItem(
        STORAGE_KEYS.BIOMETRIC_ENABLED,
      );
      const newSigner = new MobileSigner(
        client,
        biometricEnabled === 'true',
      );

      const account = await newSigner.createAccount(name);

      const updatedAccounts = [...accounts, account];
      await saveAccounts(updatedAccounts);
      await saveCurrentAccount(account);

      setSigner(newSigner);
      setIsUnlocked(true);

      return account;
    } catch (error) {
      console.error('Failed to create account:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const importAccount = async (
    privateKey: string,
    name: string,
  ): Promise<WalletAccount> => {
    try {
      setIsLoading(true);

      const biometricEnabled = await AsyncStorage.getItem(
        STORAGE_KEYS.BIOMETRIC_ENABLED,
      );
      const newSigner = new MobileSigner(
        client,
        biometricEnabled === 'true',
      );

      const account = await newSigner.importAccount(privateKey, name);

      const updatedAccounts = [...accounts, account];
      await saveAccounts(updatedAccounts);
      await saveCurrentAccount(account);

      setSigner(newSigner);
      setIsUnlocked(true);

      return account;
    } catch (error) {
      console.error('Failed to import account:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const switchAccount = async (account: WalletAccount): Promise<void> => {
    try {
      setIsLoading(true);
      await saveCurrentAccount(account);

      if (isUnlocked && signer) {
        await signer.connect(account);
      }
    } catch (error) {
      console.error('Failed to switch account:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAccount = async (accountName: string): Promise<void> => {
    try {
      setIsLoading(true);

      if (signer) {
        await signer.deleteAccount(accountName);
      }

      const updatedAccounts = accounts.filter(
        acc => acc.name !== accountName,
      );
      await saveAccounts(updatedAccounts);

      if (currentAccount?.name === accountName) {
        if (updatedAccounts.length > 0) {
          await saveCurrentAccount(updatedAccounts[0]);
        } else {
          await saveCurrentAccount(null);
          setIsUnlocked(false);
          setSigner(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const unlock = async (account: WalletAccount): Promise<void> => {
    try {
      setIsLoading(true);

      const biometricEnabled = await AsyncStorage.getItem(
        STORAGE_KEYS.BIOMETRIC_ENABLED,
      );
      const newSigner = new MobileSigner(
        client,
        biometricEnabled === 'true',
      );

      await newSigner.connect(account);

      setSigner(newSigner);
      setIsUnlocked(true);
      await saveCurrentAccount(account);

      // Refresh balance and transactions
      await refreshBalance();
      await refreshTransactions();
    } catch (error) {
      console.error('Failed to unlock wallet:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const lock = async (): Promise<void> => {
    try {
      if (signer) {
        await signer.disconnect();
      }
      setSigner(null);
      setIsUnlocked(false);
      setBalance('0');
      setTransactions([]);
    } catch (error) {
      console.error('Failed to lock wallet:', error);
      throw error;
    }
  };

  const refreshBalance = async (): Promise<void> => {
    if (!signer || !currentAccount) {
      return;
    }

    try {
      const addresses = await signer.getAddressObjs();
      if (addresses.length === 0) {
        return;
      }

      let totalCapacity = ccc.Zero;
      for await (const cell of client.findCellsByLock(
        addresses[0].script,
        undefined,
        true,
      )) {
        totalCapacity += cell.cellOutput.capacity;
      }

      setBalance(ccc.fixedPointToString(totalCapacity));
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    }
  };

  const refreshTransactions = async (): Promise<void> => {
    if (!signer || !currentAccount) {
      return;
    }

    try {
      const addresses = await signer.getAddressObjs();
      if (addresses.length === 0) {
        return;
      }

      const txList: Transaction[] = [];

      // Fetch transactions (simplified - in production, use indexer)
      for await (const tx of client.findTransactions(
        {
          script: addresses[0].script,
          scriptType: 'lock',
          scriptSearchMode: 'exact',
        },
        'desc',
        100,
      )) {
        txList.push({
          hash: tx.txHash,
          from: currentAccount.address,
          to: '', // Would need to parse outputs
          amount: '0', // Would need to calculate
          timestamp: Date.now(),
          status: 'confirmed',
        });
      }

      setTransactions(txList);
    } catch (error) {
      console.error('Failed to refresh transactions:', error);
    }
  };

  const sendTransaction = async (
    to: string,
    amount: string,
  ): Promise<string> => {
    if (!signer) {
      throw new Error('Wallet not unlocked');
    }

    try {
      setIsLoading(true);

      const toAddress = await ccc.Address.fromString(to, client);
      const amountBI = ccc.fixedPointFrom(amount);

      const tx = ccc.Transaction.from({
        outputs: [{lock: toAddress.script, capacity: amountBI}],
      });

      await tx.completeInputsByCapacity(signer);
      await tx.completeFeeBy(signer, 1000);

      const txHash = await signer.sendTransaction(tx);

      // Refresh balance and transactions
      await refreshBalance();
      await refreshTransactions();

      return txHash;
    } catch (error) {
      console.error('Failed to send transaction:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value: WalletContextType = {
    isUnlocked,
    currentAccount,
    accounts,
    balance,
    transactions,
    isLoading,
    signer,
    client,
    createAccount,
    importAccount,
    switchAccount,
    deleteAccount,
    unlock,
    lock,
    refreshBalance,
    refreshTransactions,
    sendTransaction,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};
