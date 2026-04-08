import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Image, InteractionManager, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { getAnunciosByCategoria } from '../src/services/database';

const FILTER_OPTIONS: Record<string, string[]> = {
  'Estado': ['Qualquer', 'Novo', 'Pouco Uso', 'Muito uso'],
  'Formato': ['Qualquer', 'Online', 'Presencial'],
  'Preço': ['Qualquer', 'Ordenar por mais caro', 'Ordenar por mais barato'],
  'Avaliação': ['Qualquer', 'Melhor avaliação', 'Pior avaliação'],
};

// ==========================================
// REDE DE SEGURANÇA (Dicionário de Imagens)
// ==========================================
const ImageMap: Record<string, any> = {
  'produtos/constituição_da_repu.png': require('../assets/images/constituição_da_repu.png'),
};

const DEFAULT_IMAGE = require('../assets/images/logo.png');

export default function CategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const categoryName = (params.categoryName as string) || 'Categoria';
  const categoryId = params.categoryId ? Number(params.categoryId) : null;

  const isService = categoryName.toLowerCase().includes('explicaç') || categoryName.toLowerCase().includes('serviç');

  const scrollViewRef = useRef<ScrollView>(null);

  const [allItems, setAllItems] = useState<any[]>([]);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [estado, setEstado] = useState('Qualquer');
  const [formato, setFormato] = useState('Qualquer');
  const [preco, setPreco] = useState('Qualquer');
  const [avaliacao, setAvaliacao] = useState('Qualquer');

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      setEstado('Qualquer');
      setFormato('Qualquer');
      setPreco('Qualquer');
      setAvaliacao('Qualquer');
      setActiveModal(null);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });

      const load = async () => {
        if (categoryId) {
          try {
            const items = await getAnunciosByCategoria(categoryId);
            if (isActive) setAllItems(items);
          } catch (error) {
            console.error("Erro ao carregar categoria:", error);
          }
        }
      };

      // Proteção para a navegação não crashar o SQLite
      const task = InteractionManager.runAfterInteractions(() => {
        if (isActive) load();
      });

      return () => {
        isActive = false;
        task.cancel();
      };
    }, [categoryId])
  );

  let displayed = [...allItems];

  if (!isService) {
    if (estado !== 'Qualquer') displayed = displayed.filter((p: any) => p.condition === estado);
    if (preco === 'Ordenar por mais caro') displayed.sort((a: any, b: any) => parseFloat(b.price) - parseFloat(a.price));
    if (preco === 'Ordenar por mais barato') displayed.sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price));
  } else {
    if (formato !== 'Qualquer') displayed = displayed.filter((s: any) => s.format === formato);
    if (preco === 'Ordenar por mais caro') displayed.sort((a: any, b: any) => parseFloat(b.price) - parseFloat(a.price));
    if (preco === 'Ordenar por mais barato') displayed.sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price));
    if (avaliacao === 'Melhor avaliação') displayed.sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0));
    if (avaliacao === 'Pior avaliação') displayed.sort((a: any, b: any) => (a.rating ?? 0) - (b.rating ?? 0));
  }

  const handleSelectOption = (option: string) => {
    if (activeModal === 'Estado') setEstado(option);
    if (activeModal === 'Formato') setFormato(option);
    if (activeModal === 'Preço') setPreco(option);
    if (activeModal === 'Avaliação') setAvaliacao(option);
    setActiveModal(null);
  };

  // ==========================================
  // MOTOR DE IMAGENS DINÂMICO
  // ==========================================
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

  return (
    <View className="flex-1 bg-[rgb(58,79,92)]">
      <View className="pt-14 pb-3 px-4 flex-row items-center">
        <Pressable className="mr-4" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </Pressable>
        <Text className="text-xl font-bold text-white flex-1" numberOfLines={1}>
          {categoryName}
        </Text>
      </View>

      <View className="pb-3 border-b border-white/20">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-3">
          {!isService && (
            <>
              <Pressable onPress={() => setActiveModal('Estado')} className={`flex-row items-center px-4 py-2 rounded-full mr-2 shadow-sm ${estado !== 'Qualquer' ? 'bg-[rgb(223,19,36)]' : 'bg-white'}`}>
                <Text className={`text-[14px] mr-1 ${estado !== 'Qualquer' ? 'text-white font-bold' : 'text-black'}`}>{estado !== 'Qualquer' ? estado : 'Estado'}</Text>
                <Ionicons name="chevron-down" size={14} color={estado !== 'Qualquer' ? 'white' : 'black'} />
              </Pressable>
              <Pressable onPress={() => setActiveModal('Preço')} className={`flex-row items-center px-4 py-2 rounded-full mr-4 shadow-sm ${preco !== 'Qualquer' ? 'bg-[rgb(223,19,36)]' : 'bg-white'}`}>
                <Text className={`text-[14px] mr-1 ${preco !== 'Qualquer' ? 'text-white font-bold' : 'text-black'}`}>{preco !== 'Qualquer' ? preco : 'Preço'}</Text>
                <Ionicons name="chevron-down" size={14} color={preco !== 'Qualquer' ? 'white' : 'black'} />
              </Pressable>
            </>
          )}
          {isService && (
            <>
              <Pressable onPress={() => setActiveModal('Formato')} className={`flex-row items-center px-4 py-2 rounded-full mr-2 shadow-sm ${formato !== 'Qualquer' ? 'bg-[rgb(223,19,36)]' : 'bg-white'}`}>
                <Text className={`text-[14px] mr-1 ${formato !== 'Qualquer' ? 'text-white font-bold' : 'text-black'}`}>{formato !== 'Qualquer' ? formato : 'Formato'}</Text>
                <Ionicons name="chevron-down" size={14} color={formato !== 'Qualquer' ? 'white' : 'black'} />
              </Pressable>
              <Pressable onPress={() => setActiveModal('Preço')} className={`flex-row items-center px-4 py-2 rounded-full mr-2 shadow-sm ${preco !== 'Qualquer' ? 'bg-[rgb(223,19,36)]' : 'bg-white'}`}>
                <Text className={`text-[14px] mr-1 ${preco !== 'Qualquer' ? 'text-white font-bold' : 'text-black'}`}>{preco !== 'Qualquer' ? preco : 'Preço'}</Text>
                <Ionicons name="chevron-down" size={14} color={preco !== 'Qualquer' ? 'white' : 'black'} />
              </Pressable>
              <Pressable onPress={() => setActiveModal('Avaliação')} className={`flex-row items-center px-4 py-2 rounded-full mr-4 shadow-sm ${avaliacao !== 'Qualquer' ? 'bg-[rgb(223,19,36)]' : 'bg-white'}`}>
                <Text className={`text-[14px] mr-1 ${avaliacao !== 'Qualquer' ? 'text-white font-bold' : 'text-black'}`}>{avaliacao !== 'Qualquer' ? avaliacao : 'Avaliação'}</Text>
                <Ionicons name="chevron-down" size={14} color={avaliacao !== 'Qualquer' ? 'white' : 'black'} />
              </Pressable>
            </>
          )}
        </ScrollView>

        <View className="flex-row items-center justify-between px-5 mt-1">
          <Text className="text-gray-300 font-medium text-[13px]">{displayed.length} resultados encontrados</Text>
        </View>
      </View>

      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} className="flex-1 pt-6">
        {displayed.map((ad: any) => {
          // Filtro para limpar os símbolos duplicados na zona da categoria
          const cleanPrice = ad.price ? String(ad.price).replace('€/h', '').replace('€', '').trim() : '0';

          return (
            <View key={`${ad.type}-${ad.id}`} className="mb-10 px-4">
              
              {/* === IMAGEM LIMPA === */}
              <Pressable
                onPress={() => router.push({ pathname: ad.type === 'servico' ? '/servicos' : '/produtos', params: { id: ad.id } })}
                className="w-full h-[280px] rounded-3xl overflow-hidden mb-4 active:opacity-90"
              >
                <Image source={getDynamicImage(ad.img)} className="w-full h-full" resizeMode="contain" />
              </Pressable>
              {/* ==================== */}

              <View className="px-2">
                
                {/* === TÍTULO E FORMATO === */}
                <Text className="text-white text-[24px] font-extrabold shadow-sm leading-tight mb-2" numberOfLines={2}>
                  {ad.type === 'servico' ? (ad.name || ad.title) : ad.title}
                </Text>
                
                {ad.type === 'servico' && ad.format && (
                  <View className="flex-row items-center mb-3">
                    <Ionicons name="videocam-outline" size={16} color="rgba(255,255,255,0.7)" />
                    <Text className="text-gray-300 text-[14px] font-medium ml-1.5">{ad.format}</Text>
                  </View>
                )}

                {/* Informação do Estado/Avaliação e Vendedor */}
                <View className="flex-row items-center justify-between mb-4 mt-1">
                  
                  {/* Esquerda: Estado ou Avaliação */}
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

                  {/* Direita: Vendedor */}
                  <View className="flex-row items-center bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                    <Ionicons name="person-circle-outline" size={18} color="white" />
                    <Text className="text-gray-200 text-[14px] ml-1.5">
                      Vendido por <Text className="font-bold text-white">{ad.nome_vendedor || 'Utilizador'}</Text>
                    </Text>
                  </View>
                </View>

                {/* Preço formatado e Botão */}
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

      {/* Modal de Filtros (Mantém-se inalterado) */}
      <Modal visible={activeModal !== null} animationType="slide" transparent onRequestClose={() => setActiveModal(null)}>
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setActiveModal(null)}>
          <Pressable className="bg-white rounded-t-3xl p-6 pb-10" onPress={(e) => e.stopPropagation()}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-black">Filtrar por {activeModal}</Text>
              <Pressable onPress={() => setActiveModal(null)} className="bg-gray-100 p-2 rounded-full">
                <Ionicons name="close" size={20} color="black" />
              </Pressable>
            </View>
            {activeModal && FILTER_OPTIONS[activeModal].map((option, index) => {
              const isSelected =
                (activeModal === 'Estado' && estado === option) ||
                (activeModal === 'Formato' && formato === option) ||
                (activeModal === 'Preço' && preco === option) ||
                (activeModal === 'Avaliação' && avaliacao === option);
              return (
                <Pressable key={index} onPress={() => handleSelectOption(option)} className={`py-4 border-b border-gray-100 flex-row justify-between items-center ${isSelected ? 'bg-red-50/50 px-2 rounded-lg border-b-0' : ''}`}>
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