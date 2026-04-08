import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { BackHandler, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

export default function ChatScreen() {
  const router = useRouter();

  // Estados
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todas'); // Começa com 'Todas' selecionado

  // Filtros disponíveis
  const filters = ['Todas', 'Não lidas'];

  // --- CONTROLO DO BOTÃO FÍSICO DO ANDROID ---
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Se houver histórico, volta para a página anterior. 
        // Se não houver, garante que vai para a Home, mas nunca para o Index!
        if (router.canGoBack()) {
          router.back();
        } else {
          router.navigate('/home');
        }
        return true; 
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }, [router])
  );

  return (
    <View className="flex-1 bg-[rgb(58,79,92)]">
      
      {/* --- CABEÇALHO --- */}
      <View className="pt-14 pb-3 px-4 flex-row items-center justify-center border-b border-white/10 relative">
        <Text className="text-3xl font-extrabold text-white">Mensagens</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        
        {/* --- BARRA DE PESQUISA --- */}
        <View className="px-5 mt-6 mb-5">
          <View className="flex-row items-center bg-white/10 rounded-2xl px-4 h-14 border border-white/20">
            <Ionicons name="search" size={22} color="rgba(255,255,255,0.4)" />
            <TextInput
              placeholder="Pesquisar"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 text-white text-[16px] font-medium ml-3"
            />
          </View>
        </View>

        {/* --- FILTROS (Todas / Não lidas / Favoritos) --- */}
        <View className="px-5 mb-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row overflow-visible">
            {filters.map((filter) => (
              <Pressable
                key={filter}
                onPress={() => setActiveFilter(filter)}
                className={`px-5 py-2 rounded-full mr-3 border ${
                  activeFilter === filter 
                    ? 'bg-[rgb(223,19,36)] border-[rgb(223,19,36)]' 
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <Text 
                  className={`font-bold text-[14px] ${
                    activeFilter === filter ? 'text-white' : 'text-gray-300'
                  }`}
                >
                  {filter}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* --- CORPO DAS MENSAGENS (Para já, estado vazio) --- */}
        <View className="flex-1 items-center justify-center mt-20 px-4">
          <View className="w-24 h-24 items-center justify-center mb-6">
            <Ionicons name="chatbubbles-outline" size={75} color="rgba(255,255,255,0.2)" />
          </View>
          <Text className="text-white text-[22px] font-bold mb-2 text-center">
            Caixa de entrada vazia
          </Text>
          <Text className="text-gray-400 text-center text-[14px] px-6 leading-6">
            Quando contactares um vendedor ou quando alguém estiver interessado nos teus anúncios, as mensagens aparecerão aqui.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}