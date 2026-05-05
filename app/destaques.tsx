import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Image, InteractionManager, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { AuthService } from '../src/services/auth';
import { AnuncioRow, getDestaques } from '../src/services/database';

const FILTER_OPTIONS: Record<string, string[]> = {
  'Tipo': ['Qualquer', 'Apenas Produtos', 'Apenas Serviços'],
  'Preço': ['Qualquer', 'Ordenar por mais caro', 'Ordenar por mais barato'],
};

const ImageMap: Record<string, any> = {
  'produtos/constituição_da_repu.png': require('../assets/images/constituição_da_repu.png'),
};

const DEFAULT_IMAGE = require('../assets/images/logo.png');

export default function DestaquesScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const [allItems, setAllItems] = useState<AnuncioRow[]>([]);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [tipo, setTipo] = useState('Qualquer');
  const [preco, setPreco] = useState('Qualquer');

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      setTipo('Qualquer');
      setPreco('Qualquer');
      setActiveModal(null);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });

      const load = async () => {
        try {
          const user = await AuthService.getCurrentUser();
          const userId = user?.id || null;

          // Chama o Top 10 excluindo os do próprio user
          const items = await getDestaques(userId, 10);
          if (isActive) setAllItems(items);
        } catch (error) {
          console.error("Erro ao carregar destaques:", error);
        }
      };

      const task = InteractionManager.runAfterInteractions(() => {
        if (isActive) load();
      });

      return () => {
        isActive = false;
        task.cancel();
      };
    }, [])
  );

  let displayed = [...allItems];
  if (tipo === 'Apenas Produtos') displayed = displayed.filter(p => p.type === 'produto');
  if (tipo === 'Apenas Serviços') displayed = displayed.filter(p => p.type === 'servico');
  if (preco === 'Ordenar por mais caro') displayed.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  if (preco === 'Ordenar por mais barato') displayed.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

  const handleSelectOption = (option: string) => {
    if (activeModal === 'Tipo') setTipo(option);
    if (activeModal === 'Preço') setPreco(option);
    setActiveModal(null);
  };

  const getDynamicImage = (imgPath: string | null) => {
    if (!imgPath) return DEFAULT_IMAGE;
    if (imgPath.startsWith('file://') || imgPath.startsWith('http')) return { uri: imgPath };
    if (ImageMap[imgPath]) return ImageMap[imgPath];
    return DEFAULT_IMAGE;
  };

  return (
    <View className="flex-1 bg-[rgb(58,79,92)]">

      <View className="pt-14 pb-3 px-4 flex-row items-center border-b border-white/10">
        <Pressable className="mr-4 p-2 -ml-2 active:opacity-50" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </Pressable>
        <Text className="text-xl font-bold text-white flex-1">Destaques deste Ano Letivo</Text>
      </View>

      <View className="pb-3 border-b border-white/10 mt-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-2">
          <Pressable onPress={() => setActiveModal('Tipo')} className={`flex-row items-center px-4 py-2 rounded-full mr-3 shadow-sm ${tipo !== 'Qualquer' ? 'bg-[rgb(223,19,36)]' : 'bg-white'}`}>
            <Text className={`text-[14px] mr-1 ${tipo !== 'Qualquer' ? 'text-white font-bold' : 'text-black font-medium'}`}>{tipo !== 'Qualquer' ? tipo : 'Tipo de Anúncio'}</Text>
            <Ionicons name="chevron-down" size={14} color={tipo !== 'Qualquer' ? 'white' : 'black'} />
          </Pressable>
          <Pressable onPress={() => setActiveModal('Preço')} className={`flex-row items-center px-4 py-2 rounded-full mr-4 shadow-sm ${preco !== 'Qualquer' ? 'bg-[rgb(223,19,36)]' : 'bg-white'}`}>
            <Text className={`text-[14px] mr-1 ${preco !== 'Qualquer' ? 'text-white font-bold' : 'text-black font-medium'}`}>{preco !== 'Qualquer' ? preco : 'Preço'}</Text>
            <Ionicons name="chevron-down" size={14} color={preco !== 'Qualquer' ? 'white' : 'black'} />
          </Pressable>
        </ScrollView>
        <View className="px-5 mt-2">
          <Text className="text-gray-400 font-medium text-[13px]">{displayed.length} destaques encontrados</Text>
        </View>
      </View>

      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} className="flex-1 pt-6">
        {displayed.map((ad) => {
          const cleanPrice = ad.price ? String(ad.price).replace('€/h', '').replace('€', '').trim() : '0';

          return (
            <View key={`${ad.type}-${ad.id}`} className="mb-10 px-4">
              
              <Pressable
                onPress={() => router.push({ pathname: ad.type === 'servico' ? '/servicos' : '/produtos', params: { id: ad.id } })}
                className="w-full h-[280px] rounded-3xl overflow-hidden relative mb-4 active:opacity-90"
              >
                <Image source={getDynamicImage(ad.img)} className="w-full h-full" resizeMode="contain" />
              </Pressable>

              <View className="px-2">
                <Text className="text-white text-[24px] font-extrabold shadow-sm leading-tight mb-3" numberOfLines={2}>
                  {ad.title}
                </Text>

                <View className="flex-row items-center justify-between mb-4 mt-1">
                  
                  {ad.type === 'produto' ? (
                    <View className="bg-gray-100 px-3 py-1.5 rounded-lg shadow-sm">
                      <Text className="text-gray-800 text-[13px] font-extrabold uppercase tracking-wider">{ad.condition || '—'}</Text>
                    </View>
                  ) : (
                    <View className="flex-row items-center bg-[#fbbf24]/20 px-3 py-1.5 rounded-lg border border-[#fbbf24]/30">
                      <Ionicons name="star" size={18} color="#fbbf24" />
                      <Text className="text-[#fbbf24] font-bold text-[14px] ml-1">
                        {Number(ad.rating ?? 0).toFixed(1)}
                        <Text className="font-normal opacity-80"> ({ad.reviews ?? 0})</Text>
                      </Text>
                    </View>
                  )}

                  <View className="flex-row items-center bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                    <Ionicons name="person-circle-outline" size={18} color="white" />
                    <Text className="text-gray-200 text-[14px] ml-1.5">
                      Vendido por <Text className="font-bold text-white">{ad.nome_vendedor || 'Utilizador'}</Text>
                    </Text>
                  </View>

                </View>

                <View className="flex-row justify-between items-center border-t border-white/20 pt-4">
                  <Text className="text-white text-[28px] font-black">
                    {cleanPrice}€{ad.type === 'servico' && <Text className="text-[16px] font-normal text-gray-300">/h</Text>}
                  </Text>
                  <Pressable
                    onPress={() => router.push({ pathname: ad.type === 'servico' ? '/servicos' : '/produtos', params: { id: ad.id } })}
                    className="bg-black px-6 py-3 rounded-xl active:bg-gray-800 flex-row items-center shadow-lg"
                  >
                    <Ionicons name="eye-outline" size={18} color="white" />
                    <Text className="text-white font-bold text-[16px] ml-2">Ver</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
        <View className="h-10" />
      </ScrollView>

      <Modal visible={activeModal !== null} animationType="slide" transparent onRequestClose={() => setActiveModal(null)}>
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setActiveModal(null)}>
          <Pressable className="bg-white rounded-t-3xl p-6 pb-10" onPress={(e) => e.stopPropagation()}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-black">Filtrar por {activeModal}</Text>
              <Pressable onPress={() => setActiveModal(null)} className="bg-gray-100 p-2 rounded-full">
                <Ionicons name="close" size={20} color="black" />
              </Pressable>
            </View>
            {activeModal && FILTER_OPTIONS[activeModal].map((option, index) => {
              const isSelected = (activeModal === 'Tipo' && tipo === option) || (activeModal === 'Preço' && preco === option);
              return (
                <Pressable key={index} onPress={() => handleSelectOption(option)} className={`py-4 border-b border-gray-100 flex-row justify-between items-center ${isSelected ? 'bg-red-50 px-3 rounded-lg border-b-0' : ''}`}>
                  <Text className={`text-[16px] ${isSelected ? 'font-bold text-[rgb(223,19,36)]' : 'text-gray-800'}`}>
                    {option === 'Qualquer' ? `Qualquer ${activeModal}` : option}
                  </Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color="rgb(223,19,36)" />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}