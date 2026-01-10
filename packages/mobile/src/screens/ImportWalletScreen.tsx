import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useWallet} from '../contexts/WalletContext';

const ImportWalletScreen = () => {
  const navigation = useNavigation();
  const {importAccount, isLoading} = useWallet();
  const [walletName, setWalletName] = useState('');
  const [privateKey, setPrivateKey] = useState('');

  const handleImport = async () => {
    if (!walletName.trim()) {
      Alert.alert('Error', 'Please enter a wallet name');
      return;
    }

    if (!privateKey.trim()) {
      Alert.alert('Error', 'Please enter your private key');
      return;
    }

    // Validate private key format
    const cleanKey = privateKey.trim();
    if (!cleanKey.startsWith('0x') || cleanKey.length !== 66) {
      Alert.alert(
        'Error',
        'Invalid private key format. Must be 64 hex characters starting with 0x',
      );
      return;
    }

    try {
      const account = await importAccount(cleanKey, walletName);
      Alert.alert(
        'Success',
        `Wallet "${walletName}" imported successfully!\n\nAddress: ${account.address.slice(0, 10)}...`,
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to import wallet',
      );
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Icon name="arrow-left" size={24} color="#007AFF" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Icon name="wallet-plus" size={80} color="#007AFF" />
            <Text style={styles.title}>Import Wallet</Text>
            <Text style={styles.subtitle}>
              Restore your wallet using private key
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Wallet Name</Text>
              <TextInput
                style={styles.input}
                placeholder="My Imported Wallet"
                value={walletName}
                onChangeText={setWalletName}
                autoCapitalize="words"
                maxLength={32}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Private Key</Text>
              <TextInput
                style={[styles.input, styles.privateKeyInput]}
                placeholder="0x..."
                value={privateKey}
                onChangeText={setPrivateKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                multiline
              />
              <Text style={styles.helperText}>
                Your private key should start with "0x" followed by 64 hex
                characters
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.importButton, isLoading && styles.buttonDisabled]}
              onPress={handleImport}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.importButtonText}>Import Wallet</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Security Warning */}
          <View style={styles.warning}>
            <Icon name="alert" size={20} color="#FF9500" />
            <Text style={styles.warningText}>
              Never share your private key with anyone. We will never ask for it.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
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
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  privateKeyInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  importButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  importButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    marginLeft: 8,
  },
});

export default ImportWalletScreen;
