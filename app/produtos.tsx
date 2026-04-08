import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { AuthService } from '../src/services/auth';
import { AnuncioRow, getOutrosProdutosByUser, getProdutoById, ProdutoDetalhe } from '../src/services/database';

const ImageMap: Record<string, any> = {
  'produtos/constituição_da_repu.png': require('../assets/images/constituição_da_repu.png'),
};

const DEFAULT_IMAGE = require('../assets/images/logo.png');

export default function ProdutosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id ? Number(params.id) : null;

  const [produto, setProduto] = useState<ProdutoDetalhe | null>(null);
  const [outros, setOutros] = useState<AnuncioRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      
      const user = await AuthService.getCurrentUser();
      setCurrentUserId(user?.id || null);

      const data = await getProdutoById(id);
      setProduto(data);
      if (data) {
        const maisAnuncios = await getOutrosProdutosByUser(data.id_utilizador, id);
        setOutros(maisAnuncios);
      }
    };
    load();
  }, [id]);

  const getDynamicImage = (imgPath: string | null) => {
    if (!imgPath) return DEFAULT_IMAGE;
    if (imgPath.startsWith('file://') || imgPath.startsWith('http')) {
      return { uri: imgPath };
    }
    if (ImageMap[imgPath]) {
      return ImageMap[imgPath];
    }
    return DEFAULT_IMAGE;
  };

  if (!produto) {
    return (
      <View className="flex-1 bg-[rgb(58,79,92)] items-center justify-center">
        <Text className="text-white font-medium">A carregar detalhes...</Text>
      </View>
    );
  }

  const isMyAd = currentUserId === produto.id_utilizador;
  
  // Limpa qualquer '€' que venha da base de dados para formatar uniformemente
  const displayPrice = produto.preco ? produto.preco.replace('€', '').trim() : '0';

  return (
    <View className="flex-1 bg-[rgb(58,79,92)]">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">

        <View className="w-full h-[300px] relative pt-12 pb-4">
          
          <View className="absolute top-14 left-4 right-4 flex-row justify-between items-center z-10">
            <Pressable onPress={() => router.back()} className="bg-black/40 p-3 rounded-full active:opacity-70 border border-white/10">
              <Ionicons name="arrow-back" size={24} color="white" />
            </Pressable>
            
            {!isMyAd && (
              <Pressable className="bg-black/40 p-3 rounded-full active:opacity-70 border border-white/10">
                <Ionicons name="heart-outline" size={24} color="white" />
              </Pressable>
            )}
          </View>
          
          <Image source={getDynamicImage(produto.foto)} className="w-full h-full" resizeMode="contain" />
        </View>

        <View className="px-5 pt-4 pb-8">

          <View className="flex-row items-center mb-4">
            <View className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 mr-3">
              <Text className="text-white text-[12px] font-extrabold uppercase tracking-wider">{produto.estado}</Text>
            </View>
            <Text className="text-gray-300 font-medium flex-1 text-[14px]">
              Vendido por <Text className="font-bold text-white">{produto.nome_vendedor} {isMyAd && '(Tu)'}</Text>
            </Text>
          </View>

          <Text className="text-white text-3xl font-extrabold mb-2 leading-tight">{produto.titulo}</Text>
          <Text className="text-white text-3xl font-black mb-6">{displayPrice}€</Text>

          <View className="bg-white/5 rounded-2xl p-5 border border-white/10 mb-8">
            <View className="flex-row items-center">
              <Ionicons name="location" size={24} color="rgba(255,255,255,0.6)" />
              <View className="ml-3">
                <Text className="text-white font-bold text-[16px]">{produto.local_entrega || 'ISCAC'}</Text>
                <Text className="text-gray-400 text-[13px]">Local de entrega</Text>
              </View>
            </View>
          </View>

          <Text className="text-white text-xl font-bold mb-3">Descrição</Text>
          <Text className="text-gray-300 text-[15px] leading-7 mb-10">{produto.descricao}</Text>

          {outros.length > 0 && (
            <>
              <Text className="text-white text-xl font-bold mb-4">Mais anúncios de {produto.nome_vendedor} {isMyAd && '(Tu)'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible mb-10">
                {outros.map((item) => {
                  // Limpa os preços dos outros anúncios também
                  const cleanItemPrice = item.price ? item.price.replace('€', '').trim() : '0';
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push({ pathname: '/produtos', params: { id: item.id } })}
                      className="w-40 mr-4 pb-3 active:opacity-80"
                    >
                      <View className="w-full h-32 mb-3 bg-black/20 rounded-xl overflow-hidden border border-white/5">
                        <Image source={getDynamicImage(item.img)} className="w-full h-full" resizeMode="contain" />
                      </View>
                      <View className="px-1">
                        <Text className="text-white font-bold text-[14px]" numberOfLines={2}>{item.title}</Text>
                        <Text className="text-white font-black text-[16px] mt-1">{cleanItemPrice}€</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </ScrollView>

      {!isMyAd && (
        <View className="px-5 pt-4 pb-12 border-t border-white/10 bg-[rgb(58,79,92)] flex-row gap-3">
          <Pressable
            onPress={() => Alert.alert('Sucesso', 'Produto adicionado ao carrinho!')}
            className="flex-1 bg-white/10 py-4 rounded-xl items-center flex-row justify-center active:bg-white/20 border border-white/10"
          >
            <Ionicons name="cart-outline" size={20} color="white" />
            <Text className="text-white font-bold ml-2 text-[16px]">Carrinho</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/chat')}
            className="flex-1 bg-black py-4 rounded-xl items-center flex-row justify-center active:bg-gray-800 shadow-md"
          >
            <Ionicons name="chatbubbles-outline" size={20} color="white" />
            <Text className="text-white font-bold ml-2 text-[16px]">Contactar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}