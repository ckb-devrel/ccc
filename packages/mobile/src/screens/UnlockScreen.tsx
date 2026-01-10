import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBiometrics from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useWallet} from '../contexts/WalletContext';

const UnlockScreen = () => {
  const {accounts, currentAccount, unlock, isLoading} = useWallet();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);

  useEffect(() => {
    checkBiometricSettings();
    attemptBiometricUnlock();
  }, []);

  const checkBiometricSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem('@wallet_biometric_enabled');
      setBiometricEnabled(enabled === 'true');

      const rnBiometrics = new ReactNativeBiometrics();
      const {available, biometryType} = await rnBiometrics.isSensorAvailable();
      if (available) {
        setBiometricType(biometryType);
      }
    } catch (error) {
      console.error('Failed to check biometric settings:', error);
    }
  };

  const attemptBiometricUnlock = async () => {
    const enabled = await AsyncStorage.getItem('@wallet_biometric_enabled');
    if (enabled === 'true') {
      await handleBiometricUnlock();
    }
  };

  const handleBiometricUnlock = async () => {
    try {
      const rnBiometrics = new ReactNativeBiometrics();
      const {success} = await rnBiometrics.simplePrompt({
        promptMessage: 'Unlock wallet',
      });

      if (success) {
        const accountToUnlock = currentAccount || accounts[0];
        if (accountToUnlock) {
          await unlock(accountToUnlock);
        }
      }
    } catch (error) {
      console.error('Biometric unlock failed:', error);
    }
  };

  const handleManualUnlock = async () => {
    try {
      const accountToUnlock = currentAccount || accounts[0];
      if (accountToUnlock) {
        await unlock(accountToUnlock);
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to unlock wallet',
      );
    }
  };

  const getBiometricIcon = () => {
    if (biometricType === 'FaceID') {
      return 'face-recognition';
    } else if (biometricType === 'TouchID' || biometricType === 'Biometrics') {
      return 'fingerprint';
    }
    return 'lock';
  };

  const accountToDisplay = currentAccount || accounts[0];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Icon name="wallet" size={80} color="#007AFF" />
          <Text style={styles.title}>CKB Mobile Wallet</Text>
          <Text style={styles.subtitle}>Unlock to continue</Text>
        </View>

        {/* Account Info */}
        {accountToDisplay && (
          <View style={styles.accountCard}>
            <Icon name="account-circle" size={40} color="#007AFF" />
            <Text style={styles.accountName}>{accountToDisplay.name}</Text>
            <Text style={styles.accountAddress}>
              {accountToDisplay.address.slice(0, 10)}...
              {accountToDisplay.address.slice(-8)}
            </Text>
          </View>
        )}

        {/* Unlock Buttons */}
        {biometricEnabled && biometricType && (
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometricUnlock}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Icon name={getBiometricIcon()} size={24} color="#FFF" />
                <Text style={styles.biometricButtonText}>
                  Unlock with {biometricType}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.unlockButton,
            biometricEnabled && styles.unlockButtonSecondary,
          ]}
          onPress={handleManualUnlock}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator
              color={biometricEnabled ? '#007AFF' : '#FFF'}
            />
          ) : (
            <>
              <Icon
                name="lock-open"
                size={24}
                color={biometricEnabled ? '#007AFF' : '#FFF'}
              />
              <Text
                style={[
                  styles.unlockButtonText,
                  biometricEnabled && styles.unlockButtonTextSecondary,
                ]}>
                Unlock Wallet
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footerText}>
          Your keys are stored securely on this device
        </Text>
      </View>
    </View>
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
  },
  accountCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  accountName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 12,
  },
  accountAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  biometricButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  biometricButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  unlockButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockButtonSecondary: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  unlockButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  unlockButtonTextSecondary: {
    color: '#007AFF',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 32,
  },
});

export default UnlockScreen;
