import * as Keychain from 'react-native-keychain';
import {ccc} from '@ckb-ccc/core';

export class SecureKeystore {
  private static readonly SERVICE_NAME = 'CCC_MOBILE_WALLET';

  /**
   * Store private key securely
   */
  static async storePrivateKey(
    privateKey: string,
    accountName: string,
  ): Promise<void> {
    try {
      await Keychain.setGenericPassword(
        accountName,
        privateKey,
        {
          service: `${this.SERVICE_NAME}_${accountName}`,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        },
      );
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
      const credentials = await Keychain.getGenericPassword({
        service: `${this.SERVICE_NAME}_${accountName}`,
      });

      if (credentials) {
        return credentials.password;
      }
      return null;
    } catch (error) {
      console.error('Failed to retrieve private key:', error);
      return null;
    }
  }

  /**
   * Store private key with biometric authentication
   */
  static async storePrivateKeyWithBiometric(
    privateKey: string,
    accountName: string,
  ): Promise<void> {
    try {
      await Keychain.setGenericPassword(
        accountName,
        privateKey,
        {
          service: `${this.SERVICE_NAME}_${accountName}`,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
        },
      );
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
      const credentials = await Keychain.getGenericPassword({
        service: `${this.SERVICE_NAME}_${accountName}`,
        authenticationPrompt: {
          title: 'Authenticate to access wallet',
          subtitle: 'Use biometric to unlock',
          cancel: 'Cancel',
        },
      });

      if (credentials) {
        return credentials.password;
      }
      return null;
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
      await Keychain.resetGenericPassword({
        service: `${this.SERVICE_NAME}_${accountName}`,
      });
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
      const biometryType = await Keychain.getSupportedBiometryType();
      return biometryType !== null;
    } catch (error) {
      console.error('Failed to check biometric availability:', error);
      return false;
    }
  }

  /**
   * Get supported biometry type
   */
  static async getBiometryType(): Promise<Keychain.BIOMETRY_TYPE | null> {
    try {
      return await Keychain.getSupportedBiometryType();
    } catch (error) {
      console.error('Failed to get biometry type:', error);
      return null;
    }
  }
}
