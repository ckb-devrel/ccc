import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import {ccc} from '@ckb-ccc/core';

export class SecureKeystore {
  private static readonly KEY_PREFIX = 'CCC_MOBILE_WALLET';

  /**
   * Store private key securely
   */
  static async storePrivateKey(
    privateKey: string,
    accountName: string,
  ): Promise<void> {
    try {
      const key = `${this.KEY_PREFIX}_${accountName}`;
      await SecureStore.setItemAsync(key, privateKey);
    } catch (error) {
      console.error('Failed to store private key:', error);
      throw new Error('Failed to store private key securely');
    }
  }

  /**
   * Retrieve private key
   */
  static async getPrivateKey(accountName: string): Promise<string | null> {
    try {
      const key = `${this.KEY_PREFIX}_${accountName}`;
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Failed to retrieve private key:', error);
      return null;
    }
  }

  /**
   * Store private key with biometric authentication (Expo uses device security by default)
   */
  static async storePrivateKeyWithBiometric(
    privateKey: string,
    accountName: string,
  ): Promise<void> {
    try {
      const key = `${this.KEY_PREFIX}_${accountName}`;
      await SecureStore.setItemAsync(key, privateKey, {
        requireAuthentication: true,
      });
    } catch (error) {
      console.error('Failed to store private key with biometric:', error);
      throw new Error('Failed to store private key with biometric');
    }
  }

  /**
   * Get private key with biometric authentication
   */
  static async getPrivateKeyWithBiometric(
    accountName: string,
  ): Promise<string | null> {
    try {
      // First authenticate with biometric
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access wallet',
        fallbackLabel: 'Use passcode',
      });

      if (!result.success) {
        throw new Error('Biometric authentication failed');
      }

      const key = `${this.KEY_PREFIX}_${accountName}`;
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Failed to retrieve private key with biometric:', error);
      return null;
    }
  }

  /**
   * Delete private key
   */
  static async deletePrivateKey(accountName: string): Promise<void> {
    try {
      const key = `${this.KEY_PREFIX}_${accountName}`;
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Failed to delete private key:', error);
      throw new Error('Failed to delete private key');
    }
  }

  /**
   * Generate a new private key
   */
  static generatePrivateKey(): string {
    const privateKey = ccc.hexFrom(crypto.getRandomValues(new Uint8Array(32)));
    return privateKey;
  }

  /**
   * Check if biometric authentication is available
   */
  static async isBiometricAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Failed to check biometric availability:', error);
      return false;
    }
  }

  /**
   * Get supported biometry type
   */
  static async getBiometryType(): Promise<string | null> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'FaceID';
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'TouchID';
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'Iris';
      }
      return 'Biometric';
    } catch (error) {
      console.error('Failed to get biometry type:', error);
      return null;
    }
  }
}
