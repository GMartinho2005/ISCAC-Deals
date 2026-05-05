import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, AppState, AppStateStatus, DeviceEventEmitter, Pressable, Text, View } from 'react-native';

import { useCart } from '../../src/contexts/CartContext';
import { AuthService } from '../../src/services/auth';
import { getMinhasConversas } from '../../src/services/database';
import { supabase } from '../../src/services/supabase';

export default function TabLayout() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  
  // 1. NOVO: Guardamos o ID do utilizador num estado próprio
  const [userId, setUserId] = useState<number | null>(null);

  const { cartItems } = useCart(); 
  const cartCount = cartItems?.length || 0;

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('Parabéns! O teu anúncio acabou de ser vendido.');
  const fadeAnim = useState(new Animated.Value(0))[0];

  // 2. Procurar o utilizador apenas uma vez quando o ecrã carrega
  useEffect(() => {
    AuthService.getCurrentUser().then(user => {
      if (user) setUserId(user.id);
    });
  }, []);

  const showSaleToast = useCallback(async (compraData?: any) => {
    let customMessage = 'Parabéns! O teu anúncio acabou de ser vendido.';

    if (compraData) {
      try {
        const isProduto = !!compraData.id_produto;
        const tabela = isProduto ? 'core_produto' : 'core_servico';
        const idItem = isProduto ? compraData.id_produto : compraData.id_servico;

        const { data: item } = await supabase.from(tabela).select('titulo').eq('id', idItem).single();
        if (item) {
          customMessage = `Venda Efetuada! O teu anúncio "${item.titulo}" foi comprado.`;
        }
      } catch (e) {
        console.error("Erro a buscar titulo para toast:", e);
      }
    }

    setToastMessage(customMessage);
    setToastVisible(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setToastVisible(false);
      });
    }, 5000);
  }, [fadeAnim]);

  const fetchBadges = useCallback(async () => {
    if (!userId) return;

    // Buscar Mensagens não lidas
    const conversas = await getMinhasConversas(userId);
    const total = conversas.reduce((acc, c) => acc + c.nao_lidas, 0);
    setUnreadCount(total);

    // Buscar Vendas não lidas
    const { data } = await supabase.from('core_compras').select('id').eq('id_vendedor', userId).eq('notificacao_lida', 0);
    setSalesCount(data?.length || 0);
  }, [userId]); 

  // 3. Ouvintes de Estado e App (Isolados do Supabase)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') fetchBadges();
    };
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    const subscription = DeviceEventEmitter.addListener('updateBadges', () => {
      fetchBadges();
    });

    fetchBadges();

    return () => {
      appStateSubscription.remove();
      subscription.remove();
    };
  }, [fetchBadges]);

  // 4. OUVINTE SUPABASE (Síncrono e Seguro)
  useEffect(() => {
    // Só arranca se já tivermos o ID do utilizador pronto
    if (!userId) return;

    // Criamos um nome 100% único usando a data. O Supabase trata disto na perfeição sem CHANNEL_ERROR.
    const channelName = `badges-${userId}-${Date.now()}`;
    const myAppChannel = supabase.channel(channelName);

    myAppChannel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'core_mensagem' },
        () => { fetchBadges(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'core_compras', filter: `id_vendedor=eq.${userId}` },
        (payload: any) => {
          fetchBadges();
          if (payload.eventType === 'INSERT') {
            showSaleToast(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      // Limpeza natural recomendada pela documentação oficial
      supabase.removeChannel(myAppChannel);
    };
  }, [userId, fetchBadges, showSaleToast]);

  const handleToastPress = () => {
    setToastVisible(false);
    router.push('/profile');
  };

  return (
    <>
      {toastVisible && (
        <Animated.View style={{ opacity: fadeAnim, position: 'absolute', top: 60, left: 20, right: 20, zIndex: 1000 }}>
          <Pressable 
            onPress={handleToastPress}
            className="bg-[#10b981] flex-row items-center p-4 rounded-2xl shadow-xl border border-white/20"
          >
            <View className="bg-white/20 rounded-full p-2">
              <Ionicons name="cash-outline" size={24} color="white" />
            </View>
            <Text className="text-white font-bold ml-3 text-[14px] flex-1 leading-5">
              {toastMessage}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </Pressable>
        </Animated.View>
      )}

      <Tabs 
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: 'rgb(255, 255, 255)',
          tabBarInactiveTintColor: 'rgb(103, 103, 103)',
          tabBarStyle: { backgroundColor: 'rgb(0,0,0)', borderTopWidth: 1, borderTopColor: 'rgb(0, 0, 0)', height: 60, marginBottom: 20 }
        }}
      >
        <Tabs.Screen name="home" options={{ tabBarIcon: ({ color }) => <Ionicons name="home" size={26} color={color} /> }} />
        <Tabs.Screen name="favorites" options={{ tabBarIcon: ({ color }) => <Ionicons name="heart-outline" size={26} color={color} /> }} />
        <Tabs.Screen 
          name="cart" 
          options={{
            tabBarIcon: ({ color }) => <Ionicons name="cart-outline" size={26} color={color} />,
            tabBarBadge: cartCount > 0 ? cartCount : undefined,
            tabBarBadgeStyle: { backgroundColor: 'rgb(223,19,36)', color: 'white', fontSize: 10, fontWeight: 'bold' }
          }} 
        />
        <Tabs.Screen 
          name="chat" 
          options={{
            tabBarIcon: ({ color }) => <Ionicons name="chatbubble-outline" size={26} color={color} />,
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
            tabBarBadgeStyle: { backgroundColor: 'rgb(223,19,36)', color: 'white', fontSize: 10, fontWeight: 'bold' }
          }} 
        />
        <Tabs.Screen 
          name="profile" 
          options={{
            tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={26} color={color} />,
            tabBarBadge: salesCount > 0 ? salesCount : undefined,
            tabBarBadgeStyle: { backgroundColor: 'rgb(16, 185, 129)', color: 'white', fontSize: 10, fontWeight: 'bold' }
          }} 
        />
      </Tabs>
    </>
  );
}