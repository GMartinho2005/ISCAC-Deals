import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

export default function FavoritesScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[rgb(58,79,92)]">
      
      {/* --- CABEÇALHO --- */}
      <View className="pt-14 pb-3 px-4 items-center justify-center border-b border-white/10">
        <Text className="text-3xl font-extrabold text-white">Favoritos</Text>
      </View>

      {/* --- CORPO DA PÁGINA (Estado Vazio) --- */}
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 pt-6 px-4">
        
        <View className="flex-1 items-center justify-center mt-32">
          <View className="w-24 h-24 items-center justify-center mb-6">
            <Ionicons name="heart-outline" size={70} color="white" />
          </View>
          
          <Text className="text-white text-[25px] font-bold mb-2">Ainda não tens favoritos</Text>
          <Text className="text-gray-300 text-center text-[14px] px-6 leading-6">
            AClica no coração junto aos produtos e serviços que mais gostas para os guardares aqui. Assim será mais fácil encontrá-los mais tarde!
          </Text>

          {/* 3. Adicionar o onPress ao botão */}
          <Pressable 
            onPress={() => router.navigate('/home')} 
            className="mt-8 bg-[rgb(223,19,36)] px-8 py-4 rounded-xl active:bg-[rgb(193,17,32)] shadow-sm"
          >
            <Text className="text-white font-bold text-[16px]">Explorar Anúncios</Text>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}