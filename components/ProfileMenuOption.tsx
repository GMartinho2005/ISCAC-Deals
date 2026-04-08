import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface MenuProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress?: () => void;
  isDanger?: boolean;
}

export default function ProfileMenuOption({ icon, title, onPress, isDanger = false }: MenuProps) {
  return (
    <Pressable 
      onPress={onPress}
      className={`flex-row items-center justify-between p-5 border-b border-white/10 ${isDanger ? 'active:bg-red-500/20' : 'active:bg-white/10'}`}
    >
      <View className="flex-row items-center">
        <View className={`${isDanger ? 'bg-red-500/20' : 'bg-white/10'} p-2 rounded-full`}>
          <Ionicons name={icon} size={20} color={isDanger ? 'rgb(223, 19, 36)' : 'white'} />
        </View>
        <Text className={`text-[16px] font-bold ml-4 ${isDanger ? 'text-[rgb(223,19,36)]' : 'text-white'}`}>
          {title}
        </Text>
      </View>
      {!isDanger && <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />}
    </Pressable>
  );
}