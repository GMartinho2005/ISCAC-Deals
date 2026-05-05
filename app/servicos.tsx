import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { useCart } from '../src/contexts/CartContext';
import { AuthService } from '../src/services/auth';
import {
  AnuncioRow,
  getOuCriarConversa,
  getOutrosAnunciosByUser,
  getServicoById,
  isFavorito,
  ServicoDetalhe,
  toggleFavorito,
} from '../src/services/database';

const ImageMap: Record<string, any> = {};
const DEFAULT_IMAGE = require('../assets/images/logo.png');

export default function ServicosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id ? Number(params.id) : null;
  const isPurchased = params.isPurchased === 'true';

  const [servico, setServico] = useState<ServicoDetalhe | null>(null);
  const [outros, setOutros] = useState<AnuncioRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [favorito, setFavorito] = useState(false);
  const [toastInfo, setToastInfo] = useState<{ message: string; type: 'cart' | 'fav_add' | 'fav_remove' } | null>(null);

  const { addToCart, isInCart, removeFromCart } = useCart();

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const user = await AuthService.getCurrentUser();
      setCurrentUserId(user?.id || null);
      const data = await getServicoById(id);
      setServico(data);
      
      if (data) {
        const maisServicos = await getOutrosAnunciosByUser(data.id_utilizador, id, 'servico');
        setOutros(maisServicos);

        let currentSlots = [];
        try {
          if (data.horario) currentSlots = JSON.parse(data.horario);
        } catch { }

        if (currentSlots.length === 0) {
          if (isInCart(data.id, 'servico')) {
            removeFromCart(data.id, 'servico');
          }
        } 
        
        if (user?.id) {
          const fav = await isFavorito(user.id, id, true);
          setFavorito(fav);
        }
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleToggleFavorito = async () => {
    if (!currentUserId || !id) return;
    const novoEstado = await toggleFavorito(currentUserId, id, true);
    setFavorito(novoEstado);
    setToastInfo({ message: novoEstado ? 'Adicionado aos favoritos!' : 'Removido dos favoritos!', type: novoEstado ? 'fav_add' : 'fav_remove' });
    setTimeout(() => setToastInfo(null), 2000);
  };

  const handleContactar = async () => {
    if (!currentUserId || !servico) return;

    if (currentUserId === servico.id_utilizador) {
      Alert.alert('Aviso', 'Não podes contactar-te a ti próprio.');
      return;
    }

    const conversaId = await getOuCriarConversa(
      currentUserId,
      servico.id_utilizador,
      servico.id,
      true
    );

    if (!conversaId) {
      Alert.alert('Erro', 'Não foi possível iniciar a conversa.');
      return;
    }

    router.push({
      pathname: '/conversa',
      params: {
        conversaId,
        nomeOutro: servico.nome_prestador,
        tituloAnuncio: servico.titulo,
      },
    });
  };

  const getDynamicImage = (imgPath: string | null) => {
    if (!imgPath) return DEFAULT_IMAGE;
    if (imgPath.startsWith('file://') || imgPath.startsWith('http')) return { uri: imgPath };
    if (ImageMap[imgPath]) return ImageMap[imgPath];
    return DEFAULT_IMAGE;
  };

  if (!servico) {
    return (
      <View className="flex-1 bg-[rgb(58,79,92)] items-center justify-center">
        <Text className="text-white font-medium">A carregar detalhes...</Text>
      </View>
    );
  }

  const isMyAd = currentUserId === servico.id_utilizador;
  const displayPrice = servico.preco ? servico.preco.replace('€/h', '').replace('€', '').trim() : '0';
  
  let parsedSlots: { date: string; time: string }[] = [];
  try {
    if (servico.horario) parsedSlots = JSON.parse(servico.horario);
  } catch { }

  const hasAvailability = parsedSlots.length > 0;
  const isItemInCart = isInCart(servico.id, 'servico');

  const handleCartClick = () => {
    addToCart({ id: servico.id, type: 'servico', title: servico.titulo, price: displayPrice, img: servico.foto, vendedor: servico.nome_prestador, sellerId: servico.id_utilizador });
    setToastInfo({ message: 'Serviço adicionado ao carrinho.\nClique aqui para ir para o carrinho.', type: 'cart' });
    setTimeout(() => setToastInfo(null), 4000);
  };

  return (
    <View className="flex-1 bg-[rgb(58,79,92)]">
      {toastInfo && (
        <View className="absolute top-16 w-full px-4 z-50">
          {toastInfo.type === 'cart' ? (
            <Pressable
              onPress={() => { setToastInfo(null); router.push('/cart'); }}
              className="bg-[#10b981] flex-row items-center p-4 rounded-2xl shadow-xl border border-white/20 active:opacity-80"
            >
              <Ionicons name="cart" size={26} color="white" />
              <Text className="text-white font-bold ml-3 text-[14px] flex-1 leading-5">{toastInfo.message}</Text>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </Pressable>
          ) : (
            <View className={`flex-row items-center justify-center p-4 rounded-2xl shadow-xl border border-white/20 ${toastInfo.type === 'fav_add' ? 'bg-[#10b981]' : 'bg-[rgb(223,19,36)]'}`}>
              <Ionicons name={toastInfo.type === 'fav_add' ? 'checkmark-circle' : 'trash'} size={22} color="white" />
              <Text className="text-white font-bold ml-2 text-[15px]">{toastInfo.message}</Text>
            </View>
          )}
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="w-full h-[300px] relative pt-12 pb-4">
          <View className="absolute top-14 left-4 right-4 flex-row justify-between items-center z-10">
            <Pressable onPress={() => router.back()} className="bg-black/40 p-3 rounded-full active:opacity-70 border border-white/10">
              <Ionicons name="arrow-back" size={24} color="white" />
            </Pressable>
            
            {/* Oculta o ícone de favoritos apenas se for o meu anúncio ou uma compra já feita. A disponibilidade já não importa aqui. */}
            {!isMyAd && !isPurchased && (
              <Pressable onPress={handleToggleFavorito} className="bg-black/40 p-3 rounded-full active:opacity-70 border border-white/10">
                <Ionicons name={favorito ? 'heart' : 'heart-outline'} size={24} color={favorito ? 'rgb(223,19,36)' : 'white'} />
              </Pressable>
            )}
          </View>
          <Image source={getDynamicImage(servico.foto)} className="w-full h-full" resizeMode="contain" />
        </View>

        <View className="px-5 pt-4 pb-8">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center flex-1 pr-4">
              <View className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 mr-3">
                <Text className="text-white text-[12px] font-extrabold uppercase tracking-wider">{servico.formato}</Text>
              </View>
              <Text className="text-gray-300 font-medium flex-1 text-[14px] leading-5">
                Prestado por <Text className="font-bold text-white">{servico.nome_prestador}{isMyAd ? ' (Tu)' : ''}</Text>
              </Text>
            </View>
            <View className="flex-row items-center bg-[#fbbf24]/20 px-3 py-1.5 rounded-lg border border-[#fbbf24]/30 shrink-0">
              <Ionicons name="star" size={16} color="#fbbf24" />
              <Text className="text-[#fbbf24] font-bold ml-1 text-[14px]">
                {Number(servico.avaliacao_media).toFixed(1)}
                <Text className="font-normal opacity-80"> ({servico.total_avaliacoes})</Text>
              </Text>
            </View>
          </View>

          <Text className="text-white text-3xl font-extrabold mb-2 leading-tight">{servico.titulo}</Text>
          <Text className="text-white text-3xl font-black mb-8">
            {displayPrice}€ <Text className="text-xl font-medium text-gray-400">/ hora</Text>
          </Text>

          <View className="bg-white/5 rounded-2xl p-5 border border-white/10 mb-8">
            {servico.formato !== 'Online' && (
              <View className="flex-row items-center mb-5">
                <View className="w-10 h-10 bg-white/10 rounded-full items-center justify-center">
                  <Ionicons name="location" size={20} color="white" />
                </View>
                <View className="ml-3">
                  <Text className="text-white font-bold text-[16px]">ISCAC</Text>
                  <Text className="text-gray-400 text-[13px]">Local a combinar.</Text>
                </View>
              </View>
            )}
            <View className="flex-row items-start">
              <View className="w-10 h-10 bg-white/10 rounded-full items-center justify-center mt-1">
                <Ionicons name="time" size={20} color="white" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-white font-bold text-[16px] mb-1">Disponibilidade</Text>
                {hasAvailability ? (
                  parsedSlots.map((slot, index) => {
                    const dateObj = new Date(slot.date);
                    const timeObj = new Date(slot.time);
                    return (
                      <Text key={index} className="text-gray-300 text-[14px] mb-1">
                        • {dateObj.toLocaleDateString('pt-PT')} às {timeObj.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    );
                  })
                ) : (
                  <Text className="text-gray-400 text-[13px] mt-1">Contactar o vendedor para mais informações sobre a disponibilidade</Text>
                )}
              </View>
            </View>
          </View>

          <Text className="text-white text-xl font-bold mb-3">Sobre o Serviço</Text>
          <Text className="text-gray-300 text-[15px] leading-7 mb-10">{servico.descricao}</Text>

          {outros.length > 0 && (
            <>
              <Text className="text-white text-xl font-bold mb-4">
                Outros serviços de {servico.nome_prestador}{isMyAd ? ' (Tu)' : ''}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible mb-10">
                {outros.map((item) => {
                  const cleanItemPrice = item.price ? item.price.replace('€/h', '').replace('€', '').trim() : '0';
                  return (
                    <Pressable
                      key={`${item.type}-${item.id}`}
                      onPress={() => router.push({ pathname: item.type === 'servico' ? '/servicos' : '/produtos', params: { id: item.id } })}
                      className="w-40 mr-4 pb-3 active:opacity-80"
                    >
                      <View className="w-full h-32 mb-3 bg-black/20 rounded-xl overflow-hidden border border-white/5">
                        <Image source={getDynamicImage(item.img)} className="w-full h-full" resizeMode="contain" />
                      </View>
                      <View className="px-1">
                        <Text className="text-white font-bold text-[14px]" numberOfLines={2}>{item.title}</Text>
                        <Text className="text-white font-black text-[16px] mt-1">
                          {cleanItemPrice}€{item.type === 'servico' && <Text className="text-[12px] font-normal text-gray-400">/h</Text>}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </ScrollView>

      {!isMyAd && !isPurchased && (
        <View className="px-5 pt-4 pb-12 border-t border-white/10 bg-[rgb(58,79,92)] flex-row gap-3">
          
          {!isItemInCart && hasAvailability && (
            <Pressable
              onPress={handleCartClick}
              className="flex-1 bg-white/10 py-4 rounded-xl items-center flex-row justify-center active:bg-white/20 border border-white/10"
            >
              <Ionicons name="cart-outline" size={20} color="white" />
              <Text className="text-white font-bold ml-2 text-[16px]">Carrinho</Text>
            </Pressable>
          )}

          {!hasAvailability && (
            <View className="flex-1 bg-white/5 py-4 rounded-xl items-center flex-row justify-center border border-white/5">
              <Ionicons name="cart-outline" size={20} color="rgba(255,255,255,0.3)" />
              <Text className="text-white/30 font-bold ml-2 text-[16px]">Indisponível</Text>
            </View>
          )}

          <Pressable
            onPress={handleContactar}
            className="flex-1 bg-black py-4 rounded-xl items-center flex-row justify-center active:bg-gray-800"
          >
            <Ionicons name="chatbubbles-outline" size={20} color="white" />
            <Text className="text-white font-bold ml-2 text-[16px]">Contactar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}