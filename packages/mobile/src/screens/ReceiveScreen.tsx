import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import {useWallet} from '../contexts/WalletContext';

const ReceiveScreen = () => {
  const {currentAccount} = useWallet();
  const [showQR, setShowQR] = useState(true);

  const copyAddress = async () => {
    if (currentAccount?.address) {
      // In a real app, use Clipboard API
      Alert.alert('Copied', 'Address copied to clipboard');
    }
  };

  const shareAddress = async () => {
    if (currentAccount?.address) {
      try {
        await Share.share({
          message: `My CKB Address: ${currentAccount.address}`,
        });
      } catch (error) {
        console.error('Error sharing address:', error);
      }
    }
  };

  if (!currentAccount) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No account selected</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Receive CKB</Text>
          <Text style={styles.subtitle}>
            Share your address to receive CKB tokens
          </Text>
        </View>

        {/* QR Code */}
        {showQR && (
          <View style={styles.qrContainer}>
            <View style={styles.qrWrapper}>
              <QRCode value={currentAccount.address} size={250} />
            </View>
          </View>
        )}

        {/* Address Display */}
        <View style={styles.addressSection}>
          <Text style={styles.addressLabel}>Your Address</Text>
          <View style={styles.addressContainer}>
            <Text style={styles.addressText} numberOfLines={2}>
              {currentAccount.address}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={copyAddress}>
            <Icon name="content-copy" size={24} color="#007AFF" />
            <Text style={styles.actionButtonText}>Copy Address</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={shareAddress}>
            <Icon name="share-variant" size={24} color="#007AFF" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Warning */}
        <View style={styles.warningBox}>
          <Icon name="information" size={20} color="#FF9500" />
          <Text style={styles.warningText}>
            Only send CKB to this address. Sending other tokens may result in
            permanent loss.
          </Text>
        </View>
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
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  qrWrapper: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  addressSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  addressLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  addressContainer: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  addressText: {
    fontSize: 14,
    color: '#000',
    fontFamily: 'monospace',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 8,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
});

export default ReceiveScreen;
