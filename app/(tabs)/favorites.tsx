import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { AuthService } from '../../src/services/auth';
import { AnuncioRow, getFavoritos, toggleFavorito } from '../../src/services/database';

const ImageMap: Record<string, any> = {
  'produtos/constituição_da_repu.png': require('../../assets/images/constituição_da_repu.png'),
};
const DEFAULT_IMAGE = require('../../assets/images/logo.png');

export default function FavoritesScreen() {
  const router = useRouter();
  const [favoritos, setFavoritos] = useState<AnuncioRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // ESTADO DO ALERTA CUSTOMIZADO
  const [alertState, setAlertState] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'warning' as 'success' | 'error' | 'warning',
    showCancel: false,
    onConfirm: null as (() => void) | null
  });

  const showAlert = (title: string, message: string, type: 'warning' | 'success' | 'error', showCancel = false, onConfirm: (() => void) | null = null) => {
    setAlertState({ visible: true, title, message, type, showCancel, onConfirm });
  };

  const closeAlert = () => {
    setAlertState(prev => ({ ...prev, visible: false }));
  };

  const handleConfirmAlert = () => {
    const onConfirm = alertState.onConfirm;
    closeAlert();
    if (onConfirm) onConfirm();
  };

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const user = await AuthService.getCurrentUser();
        if (!user) return;
        setCurrentUserId(user.id);
        const lista = await getFavoritos(user.id);
        setFavoritos(lista);
      };
      load();
    }, [])
  );

  const getDynamicImage = (imgPath: string | null) => {
    if (!imgPath) return DEFAULT_IMAGE;
    if (imgPath.startsWith('file://') || imgPath.startsWith('http')) return { uri: imgPath };
    if (ImageMap[imgPath]) return ImageMap[imgPath];
    return DEFAULT_IMAGE;
  };

  const handleRemoveFavorito = (item: AnuncioRow) => {
    showAlert(
      "Remover Favorito",
      `Queres remover "${item.title}" dos favoritos?`,
      "warning",
      true, // Mostra o botão cancelar
      async () => {
        if (!currentUserId) return;
        await toggleFavorito(currentUserId, item.id, item.type === 'servico');
        setFavoritos((prev) => prev.filter((f) => !(f.id === item.id && f.type === item.type)));
      }
    );
  };

  const handlePress = (item: AnuncioRow) => {
    router.push({
      pathname: item.type === 'servico' ? '/servicos' : '/produtos',
      params: { id: item.id },
    });
  };

  const getCleanPrice = (price: string) => {
    return price ? price.replace('€/h', '').replace('€', '').trim() : '0';
  };

  return (
    <View className="flex-1 bg-[rgb(58,79,92)]">

      <View className="pt-14 pb-3 px-4 items-center justify-center border-b border-white/10">
        <Text className="text-3xl font-extrabold text-white">Favoritos</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 pt-6 px-4">

        {favoritos.length === 0 ? (
          <View className="flex-1 items-center justify-center mt-28">
            <Ionicons name="heart-outline" size={70} color="rgba(255,255,255,0.4)" />
            <Text className="text-white text-[22px] font-bold mt-6 mb-2">Ainda não tens favoritos</Text>
            <Text className="text-gray-300 text-center text-[14px] px-6 leading-6">
              Clica no coração junto aos produtos e serviços que mais gostas para os guardares aqui.
            </Text>
            <Pressable
              onPress={() => router.navigate('/home')}
              className="mt-8 bg-[rgb(223,19,36)] px-8 py-4 rounded-xl active:bg-[rgb(193,17,32)]"
            >
              <Text className="text-white font-bold text-[16px]">Explorar Anúncios</Text>
            </Pressable>
          </View>
        ) : (
          <View className="pb-10">
            <Text className="text-gray-400 font-medium mb-4">
              Tens {favoritos.length} artigo{favoritos.length !== 1 ? 's' : ''} nos favoritos
            </Text>

            {favoritos.map((item) => (
              <View 
                key={`${item.type}-${item.id}`}
                className="flex-row bg-white/5 border border-white/10 rounded-2xl p-3 mb-4 items-center"
              >
                <Pressable 
                  onPress={() => handlePress(item)}
                  className="w-20 h-20 rounded-xl overflow-hidden bg-white/5 border border-white/10 p-1"
                >
                  <Image 
                    source={getDynamicImage(item.img)} 
                    style={{ width: '100%', height: '100%' }} 
                    resizeMode="contain" 
                  />
                </Pressable>

                <View className="flex-1 ml-4 justify-center">
                  <View className="flex-row items-center mb-1 justify-between">
                    <Text className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">
                      {item.type === 'servico' ? 'Serviço' : 'Produto'}
                    </Text>
                    <Pressable 
                      onPress={(e) => { e.stopPropagation(); handleRemoveFavorito(item); }} 
                      className="p-1 active:opacity-50"
                    >
                      <Ionicons name="heart" size={25} color="rgb(223,19,36)" />
                    </Pressable>
                  </View>

                  <Pressable onPress={() => handlePress(item)}>
                    <Text className="text-white font-bold text-[15px] leading-tight mb-1" numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text className="text-white font-black text-[16px]">
                      {getCleanPrice(item.price)}€{item.type === 'servico' && <Text className="text-[12px] font-normal text-gray-400">/h</Text>}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL: ALERTA CUSTOMIZADO */}
      {/* ======================================================== */}
      <Modal animationType="fade" transparent visible={alertState.visible} onRequestClose={closeAlert}>
        <View className="flex-1 justify-center items-center bg-black/70 px-6">
          <View className="bg-[rgb(48,66,77)] w-full rounded-3xl p-6 items-center shadow-2xl border border-white/10">
            
            <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
              alertState.type === 'success' ? 'bg-[#10b981]/20' : 
              alertState.type === 'error' ? 'bg-[rgb(223,19,36)]/20' : 'bg-[#fbbf24]/20'
            }`}>
              <Ionicons 
                name={
                  alertState.type === 'success' ? 'checkmark-circle' : 
                  alertState.type === 'error' ? 'close-circle' : 'warning'
                } 
                size={36} 
                color={
                  alertState.type === 'success' ? '#10b981' : 
                  alertState.type === 'error' ? 'rgb(223,19,36)' : '#fbbf24'
                } 
              />
            </View>

            <Text className="text-white text-xl font-bold text-center mb-2">{alertState.title}</Text>
            <Text className="text-gray-300 text-[15px] text-center leading-6 mb-8">{alertState.message}</Text>
            
            <View className={`w-full ${alertState.showCancel ? 'flex-row gap-3' : ''}`}>
              {alertState.showCancel && (
                <TouchableOpacity 
                  onPress={closeAlert}
                  activeOpacity={0.8}
                  className="flex-1 bg-white/10 h-[50px] rounded-xl justify-center items-center"
                >
                  <Text className="text-white font-bold text-[16px]">Cancelar</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                onPress={handleConfirmAlert}
                activeOpacity={0.8}
                className={`${alertState.showCancel ? 'flex-1' : 'w-full'} bg-[rgb(223,19,36)] h-[50px] rounded-xl justify-center items-center`}
              >
                <Text className="text-white font-bold text-[16px]">
                  {alertState.showCancel ? 'Remover' : 'Entendido'}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </View>
  );
}