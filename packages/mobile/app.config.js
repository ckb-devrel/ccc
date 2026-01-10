export default {
  name: 'CCC Mobile Wallet',
  slug: 'ccc-mobile-wallet',
  version: '0.1.0',
  orientation: 'portrait',
  // icon: './assets/icon.png', // Uncomment when icon is added
  userInterfaceStyle: 'automatic',
  // splash: {
  //   image: './assets/splash.png',
  //   resizeMode: 'contain',
  //   backgroundColor: '#007AFF',
  // },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.ckb.ccc.mobile',
    infoPlist: {
      NSCameraUsageDescription: 'This app uses the camera to scan QR codes for wallet addresses.',
      NSFaceIDUsageDescription: 'This app uses Face ID to secure your wallet.',
    },
  },
  android: {
    // adaptiveIcon: {
    //   foregroundImage: './assets/adaptive-icon.png',
    //   backgroundColor: '#007AFF',
    // },
    package: 'com.ckb.ccc.mobile',
    permissions: [
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
      'CAMERA',
    ],
  },
  web: {
    // favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-camera',
    'expo-local-authentication',
    'expo-secure-store',
    [
      'expo-barcode-scanner',
      {
        cameraPermission: 'Allow $(PRODUCT_NAME) to access camera to scan QR codes.',
      },
    ],
  ],
  extra: {
    eas: {
      projectId: 'your-project-id-here',
    },
  },
  owner: 'ckb-devrel',
};
