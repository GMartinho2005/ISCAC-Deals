import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import "../global.css";

import { CartProvider } from '../src/contexts/CartContext';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        setDbLoaded(true);
      } catch (e) {
        console.warn("Erro ao carregar a BD:", e);
      } finally {
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  if (!dbLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgb(58, 79, 92)' }}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  return (
    <CartProvider>
      <ThemeProvider value={DarkTheme}>
        <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          
          <Stack.Screen 
            name="conversa" 
            options={{ 
              title: 'Chat', 
              headerShown: false,
              headerStyle: { backgroundColor: 'rgb(58,79,92)' },
              headerTintColor: '#fff',
            }} 
          />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </CartProvider>
  );
}