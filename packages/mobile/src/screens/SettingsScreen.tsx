import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useWallet} from '../contexts/WalletContext';
import {SecureKeystore} from '../services/keystore';

const SettingsScreen = () => {
  const {currentAccount, accounts, lock, deleteAccount, switchAccount} =
    useWallet();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
    loadBiometricSetting();
  }, []);

  const checkBiometricAvailability = async () => {
    const available = await SecureKeystore.isBiometricAvailable();
    setBiometricAvailable(available);
  };

  const loadBiometricSetting = async () => {
    try {
      const enabled = await AsyncStorage.getItem('@wallet_biometric_enabled');
      setBiometricEnabled(enabled === 'true');
    } catch (error) {
      console.error('Failed to load biometric setting:', error);
    }
  };

  const toggleBiometric = async (value: boolean) => {
    try {
      await AsyncStorage.setItem(
        '@wallet_biometric_enabled',
        value.toString(),
      );
      setBiometricEnabled(value);
    } catch (error) {
      Alert.alert('Error', 'Failed to update biometric setting');
    }
  };

  const handleLock = async () => {
    Alert.alert('Lock Wallet', 'Are you sure you want to lock your wallet?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Lock',
        style: 'destructive',
        onPress: async () => {
          await lock();
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    if (!currentAccount) return;

    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete "${currentAccount.name}"? This action cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount(currentAccount.name);
              Alert.alert('Success', 'Account deleted successfully');
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error
                  ? error.message
                  : 'Failed to delete account',
              );
            }
          },
        },
      ],
    );
  };

  const handleSwitchAccount = () => {
    Alert.alert(
      'Switch Account',
      'Select an account to switch to',
      accounts.map(account => ({
        text: account.name,
        onPress: async () => {
          try {
            await switchAccount(account);
            Alert.alert('Success', `Switched to ${account.name}`);
          } catch (error) {
            Alert.alert('Error', 'Failed to switch account');
          }
        },
      })),
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="account-circle" size={24} color="#007AFF" />
          <Text style={styles.menuItemText}>
            {currentAccount?.name || 'No Account'}
          </Text>
          <Icon name="chevron-right" size={24} color="#CCC" />
        </TouchableOpacity>

        {accounts.length > 1 && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleSwitchAccount}>
            <Icon name="account-switch" size={24} color="#007AFF" />
            <Text style={styles.menuItemText}>Switch Account</Text>
            <Icon name="chevron-right" size={24} color="#CCC" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.menuItem} onPress={handleLock}>
          <Icon name="lock" size={24} color="#007AFF" />
          <Text style={styles.menuItemText}>Lock Wallet</Text>
          <Icon name="chevron-right" size={24} color="#CCC" />
        </TouchableOpacity>
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>

        <View style={styles.menuItem}>
          <Icon name="fingerprint" size={24} color="#007AFF" />
          <Text style={styles.menuItemText}>Biometric Authentication</Text>
          <Switch
            value={biometricEnabled}
            onValueChange={toggleBiometric}
            disabled={!biometricAvailable}
          />
        </View>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="key" size={24} color="#007AFF" />
          <Text style={styles.menuItemText}>Export Private Key</Text>
          <Icon name="chevron-right" size={24} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="restore" size={24} color="#007AFF" />
          <Text style={styles.menuItemText}>Backup Wallet</Text>
          <Icon name="chevron-right" size={24} color="#CCC" />
        </TouchableOpacity>
      </View>

      {/* Network Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Network</Text>

        <View style={styles.menuItem}>
          <Icon name="web" size={24} color="#007AFF" />
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemText}>Network</Text>
            <Text style={styles.menuItemSubtext}>CKB Testnet</Text>
          </View>
          <Icon name="chevron-right" size={24} color="#CCC" />
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="information" size={24} color="#007AFF" />
          <Text style={styles.menuItemText}>Version</Text>
          <Text style={styles.menuItemSubtext}>0.1.0</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="file-document" size={24} color="#007AFF" />
          <Text style={styles.menuItemText}>Terms of Service</Text>
          <Icon name="chevron-right" size={24} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="shield-check" size={24} color="#007AFF" />
          <Text style={styles.menuItemText}>Privacy Policy</Text>
          <Icon name="chevron-right" size={24} color="#CCC" />
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.dangerTitle]}>
          Danger Zone
        </Text>

        <TouchableOpacity
          style={[styles.menuItem, styles.dangerItem]}
          onPress={handleDeleteAccount}>
          <Icon name="delete" size={24} color="#FF3B30" />
          <Text style={[styles.menuItemText, styles.dangerText]}>
            Delete Account
          </Text>
          <Icon name="chevron-right" size={24} color="#CCC" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  dangerTitle: {
    color: '#FF3B30',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
  },
  menuItemSubtext: {
    fontSize: 14,
    color: '#999',
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#FF3B30',
  },
});

export default SettingsScreen;
