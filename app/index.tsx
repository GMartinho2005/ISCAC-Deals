import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Importamos o serviço de autenticação
import { AuthService } from '../src/services/auth';

export default function HomeScreen() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    const checkAuthAndStart = async () => {
      // 1. Vai ao "cofre" (AsyncStorage) ver se há uma sessão guardada
      const user = await AuthService.getCurrentUser();

      if (user && isMounted) {
        // Se encontrou o utilizador, salta o ecrã de boas-vindas e vai direto para a app!
        router.replace('/home');
        return; 
      }

      // 2. Se NÃO houver utilizador, faz a animação normal e mostra os botões
      setTimeout(() => {
        if (isMounted) {
          setShowSplash(false);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }).start();
        }
      }, 2000);
    };

    checkAuthAndStart();

    return () => { isMounted = false; };
  }, [fadeAnim, router]);

  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logoSplash}
          contentFit="contain"
        />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.welcomeContainer, { opacity: fadeAnim }]}>
      
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logoSmall}
          contentFit="contain"
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.titleBlack}>As Melhores Ofertas</Text>
        <Text style={styles.titleRed}>Estão à Tua Espera</Text>
        <Text style={styles.subtitle}>
          Conecta-te à tua rede académica: compra livros, reserva explicações e partilha recursos no ISCAC.
        </Text>
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.btnEntrar} 
          activeOpacity={0.6} 
          onPress={() => router.push('/login')}
        >
          <Ionicons name="key-outline" size={20} color="rgb(255,255,255)" />
          <Text style={styles.btnTextWhite}>ENTRAR</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.btnRegisto} 
          activeOpacity={0.6} 
          onPress={() => router.push('/register')}
        >
          <Ionicons name="person-add-outline" size={20} color="rgb(255,255,255)" />
          <Text style={styles.btnTextWhite}>REGISTAR</Text>
        </TouchableOpacity>

        <Text style={styles.copyright}>
          © 2026 ISCAC-DEALS · Todos os direitos reservados
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: 'rgb(58, 79, 92)', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoSplash: {
    width: 300,
    height: 200,
  },
  welcomeContainer: {
    flex: 1,
    backgroundColor: 'rgb(58, 79, 92)',
    paddingHorizontal: 30,
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 70,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoSmall: {
    width: 280,
    height: 140,
  },
  content: {
    alignItems: 'center',
  },
  titleBlack: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'rgb(0,0,0)',
  },
  titleRed: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'rgb(223, 19, 36)',
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgb(215, 220, 228)',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
    marginTop: 30,
  },
  btnEntrar: {
    backgroundColor: 'rgb(223, 19, 36)',
    flexDirection: 'row',
    width: '100%',
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnRegisto: {
    backgroundColor: 'rgb(0, 0, 0)',
    flexDirection: 'row',
    width: '100%',
    height: 55, 
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnInner: {
    flexDirection: 'row',
  },
  btnTextWhite: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  btnTextBlack: {
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  copyright: {
    fontSize: 10,
    color: 'rgb(148, 163, 184)',
    marginTop: 70,
    textAlign: 'center',
  },
});