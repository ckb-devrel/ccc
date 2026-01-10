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
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useWallet} from '../contexts/WalletContext';

const CreateWalletScreen = () => {
  const navigation = useNavigation();
  const {createAccount, isLoading} = useWallet();
  const [walletName, setWalletName] = useState('');

  const handleCreate = async () => {
    if (!walletName.trim()) {
      Alert.alert('Error', 'Please enter a wallet name');
      return;
    }

    try {
      const account = await createAccount(walletName);
      Alert.alert(
        'Success',
        `Wallet "${walletName}" created successfully!\n\nAddress: ${account.address.slice(0, 10)}...`,
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create wallet',
      );
    }
  };

  const handleImport = () => {
    navigation.navigate('ImportWallet' as never);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Icon name="wallet-plus" size={80} color="#007AFF" />
          <Text style={styles.title}>Create New Wallet</Text>
          <Text style={styles.subtitle}>
            Start your journey with CKB blockchain
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Wallet Name</Text>
            <TextInput
              style={styles.input}
              placeholder="My CKB Wallet"
              value={walletName}
              onChangeText={setWalletName}
              autoCapitalize="words"
              maxLength={32}
            />
          </View>

          <TouchableOpacity
            style={[styles.createButton, isLoading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.createButtonText}>Create Wallet</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Import Option */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have a wallet?</Text>
          <TouchableOpacity onPress={handleImport}>
            <Text style={styles.importLink}>Import Existing Wallet</Text>
          </TouchableOpacity>
        </View>

        {/* Security Notice */}
        <View style={styles.notice}>
          <Icon name="shield-check" size={20} color="#34C759" />
          <Text style={styles.noticeText}>
            Your private key is stored securely on this device
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
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
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  createButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  importLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    paddingHorizontal: 16,
  },
  noticeText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    textAlign: 'center',
  },
});

export default CreateWalletScreen;
