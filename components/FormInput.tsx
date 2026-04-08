import React from 'react';
import { TextInput, TextInputProps, View } from 'react-native';

// Definimos que este input aceita todas as propriedades normais de um TextInput, 
// mais uma propriedade extra inventada por nós: isMultiline
interface FormInputProps extends TextInputProps {
  isMultiline?: boolean;
}

export default function FormInput({ isMultiline, ...props }: FormInputProps) {
  return (
    <View className={`bg-white/10 border border-white/20 rounded-xl px-4 justify-center mb-4 ${isMultiline ? 'py-3 h-32' : 'h-12'}`}>
      <TextInput
        placeholderTextColor="rgba(255,255,255,0.4)"
        className={`text-white text-[15px] font-medium ${isMultiline ? 'flex-1' : ''}`}
        multiline={isMultiline}
        textAlignVertical={isMultiline ? 'top' : 'auto'}
        {...props} // Isto passa magicamente o placeholder, value, onChangeText, etc!
      />
    </View>
  );
}