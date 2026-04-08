import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import "../global.css";

// Importa a função (ajusta o caminho para onde criaste o ficheiro)
// Se seguiste o passo anterior, será '../src/services/database'
import { setupDatabase } from '../src/services/database';

// Impede que o ecrã de Splash nativo desapareça antes da BD estar pronta
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Carrega a BD do SQLite
        await setupDatabase();
        setDbLoaded(true);
      } catch (e) {
        console.warn("Erro ao carregar a BD:", e);
      } finally {
        // Esconde o Splash Screen nativo
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  // Enquanto a BD não carrega, mostra o loading com a tua cor oficial
  if (!dbLoaded) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: 'rgb(58, 79, 92)' 
      }}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  return (
    <ThemeProvider value={DarkTheme}>
      {/* headerShown: false para não aparecer o título feio no topo */}
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
      {/* StatusBar 'light' para ser branco e ver-se no fundo azul escuro */}
      <StatusBar style="light" />
    </ThemeProvider>
  );
}