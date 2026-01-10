# CCC Mobile Wallet

An Expo/React Native mobile wallet for CKB (Nervos Network) blockchain, built on top of the CCC SDK.

> **🚀 Quick Start**: See [EXPO_SETUP.md](./EXPO_SETUP.md) for detailed setup instructions!

## Features

✨ **Core Features**
- 🔐 Secure key management with device keystore
- 📱 Native iOS and Android support
- 💰 Send and receive CKB tokens
- 📊 Transaction history tracking
- 🔄 Real-time balance updates
- 📲 QR code support for easy address sharing

🔒 **Security**
- Biometric authentication (Face ID, Touch ID, Fingerprint)
- Encrypted private key storage
- Device-only key access
- Secure transaction signing

🎨 **User Experience**
- Clean, intuitive interface
- Multiple account management
- Network switching support
- Transaction status notifications

## Architecture

The mobile wallet is built using:

- **Expo ~52.0** - React Native development framework
- **React Native 0.76.5** - Cross-platform mobile framework
- **@ckb-ccc/core** - CKB blockchain SDK
- **React Navigation 7** - Navigation solution
- **Expo SecureStore** - Secure credential storage
- **Expo LocalAuthentication** - Biometric authentication
- **Expo Camera** - QR code scanning
- **@expo/vector-icons** - Icon library
- **TypeScript** - Type-safe development

### Key Components

```
src/
├── contexts/          # State management
│   └── WalletContext.tsx
├── navigation/        # App navigation
│   └── AppNavigator.tsx
├── screens/          # App screens
│   ├── HomeScreen.tsx
│   ├── SendScreen.tsx
│   ├── ReceiveScreen.tsx
│   ├── SettingsScreen.tsx
│   ├── CreateWalletScreen.tsx
│   ├── ImportWalletScreen.tsx
│   └── UnlockScreen.tsx
├── signers/          # Blockchain signers
│   └── MobileSigner.ts
├── services/         # Business logic
│   └── keystore.ts
└── types/            # TypeScript definitions
    └── index.ts
```

## Installation

### Prerequisites

- Node.js >= 18
- pnpm >= 10.8.1
- **For testing on device**: Install Expo Go app
  - [iOS Expo Go](https://apps.apple.com/app/expo-go/id982107779)
  - [Android Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **For native builds** (optional):
  - For iOS: macOS with Xcode
  - For Android: Android Studio, JDK

### Quick Setup (Recommended)

1. **Install dependencies**

```bash
cd packages/mobile
pnpm install
```

2. **Start Expo development server**

```bash
pnpm start
```

3. **Test on your device**
   - Scan the QR code with your phone's camera (iOS)
   - Or scan with Expo Go app (Android)
   - The app will load on your device instantly!

### Native Development Build (Full Features)

For full native functionality including all biometric features:

```bash
# Generate native projects
pnpm prebuild

# Run on iOS
pnpm ios

# Run on Android
pnpm android
```

## Running the App

### Using Expo Go (No Build Required)

**Start Dev Server**
```bash
pnpm start
```

Then scan the QR code with Expo Go app or camera.

### Native Build

**iOS**
```bash
pnpm ios
```

**Android**
```bash
pnpm android
```

**Web**
```bash
pnpm web
```

### Production Build

**iOS**
```bash
cd ios
xcodebuild -workspace CCCMobileWallet.xcworkspace -scheme CCCMobileWallet archive
```

**Android**
```bash
cd android
./gradlew assembleRelease
```

## Usage

### Creating a New Wallet

1. Launch the app
2. Tap "Create New Wallet"
3. Enter a wallet name
4. Your wallet is created with a securely stored private key

### Importing an Existing Wallet

1. Launch the app
2. Tap "Import Existing Wallet"
3. Enter wallet name and private key (0x...)
4. Your wallet is imported and secured

### Sending CKB

1. Navigate to the "Send" tab
2. Enter recipient address
3. Enter amount
4. Review transaction details
5. Confirm and send

### Receiving CKB

1. Navigate to the "Receive" tab
2. Share your address or QR code
3. Wait for incoming transactions

## Security Best Practices

⚠️ **Important Security Notes**

1. **Private Key Security**
   - Never share your private key with anyone
   - Private keys are stored encrypted on your device
   - Backup your private key securely offline

2. **Biometric Authentication**
   - Enable biometric authentication for added security
   - Biometrics are stored only on your device

3. **Network Security**
   - Always verify transaction details before confirming
   - Only connect to trusted networks
   - Be cautious of phishing attempts

4. **Device Security**
   - Keep your device OS updated
   - Use device lock screen protection
   - Don't root/jailbreak your device for wallet use

## Mobile Signer API

The `MobileSigner` class extends `ccc.Signer` and provides:

```typescript
import {MobileSigner} from '@ckb-ccc/mobile';
import {ccc} from '@ckb-ccc/core';

// Create signer
const client = new ccc.ClientPublicTestnet();
const signer = new MobileSigner(client, useBiometric);

// Create new account
const account = await signer.createAccount('My Wallet');

// Import account
const account = await signer.importAccount(privateKey, 'Imported Wallet');

// Connect to account
await signer.connect(account);

// Send transaction
const tx = ccc.Transaction.from({
  outputs: [{lock: toLock, capacity: amount}],
});
await tx.completeInputsByCapacity(signer);
await tx.completeFeeBy(signer);
const txHash = await signer.sendTransaction(tx);
```

## Configuration

### Network Configuration

Edit `src/contexts/WalletContext.tsx` to change the default network:

```typescript
// For mainnet
const client = new ccc.ClientPublicMainnet();

// For testnet (default)
const client = new ccc.ClientPublicTestnet();

// For custom node
const client = new ccc.Client({ url: 'https://your-node-url' });
```

### Biometric Settings

Biometric authentication can be enabled/disabled in the Settings screen or configured programmatically:

```typescript
await AsyncStorage.setItem('@wallet_biometric_enabled', 'true');
```

## Troubleshooting

### Common Issues

**Issue: Metro bundler errors**
```bash
# Clear cache
pnpm start --reset-cache
```

**Issue: iOS build fails**
```bash
cd ios
pod deintegrate
pod install
```

**Issue: Android build fails**
```bash
cd android
./gradlew clean
```

### Debugging

Enable remote debugging:
1. Shake device (or Cmd+D on iOS simulator, Cmd+M on Android)
2. Select "Debug"
3. Open Chrome DevTools at `chrome://inspect`

## Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test --coverage
```

## Contributing

Contributions are welcome! Please read the [contributing guidelines](../../CONTRIBUTING.md) first.

## License

MIT

## Links

- [CCC Documentation](https://docs.ckbccc.com)
- [CCC GitHub](https://github.com/ckb-devrel/ccc)
- [Nervos Network](https://www.nervos.org/)
- [React Native](https://reactnative.dev/)

## Support

For issues and questions:
- GitHub Issues: https://github.com/ckb-devrel/ccc/issues
- Discord: [Nervos Community](https://discord.gg/nervos)

## Roadmap

- [ ] Multi-signature support
- [ ] Hardware wallet integration
- [ ] DApp browser
- [ ] NFT support (Spore protocol)
- [ ] Token swap integration
- [ ] Address book
- [ ] Transaction annotations
- [ ] Multi-language support
- [ ] Dark mode
- [ ] PIN code authentication

---

Made with ❤️ by the CKB community
