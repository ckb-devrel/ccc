import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import {useWallet} from '../contexts/WalletContext';

const SendScreen = () => {
  const {balance, sendTransaction, isLoading} = useWallet();
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  const handleSend = async () => {
    if (!toAddress) {
      Alert.alert('Error', 'Please enter recipient address');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const amountNum = parseFloat(amount);
    const balanceNum = parseFloat(balance);

    if (amountNum > balanceNum) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    Alert.alert(
      'Confirm Transaction',
      `Send ${amount} CKB to ${toAddress.slice(0, 10)}...${toAddress.slice(-8)}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Send',
          onPress: async () => {
            try {
              const txHash = await sendTransaction(toAddress, amount);
              Alert.alert(
                'Success',
                `Transaction sent!\nHash: ${txHash.slice(0, 10)}...`,
              );
              setToAddress('');
              setAmount('');
              setMemo('');
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to send transaction',
              );
            }
          },
        },
      ],
    );
  };

  const setMaxAmount = () => {
    // Reserve some for transaction fee
    const maxAmount = Math.max(0, parseFloat(balance) - 0.1);
    setAmount(maxAmount.toString());
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Balance Display */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>{balance} CKB</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Recipient Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Recipient Address</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="ckb1..."
                value={toAddress}
                onChangeText={setToAddress}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.scanButton}>
                <Icon name="qrcode-scan" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Amount (CKB)</Text>
              <TouchableOpacity onPress={setMaxAmount}>
                <Text style={styles.maxButton}>MAX</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Memo (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Memo (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add a note..."
              value={memo}
              onChangeText={setMemo}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Transaction Fee */}
          <View style={styles.feeSection}>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Network Fee</Text>
              <Text style={styles.feeAmount}>~0.001 CKB</Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabelBold}>Total</Text>
              <Text style={styles.feeAmountBold}>
                {amount ? (parseFloat(amount) + 0.001).toFixed(3) : '0.00'} CKB
              </Text>
            </View>
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!toAddress || !amount || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!toAddress || !amount || isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Icon name="send" size={20} color="#FFF" />
                <Text style={styles.sendButtonText}>Send Transaction</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
  },
  balanceCard: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 8,
  },
  form: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  maxButton: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  scanButton: {
    marginLeft: 8,
    padding: 8,
  },
  feeSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feeLabel: {
    fontSize: 14,
    color: '#666',
  },
  feeAmount: {
    fontSize: 14,
    color: '#666',
  },
  feeLabelBold: {
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
  },
  feeAmountBold: {
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
  sendButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default SendScreen;
