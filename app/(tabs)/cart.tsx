import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useCart } from '../../src/contexts/CartContext';
import { getServicoById } from '../../src/services/database';

const ImageMap: Record<string, any> = {
  'produtos/constituição_da_repu.png': require('../../assets/images/constituição_da_repu.png'),
};
const DEFAULT_IMAGE = require('../../assets/images/logo.png');

export default function CartScreen() {
  const router = useRouter();
  const { cartItems, removeFromCart } = useCart();

  const [serviceSlots, setServiceSlots] = useState<Record<number, { date: string; time: string }[]>>({});
  const [selectedSlots, setSelectedSlots] = useState<Record<number, string[]>>({});

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

  const getDynamicImage = (imgPath: string | null) => {
    if (!imgPath) return DEFAULT_IMAGE;
    if (imgPath.startsWith('file://') || imgPath.startsWith('http')) return { uri: imgPath };
    if (ImageMap[imgPath]) return ImageMap[imgPath];
    return DEFAULT_IMAGE;
  };

  const total = cartItems.reduce((acc, item) => {
    const valorNum = Number(item.price.replace(',', '.'));
    if (isNaN(valorNum)) return acc;
    if (item.type === 'servico') {
      const hasSlots = serviceSlots[item.id] && serviceSlots[item.id].length > 0;
      const numSlots = hasSlots ? (selectedSlots[item.id]?.length || 0) : 1; 
      return acc + (valorNum * numSlots);
    }
    return acc + valorNum;
  }, 0);

  useEffect(() => {
    const fetchSlots = async () => {
      const newSlots: Record<number, { date: string; time: string }[]> = {};
      for (const item of cartItems) {
        if (item.type === 'servico') {
          const svc = await getServicoById(item.id);
          if (svc && svc.horario) {
            try {
              newSlots[item.id] = JSON.parse(svc.horario);
            } catch (error) {
              console.warn("Erro ao ler horários do serviço", item.id, error);
            }
          }
        }
      }
      setServiceSlots(newSlots);
    };
    fetchSlots();
  }, [cartItems]);

  const handleRemoveFromCart = (item: any) => {
    showAlert(
      "Remover do Carrinho",
      `Queres remover "${item.title}" do carrinho?`,
      "warning",
      true, // Mostra o botão cancelar
      () => {
        removeFromCart(item.id, item.type);
        if (item.type === 'servico') {
          setSelectedSlots(prev => {
            const updated = { ...prev };
            delete updated[item.id];
            return updated;
          });
        }
      }
    );
  };

  const toggleSlot = (serviceId: number, slotStr: string) => {
    setSelectedSlots(prev => {
      const current = prev[serviceId] || [];
      if (current.includes(slotStr)) {
        return { ...prev, [serviceId]: current.filter(s => s !== slotStr) };
      } else {
        return { ...prev, [serviceId]: [...current, slotStr] };
      }
    });
  };

  const handleCheckout = () => {
    let missingSlots = false;
    const itemQuantities: Record<number, number> = {};

    for (const item of cartItems) {
      if (item.type === 'servico') {
        const slots = serviceSlots[item.id];
        const hasSlots = slots && slots.length > 0;
        const userSelected = selectedSlots[item.id];

        if (hasSlots && (!userSelected || userSelected.length === 0)) {
          missingSlots = true;
          break;
        }
        itemQuantities[item.id] = hasSlots ? userSelected.length : 1;
      } else {
        itemQuantities[item.id] = 1;
      }
    }

    if (missingSlots) {
      showAlert(
        "Horário Obrigatório",
        "Por favor, seleciona pelo menos um horário para cada serviço no teu carrinho antes de avançar.",
        "warning"
      );
      return;
    }

    router.push({ pathname: '/checkout', params: { quantities: JSON.stringify(itemQuantities), selectedSlots: JSON.stringify(selectedSlots) } });
  };

  return (
    <View className="flex-1 bg-[rgb(58,79,92)]">
      <View className="pt-14 pb-3 px-4 items-center justify-center border-b border-white/10">
        <Text className="text-3xl font-extrabold text-white">Carrinho</Text>
      </View>

      {cartItems.length === 0 ? (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 pt-6 px-4">
          <View className="flex-1 items-center justify-center mt-32">
            <View className="w-24 h-24 items-center justify-center mb-6">
              <Ionicons name="bag-handle-outline" size={70} color="white" />
            </View>
            <Text className="text-white text-[25px] font-bold mb-2">O teu carrinho está vazio</Text>
            <Text className="text-gray-300 text-center text-[14px] px-8 leading-6">
              Ainda não adicionaste nenhum artigo. Explora as categorias e encontra os melhores materiais e serviços!
            </Text>
            <Pressable 
              onPress={() => router.navigate('/home')} 
              className="mt-8 bg-[rgb(223,19,36)] px-8 py-4 rounded-xl active:bg-[rgb(193,17,32)] shadow-sm"
            >
              <Text className="text-white font-bold text-[16px]">Explorar Anúncios</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1 pt-6 px-4">
            <Text className="text-gray-400 font-medium mb-4">
              Tens {cartItems.length} artigo{cartItems.length > 1 ? 's' : ''} no carrinho
            </Text>
            {cartItems.map((item, index) => (
              <View 
                key={`${item.type}-${item.id}-${index}`}
                className="bg-white/5 border border-white/10 rounded-2xl p-3 mb-4"
              >
                <View className="flex-row items-center">
                  <Pressable 
                    onPress={() => router.push({ pathname: item.type === 'servico' ? '/servicos' : '/produtos', params: { id: item.id } })}
                    className="w-20 h-20 rounded-xl overflow-hidden bg-white/5 border border-white/10 p-1"
                  >
                    <Image source={getDynamicImage(item.img)} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  </Pressable>
                  <View className="flex-1 ml-4 justify-center">
                    <View className="flex-row items-center mb-1 justify-between">
                      <Text className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">
                        {item.type === 'servico' ? 'Serviço' : 'Produto'}
                      </Text>
                      <Pressable onPress={() => handleRemoveFromCart(item)} className="p-1 active:opacity-50">
                        <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.5)" />
                      </Pressable>
                    </View>
                    <Pressable onPress={() => router.push({ pathname: item.type === 'servico' ? '/servicos' : '/produtos', params: { id: item.id } })}>
                      <Text className="text-white font-bold text-[15px] leading-tight mb-1" numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text className="text-white font-black text-[16px]">
                        {item.price}€{item.type === 'servico' && <Text className="text-[12px] font-normal text-gray-400">/h</Text>}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {item.type === 'servico' && serviceSlots[item.id] && serviceSlots[item.id].length > 0 && (
                  <View className="mt-3 pt-3 border-t border-white/10">
                    <Text className="text-gray-300 text-[12px] font-bold mb-2">
                      Seleciona o(s) horário(s): <Text className="text-[rgb(223,19,36)]">*</Text>
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {serviceSlots[item.id].map((slot, idx) => {
                        const dateObj = new Date(slot.date);
                        const timeObj = new Date(slot.time);
                        const slotStr = `${slot.date}_${slot.time}`;
                        const isSelected = selectedSlots[item.id]?.includes(slotStr);

                        return (
                          <Pressable 
                            key={idx}
                            onPress={() => toggleSlot(item.id, slotStr)}
                            className={`px-3 py-2 rounded-lg border ${isSelected ? 'bg-[rgb(223,19,36)] border-transparent' : 'bg-white/5 border-white/10'}`}
                          >
                            <Text className={`text-[12px] font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                              {dateObj.toLocaleDateString('pt-PT')} das {timeObj.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} às {new Date(timeObj.getTime() + 60 * 60 * 1000).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
          <View className="px-5 pt-4 pb-8 border-t border-white/10 bg-black/20">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-gray-300 font-medium text-[16px]">Total</Text>
              <Text className="text-white font-black text-2xl">{total.toFixed(2)}€</Text>
            </View>

            <Pressable 
              onPress={handleCheckout}
              className="w-full bg-[rgb(223,19,36)] py-4 rounded-xl items-center flex-row justify-center active:bg-[rgb(193,17,32)] shadow-lg"
            >
              <Ionicons name="card-outline" size={20} color="white" />
              <Text className="text-white font-bold ml-2 text-[16px]">Finalizar a Compra</Text>
            </Pressable>
          </View>
        </>
      )}

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