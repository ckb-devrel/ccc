import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

// Screens
import HomeScreen from '../screens/HomeScreen';
import SendScreen from '../screens/SendScreen';
import ReceiveScreen from '../screens/ReceiveScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CreateWalletScreen from '../screens/CreateWalletScreen';
import ImportWalletScreen from '../screens/ImportWalletScreen';
import UnlockScreen from '../screens/UnlockScreen';

import {useWallet} from '../contexts/WalletContext';

export type RootStackParamList = {
  Main: undefined;
  CreateWallet: undefined;
  ImportWallet: undefined;
  Unlock: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Send: undefined;
  Receive: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'wallet' : 'wallet-outline';
              break;
            case 'Send':
              iconName = focused ? 'send' : 'send-outline';
              break;
            case 'Receive':
              iconName = focused ? 'qrcode-scan' : 'qrcode';
              break;
            case 'Settings':
              iconName = focused ? 'cog' : 'cog-outline';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
      })}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{title: 'Wallet'}}
      />
      <Tab.Screen
        name="Send"
        component={SendScreen}
        options={{title: 'Send'}}
      />
      <Tab.Screen
        name="Receive"
        component={ReceiveScreen}
        options={{title: 'Receive'}}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{title: 'Settings'}}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const {isUnlocked, accounts} = useWallet();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}>
        {!isUnlocked ? (
          <>
            {accounts.length === 0 ? (
              <>
                <Stack.Screen name="CreateWallet" component={CreateWalletScreen} />
                <Stack.Screen name="ImportWallet" component={ImportWalletScreen} />
              </>
            ) : (
              <Stack.Screen name="Unlock" component={UnlockScreen} />
            )}
          </>
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
