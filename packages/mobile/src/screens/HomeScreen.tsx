import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import {useWallet} from '../contexts/WalletContext';

const HomeScreen = () => {
  const {
    currentAccount,
    balance,
    transactions,
    isLoading,
    refreshBalance,
    refreshTransactions,
  } = useWallet();

  useEffect(() => {
    refreshBalance();
    refreshTransactions();
  }, []);

  const onRefresh = async () => {
    await Promise.all([refreshBalance(), refreshTransactions()]);
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    return num.toFixed(2);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
      }>
      {/* Account Section */}
      <View style={styles.accountSection}>
        <View style={styles.accountHeader}>
          <Icon name="account-circle" size={40} color="#007AFF" />
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>
              {currentAccount?.name || 'No Account'}
            </Text>
            <Text style={styles.accountAddress}>
              {currentAccount ? formatAddress(currentAccount.address) : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Balance Section */}
      <View style={styles.balanceSection}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>{formatAmount(balance)} CKB</Text>
        <Text style={styles.balanceUSD}>≈ ${formatAmount(balance)} USD</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity style={styles.actionButton}>
          <Icon name="arrow-up" size={24} color="#007AFF" />
          <Text style={styles.actionText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Icon name="arrow-down" size={24} color="#007AFF" />
          <Text style={styles.actionText}>Receive</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Icon name="swap-horizontal" size={24} color="#007AFF" />
          <Text style={styles.actionText}>Swap</Text>
        </TouchableOpacity>
      </View>

      {/* Transactions Section */}
      <View style={styles.transactionsSection}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {isLoading && transactions.length === 0 ? (
          <ActivityIndicator size="large" color="#007AFF" />
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="receipt-text-outline" size={48} color="#999" />
            <Text style={styles.emptyStateText}>No transactions yet</Text>
          </View>
        ) : (
          transactions.slice(0, 10).map((tx, index) => (
            <View key={tx.hash + index} style={styles.transactionItem}>
              <View style={styles.transactionIcon}>
                <Icon
                  name={
                    tx.from === currentAccount?.address
                      ? 'arrow-up'
                      : 'arrow-down'
                  }
                  size={24}
                  color={
                    tx.from === currentAccount?.address ? '#FF3B30' : '#34C759'
                  }
                />
              </View>
              <View style={styles.transactionDetails}>
                <Text style={styles.transactionHash}>
                  {formatAddress(tx.hash)}
                </Text>
                <Text style={styles.transactionTime}>
                  {new Date(tx.timestamp).toLocaleString()}
                </Text>
              </View>
              <View style={styles.transactionAmount}>
                <Text
                  style={[
                    styles.transactionAmountText,
                    {
                      color:
                        tx.from === currentAccount?.address
                          ? '#FF3B30'
                          : '#34C759',
                    },
                  ]}>
                  {tx.from === currentAccount?.address ? '-' : '+'}
                  {formatAmount(tx.amount)} CKB
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        tx.status === 'confirmed'
                          ? '#34C759'
                          : tx.status === 'pending'
                          ? '#FF9500'
                          : '#FF3B30',
                    },
                  ]}>
                  <Text style={styles.statusText}>{tx.status}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  accountSection: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountInfo: {
    marginLeft: 12,
    flex: 1,
  },
  accountName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  accountAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  balanceSection: {
    backgroundColor: '#007AFF',
    padding: 32,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 8,
  },
  balanceUSD: {
    fontSize: 18,
    color: '#FFF',
    opacity: 0.8,
    marginTop: 4,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFF',
    padding: 20,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    marginTop: 8,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  transactionsSection: {
    backgroundColor: '#FFF',
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionDetails: {
    flex: 1,
    marginLeft: 12,
  },
  transactionHash: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  transactionTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});

export default HomeScreen;
