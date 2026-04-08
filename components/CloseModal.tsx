import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';

interface CloseModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode; // Isto permite que o componente receba outros componentes lá dentro!
}

export default function CloseModal({ visible, title, onClose, children }: CloseModalProps) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        className="flex-1 justify-end bg-black/60"
      >
        <View className="bg-[rgb(58,79,92)] w-full rounded-t-3xl pt-6 px-6 pb-10 border-t border-white/10 shadow-2xl">
          
          {/* Header Padrão do Modal */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-xl font-bold">{title}</Text>
            <Pressable onPress={onClose} className="p-2 -mr-2 active:opacity-50">
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>

          {/* O conteúdo específico de cada formulário é injetado aqui */}
          {children}

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}