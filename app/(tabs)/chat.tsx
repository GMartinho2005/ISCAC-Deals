import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AuthService } from '../../src/services/auth';
import { ConversaRow, getMinhasConversas } from '../../src/services/database';

export default function ChatScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [conversas, setConversas] = useState<ConversaRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todas');

  useFocusEffect(
    useCallback(() => {
      // Reset do ecrã ao entrar
      setSearchQuery('');
      setActiveFilter('Todas');
      scrollRef.current?.scrollTo({ y: 0, animated: false });

      const load = async () => {
        const user = await AuthService.getCurrentUser();
        if (!user) return;
        const lista = await getMinhasConversas(user.id);
        setConversas(lista);
      };
      load();
    }, [])
  );

  const filtered = conversas.filter((c) => {
    const matchSearch =
      c.nome_outro.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.titulo_anuncio.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFilter === 'Não lidas') return matchSearch && c.nao_lidas > 0;
    return matchSearch;
  });

  // CORREÇÃO DA DATA: Dias da semana por extenso e data exata após 7 dias
  const formatData = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    
    // Resetar as horas para a meia-noite para calcular apenas a diferença de dias
    const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dataMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffDias = Math.floor((hoje.getTime() - dataMsg.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDias === 0) return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    if (diffDias === 1) return 'Ontem';
    if (diffDias > 1 && diffDias < 7) {
      const diaSemana = date.toLocaleDateString('pt-PT', { weekday: 'long' });
      // Coloca a primeira letra maiúscula (ex: "Segunda-feira")
      return diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
    }
    
    // Mais de 1 semana (7 dias ou mais) mostra a data exata
    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const renderAvatar = (foto: string | null | undefined, nome: string) => {
    if (foto && foto !== 'null') {
      return (
        <Image source={{ uri: foto }} className="w-full h-full rounded-full" resizeMode="cover" />
      );
    }
    const iniciais = nome ? nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '??';
    return (
      <Text className="text-white font-bold text-[16px]">{iniciais}</Text>
    );
  };

  return (
    <View className="flex-1 bg-[rgb(58,79,92)]">

      {/* Cabeçalho */}
      <View className="pt-14 pb-3 px-4 items-center justify-center border-b border-white/10">
        <Text className="text-3xl font-extrabold text-white">Mensagens</Text>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} className="flex-1">

        {/* Barra de pesquisa */}
        <View className="px-5 mt-6 mb-5">
          <View className="flex-row items-center bg-white/10 rounded-2xl px-4 h-14 border border-white/20">
            <Ionicons name="search" size={22} color="rgba(255,255,255,0.4)" />
            <TextInput
              placeholder="Pesquisar"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 text-white text-[16px] font-medium ml-3"
            />
          </View>
        </View>

        {/* Filtros */}
        <View className="px-5 mb-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['Todas', 'Não lidas'].map((filter) => (
              <Pressable
                key={filter}
                onPress={() => setActiveFilter(filter)}
                className={`px-5 py-2 rounded-full mr-3 border ${
                  activeFilter === filter
                    ? 'bg-[rgb(223,19,36)] border-[rgb(223,19,36)]'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <Text className={`font-bold text-[14px] ${activeFilter === filter ? 'text-white' : 'text-gray-300'}`}>
                  {filter}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Lista ou estado vazio */}
        {filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center mt-20 px-4">
            <Ionicons name="chatbubbles-outline" size={75} color="rgba(255,255,255,0.2)" />
            <Text className="text-white text-[22px] font-bold mb-2 text-center mt-6">
              {activeFilter === 'Não lidas' ? 'Sem mensagens não lidas' : 'Caixa de entrada vazia'}
            </Text>
            <Text className="text-gray-400 text-center text-[14px] px-6 leading-6">
              {activeFilter === 'Não lidas'
                ? 'Todas as mensagens foram lidas.'
                : 'Quando enviares ou receberes uma mensagem, ela aparece aqui.'}
            </Text>
          </View>
        ) : (
          <View className="px-4 pb-10">
            {filtered.map((conversa) => (
              <Pressable
                key={conversa.id}
                onPress={() => router.push({
                  pathname: '/conversa',
                  params: {
                    conversaId: conversa.id,
                    nomeOutro: conversa.nome_outro,
                    tituloAnuncio: conversa.titulo_anuncio,
                    fotoOutro: conversa.foto_outro ?? '',
                  },
                })}
                className="flex-row items-center bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 active:bg-white/10"
              >
                {/* Avatar LIMPO (Sem o número) */}
                <View className="w-14 h-14 rounded-full bg-white/10 border border-white/20 items-center justify-center mr-4 overflow-hidden">
                  {renderAvatar(conversa.foto_outro, conversa.nome_outro)}
                </View>

                {/* Info (Nome, Título e Mensagem) */}
                <View className="flex-1 mr-2">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text
                      className={`text-[16px] flex-1 mr-2 ${conversa.nao_lidas > 0 ? 'font-extrabold text-white' : 'font-bold text-white'}`}
                      numberOfLines={1}
                    >
                      {conversa.nome_outro}
                    </Text>
                    
                    {/* Data e Ponto */}
                    <View className="items-end">
                      <Text className="text-gray-400 text-[12px] mb-1">
                        {conversa.data_atualizacao ? formatData(conversa.data_atualizacao) : ''}
                      </Text>
                      {conversa.nao_lidas > 0 && (
                        <View className="w-2.5 h-2.5 bg-[rgb(223,19,36)] rounded-full" />
                      )}
                    </View>
                  </View>

                  <Text className="text-gray-400 text-[12px] mb-1" numberOfLines={1}>
                    {conversa.titulo_anuncio}
                  </Text>

                  <Text
                    className={`text-[14px] ${conversa.nao_lidas > 0 ? 'text-white font-semibold' : 'text-gray-400'}`}
                    numberOfLines={1}
                  >
                    {conversa.ultima_mensagem}
                  </Text>
                </View>
                
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}