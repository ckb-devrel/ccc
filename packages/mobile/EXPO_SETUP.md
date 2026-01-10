# Expo Setup Guide

The mobile wallet has been configured to use **Expo** for easier development and testing.

## Quick Start

### 1. Install Dependencies

From the mobile package directory:

```bash
cd packages/mobile
pnpm install
```

### 2. Start the Development Server

```bash
pnpm start
```

This will start the Expo development server and show a QR code.

### 3. Run on Device

#### Option A: Use Expo Go (Quickest)

1. Install **Expo Go** on your phone:
   - iOS: https://apps.apple.com/app/expo-go/id982107779
   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent

2. Scan the QR code from the terminal with your phone's camera (iOS) or Expo Go app (Android)

3. The app will load on your device!

**Note**: Some features like biometric authentication may have limitations in Expo Go.

#### Option B: Development Build (Full Features)

For full native functionality including biometrics:

```bash
# Create development build
pnpm prebuild

# Run on iOS
pnpm ios

# Run on Android
pnpm android
```

This requires:
- **iOS**: macOS with Xcode installed
- **Android**: Android Studio installed

### 4. Run on Web

```bash
pnpm web
```

Opens the app in your browser (limited functionality).

## Key Changes from Standard React Native

### Expo Packages Used

- **expo-secure-store**: Replaces `react-native-keychain` for secure storage
- **expo-local-authentication**: Replaces `react-native-biometrics` for biometric auth
- **expo-camera**: Replaces `react-native-camera` for QR code scanning
- **@expo/vector-icons**: Replaces `react-native-vector-icons`

### Benefits

✅ No need for Xcode or Android Studio to test on device
✅ Faster iteration with hot reload
✅ Over-the-air updates
✅ Easier dependency management
✅ Built-in development tools

### Limitations

⚠️ Some native features limited in Expo Go
⚠️ Requires development build for full functionality

## Testing the Wallet

1. **Create a new wallet**: Tap "Create New Wallet" and enter a name
2. **View balance**: See your CKB balance on the home screen
3. **Receive CKB**: Navigate to "Receive" tab to see your address and QR code
4. **Send CKB**: Go to "Send" tab, enter recipient and amount
5. **Settings**: Configure biometric auth and manage accounts

## Building for Production

### Using EAS Build (Recommended)

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Login to Expo:
```bash
eas login
```

3. Configure your build:
```bash
eas build:configure
```

4. Build for platforms:
```bash
# iOS
pnpm build:ios

# Android
pnpm build:android
```

## Troubleshooting

### Metro bundler won't start

```bash
pnpm start --clear
```

### Module not found errors

```bash
pnpm install
rm -rf node_modules/.cache
pnpm start --clear
```

### Biometric authentication not working

- Ensure you're using a development build (not Expo Go)
- Check device has biometric enrollment enabled
- Verify permissions in app.config.js

## Next Steps

- Add app icons and splash screen in `/assets`
- Configure EAS project ID in `app.config.js`
- Set up continuous deployment with EAS
- Add more features (NFTs, DApp browser, etc.)

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo LocalAuthentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/)
