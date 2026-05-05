import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { CartItem, useCart } from '../src/contexts/CartContext';
import { AuthService } from '../src/services/auth';
import { getOuCriarConversa, processarCompra } from '../src/services/database';

const ImageMap: Record<string, any> = {
  'produtos/constituição_da_repu.png': require('../assets/images/constituição_da_repu.png'),
};
const DEFAULT_IMAGE = require('../assets/images/logo.png');

export default function CheckoutScreen() {
  const router = useRouter();
  const { cartItems, clearCart } = useCart();
  
  const params = useLocalSearchParams();
  const quantities = params.quantities ? JSON.parse(params.quantities as string) : {};
  const selectedSlots = params.selectedSlots ? JSON.parse(params.selectedSlots as string) : {};

  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  
  // Guardar uma "fotografia" dos itens comprados para o ecrã de sucesso não ficar vazio ao limpar o carrinho
  const [purchasedItems, setPurchasedItems] = useState<CartItem[]>([]);

  // ESTADO DO ALERTA CUSTOMIZADO
  const [alertState, setAlertState] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'warning' as 'success' | 'error' | 'warning',
    showCancel: false,
    confirmText: 'Entendido',
    onConfirm: null as (() => void) | null
  });

  const showAlert = (title: string, message: string, type: 'warning' | 'success' | 'error' = 'warning', confirmText = 'Entendido', onConfirm: (() => void) | null = null) => {
    setAlertState({ visible: true, title, message, type, showCancel: false, confirmText, onConfirm });
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
    const qty = quantities[item.id] || 1;
    return acc + (valorNum * qty);
  }, 0);

  const handleFazerPedido = async () => {
    if (!paymentMethod) {
      showAlert("Aviso", "Por favor, seleciona um método de pagamento antes de finalizares a compra.", "warning");
      return;
    }

    const user = await AuthService.getCurrentUser();
    if (!user) {
      showAlert("Erro", "Sessão inválida. Reinicia a app.", "error");
      return;
    }

    try {
      await processarCompra(user.id, cartItems, selectedSlots);
      
      // Guarda os itens na memória do ecrã e limpa imediatamente o carrinho real
      setPurchasedItems([...cartItems]);
      clearCart();
      setOrderComplete(true);
      
    } catch (error) {
      console.error("Erro ao processar compra: ", error);
      showAlert("Erro", "Ocorreu um erro ao processar a compra.", "error");
    }
  };

  const handleContactarVendedor = async (item: any) => {
    const user = await AuthService.getCurrentUser();
    if (!user) return;

    if(item.sellerId) {
      const conversaId = await getOuCriarConversa(user.id, item.sellerId, item.id, item.type === 'servico');
      if (conversaId) {
        router.push({
          pathname: '/conversa',
          params: { conversaId, nomeOutro: item.vendedor, tituloAnuncio: item.title },
        });
      }
    } else {
        showAlert("Aviso", "Por favor, vai aos detalhes do produto para contactar o vendedor.", "warning");
    }
  };

  const handleGoHome = () => {
    router.replace('/home');
  };

  if (orderComplete) {
    return (
      <View className="flex-1 bg-[rgb(58,79,92)] justify-center items-center px-6">
        <View className="bg-[#10b981]/20 p-6 rounded-full mb-6 mt-10">
          <Ionicons name="checkmark-circle" size={80} color="#10b981" />
        </View>
        <Text className="text-white text-3xl font-extrabold text-center mb-4">Compra Concluída!</Text>
        <Text className="text-gray-300 text-center text-[16px] mb-8 leading-6">
          O teu pedido foi recebido. Entra em contacto com os vendedores para combinar a entrega!
        </Text>
        
        <ScrollView className="w-full mb-6" showsVerticalScrollIndicator={false}>
          {purchasedItems.map((item, index) => (
            <View key={index} className="bg-white/10 rounded-xl p-4 mb-3 flex-row items-center justify-between border border-white/10">
              <View className="flex-1 pr-3">
                <Text className="text-white font-bold" numberOfLines={2}>{item.title}</Text>
                <Text className="text-gray-400 text-[12px] mt-1 font-medium uppercase">{item.vendedor}</Text>
              </View>
              <Pressable 
                onPress={() => handleContactarVendedor(item)}
                className="bg-[rgb(223,19,36)] px-4 py-2.5 rounded-lg flex-row items-center active:opacity-70"
              >
                <Ionicons name="chatbubbles" size={16} color="white" />
                <Text className="text-white font-bold ml-2">Chat</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>

        <Pressable onPress={handleGoHome} className="bg-white w-full py-4 rounded-xl items-center mb-10">
          <Text className="text-black font-black text-[16px]">VOLTAR AO INÍCIO</Text>
        </Pressable>

        {/* MODAL ALERTA NO SUCESSO */}
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
              
              <TouchableOpacity 
                onPress={handleConfirmAlert}
                activeOpacity={0.8}
                className="bg-[rgb(223,19,36)] w-full h-[50px] rounded-xl justify-center items-center"
              >
                <Text className="text-white font-bold text-[16px]">{alertState.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[rgb(58,79,92)]">
      
      <View className="pt-14 pb-4 px-4 flex-row items-center border-b border-white/10 ">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 active:opacity-70">
          <Ionicons name="arrow-back" size={26} color="white" />
        </Pressable>
        <Text className="text-2xl font-extrabold text-white ml-2 flex-1 text-center pr-8">Finalizar compra</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 pt-6 px-5">

        <Text className="text-gray-400 text-[11px] font-extrabold uppercase tracking-widest mb-3 ml-1">Pagamento</Text>
        <Pressable 
          onPress={() => setShowPaymentModal(true)}
          className="bg-white/5 border border-white/10 rounded-2xl p-4 flex-row items-center justify-between mb-10 active:bg-white/10"
        >
          <View className="flex-row items-center flex-1 pr-4">
            <View className="w-10 h-10 bg-white/10 rounded-full items-center justify-center mr-4">
              <Ionicons name="wallet" size={20} color="white" />
            </View>
            <Text className={`font-medium text-[15px] flex-1 leading-5 ${paymentMethod ? 'text-white font-bold' : 'text-gray-400'}`}>
              {paymentMethod ? paymentMethod : 'Selecione um método de pagamento'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.4)" />
        </Pressable>

        <View className="flex-row justify-between mb-3 ml-1 mr-1">
          <Text className="text-gray-400 text-[11px] font-extrabold uppercase tracking-widest">Itens</Text>
          <Text className="text-gray-400 text-[11px] font-extrabold uppercase tracking-widest">Preço</Text>
        </View>

        <View className="bg-white/5 border border-white/10 rounded-2xl p-2 mb-10">
          {cartItems.map((item, index) => {
            const valorNum = Number(item.price.replace(',', '.'));
            const qty = quantities[item.id] || 1;
            const itemTotal = (isNaN(valorNum) ? 0 : valorNum) * qty;
            const isServico = item.type === 'servico';

            return (
              <View 
                key={`checkout-${item.id}-${index}`}
                className={`flex-row items-center py-3 px-2 ${index !== cartItems.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                <View className="w-20 h-20 rounded-xl overflow-hidden bg-black/20 border border-white/5 p-1">
                  <Image source={getDynamicImage(item.img)} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </View>
                <View className="flex-1 mx-4 justify-center">
                  <Text className="text-white font-bold text-[14px] leading-5" numberOfLines={2}>{item.title}</Text>
                  {isServico && qty > 0 && (
                    <Text className="text-gray-400 text-[12px] mt-1">{qty} hora{qty > 1 ? 's' : ''} ({item.price}€/h)</Text>
                  )}
                </View>
                <Text className="text-white font-black text-[16px]">{itemTotal.toFixed(2).replace('.', ',')}€</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View className="px-5 pt-4 pb-10 border-t border-white/10 bg-black/20">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-gray-300 font-medium text-[16px]">Total</Text>
          <Text className="text-white font-black text-[26px]">{total.toFixed(2)}€</Text>
        </View>
        <Pressable 
          onPress={handleFazerPedido}
          className="w-full bg-black py-4 rounded-xl items-center flex-row justify-center active:bg-gray-800 shadow-xl border border-white/10"
        >
          <Text className="text-white font-bold text-[18px]">Fazer pedido</Text>
        </Pressable>
      </View>

      <Modal visible={showPaymentModal} transparent animationType="fade" onRequestClose={() => setShowPaymentModal(false)}>
        <Pressable className="flex-1 bg-black/60 justify-center items-center px-5" onPress={() => setShowPaymentModal(false)}>
          <Pressable className="bg-[rgb(58,79,92)] w-full rounded-3xl p-6 border border-white/10" onPress={(e) => e.stopPropagation()}>
            <Text className="text-2xl font-bold text-white mb-6 text-center">Método de Pagamento</Text>
            <Pressable onPress={() => { setPaymentMethod('MBWay'); setShowPaymentModal(false); }} className="bg-white/10 py-4 rounded-xl items-center mb-4 active:bg-white/20 border border-white/5">
              <Text className="text-white font-bold text-[16px]">MBWay</Text>
            </Pressable>
            <Pressable onPress={() => { setPaymentMethod('Numerário'); setShowPaymentModal(false); }} className="bg-white/10 py-4 rounded-xl items-center active:bg-white/20 border border-white/5">
              <Text className="text-white font-bold text-[16px]">Numerário</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL ALERTA GERAL */}
      <Modal animationType="fade" transparent visible={alertState.visible && !orderComplete} onRequestClose={closeAlert}>
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
            
            <TouchableOpacity 
              onPress={handleConfirmAlert}
              activeOpacity={0.8}
              className="bg-[rgb(223,19,36)] w-full h-[50px] rounded-xl justify-center items-center"
            >
              <Text className="text-white font-bold text-[16px]">{alertState.confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}