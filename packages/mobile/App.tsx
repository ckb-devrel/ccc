import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {WalletProvider} from './src/contexts/WalletContext';
import AppNavigator from './src/navigation/AppNavigator';

// Polyfills for CCC
import {Buffer} from 'buffer';
global.Buffer = Buffer;

const App = () => {
  return (
    <SafeAreaProvider>
      <WalletProvider>
        <AppNavigator />
      </WalletProvider>
    </SafeAreaProvider>
  );
};

export default App;
