import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  DeviceEventEmitter,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthService } from '../src/services/auth';
import {
  apagarMensagem,
  editarMensagem,
  enviarMensagem,
  getMensagens,
  marcarComoLidas,
  MensagemRow,
  uploadImagemChat,
} from '../src/services/database';
import { supabase } from '../src/services/supabase';

const IMG_PREFIX = 'IMG::';

export default function ConversaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const conversaId = params.conversaId as string;
  const nomeOutro = params.nomeOutro as string;
  const tituloAnuncio = params.tituloAnuncio as string;
  
  const [fotoPerfilReal, setFotoPerfilReal] = useState<string | null>(
    (params.fotoOutro && params.fotoOutro !== 'null') ? (params.fotoOutro as string) : null
  );

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<MensagemRow[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [uploadingImagem, setUploadingImagem] = useState(false);
  
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const [mensagemEditando, setMensagemEditando] = useState<MensagemRow | null>(null);
  const [imagemFullScreen, setImagemFullScreen] = useState<string | null>(null);
  const [menuOpcoes, setMenuOpcoes] = useState<MensagemRow | null>(null);
  
  const flatListRef = useRef<FlatList>(null);

  // Intercetar o botão físico de voltar no Android para obrigar a ida para o Chat
  useEffect(() => {
    const onBackPress = () => {
      router.replace('/chat');
      return true; // Retornar true evita o comportamento padrão (fechar a app ou voltar ao ecrã anterior)
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => backHandler.remove();
  }, [router]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      const user = await AuthService.getCurrentUser();
      if (!user) return;
      setCurrentUserId(user.id);
      
      await marcarComoLidas(conversaId, user.id); 
      DeviceEventEmitter.emit('updateBadges');

      const msgs = await getMensagens(conversaId);
      const visiveis = msgs.filter((m) => m.ativo === 1 || m.id_remetente === user.id);
      setMensagens(visiveis);

      if (!fotoPerfilReal) {
        const { data: conv } = await supabase
          .from('core_conversa')
          .select('id_comprador, id_vendedor')
          .eq('id', conversaId)
          .single();

        if (conv) {
          const idOutro = conv.id_comprador === user.id ? conv.id_vendedor : conv.id_comprador;
          
          const { data: u } = await supabase
            .from('core_utilizador')
            .select('foto_perfil')
            .eq('id', idOutro)
            .single();

          if (u?.foto_perfil) {
            setFotoPerfilReal(u.foto_perfil);
          }
        }
      }
    };
    init();
  }, [conversaId, fotoPerfilReal]);

  useEffect(() => {
    if (!currentUserId) return;

    const uniqueId = Date.now().toString();
    const channelName = `chat-room-${conversaId}-${uniqueId}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'core_mensagem', filter: `id_conversa=eq.${conversaId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const nova = payload.new as MensagemRow;
            if (nova.ativo === 1) {
              setMensagens((prev) => {
                if (prev.find((m) => m.id === nova.id)) return prev;
                return [...prev, nova];
              });
              if (nova.id_remetente !== currentUserId) {
                marcarComoLidas(conversaId, currentUserId);
                DeviceEventEmitter.emit('updateBadges');
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const atualizada = payload.new as MensagemRow;
            if (atualizada.ativo === 0 && atualizada.id_remetente !== currentUserId) {
              setMensagens((prev) => prev.filter((m) => m.id !== atualizada.id));
            } else {
              setMensagens((prev) => prev.map((m) => (m.id === atualizada.id ? atualizada : m)));
            }
          }
        }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [conversaId, currentUserId]);

  useEffect(() => {
    if (mensagens.length > 0 && !mensagemEditando) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [mensagens.length, mensagemEditando]);

  const handleEnviar = async () => {
    if (!texto.trim() || !currentUserId || enviando) return;
    const textoEnviar = texto.trim();
    setEnviando(true);

    if (mensagemEditando) {
      const idMsg = mensagemEditando.id;
      setMensagens((prev) => prev.map((m) => m.id === idMsg ? { ...m, texto: textoEnviar } : m));
      setTexto('');
      setMensagemEditando(null);
      await editarMensagem(idMsg, textoEnviar);
    } else {
      setTexto('');
      const msgTemp: MensagemRow = {
        id: `temp-${Date.now()}`, id_conversa: conversaId, id_remetente: currentUserId,
        texto: textoEnviar, lida: false, data_envio: new Date().toISOString(), ativo: 1
      };
      setMensagens((prev) => [...prev, msgTemp]);

      const resultado = await enviarMensagem(conversaId, currentUserId, textoEnviar);
      if (resultado) setMensagens((prev) => prev.map((m) => (m.id === msgTemp.id ? resultado : m)));
      else setMensagens((prev) => prev.filter((m) => m.id !== msgTemp.id));
      
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
    setEnviando(false);
  };

  const handleEnviarImagem = async (uri: string) => {
    if (!currentUserId) return;
    setUploadingImagem(true);

    const tempId = `temp-img-${Date.now()}`;
    const msgTemp: MensagemRow = {
      id: tempId, id_conversa: conversaId, id_remetente: currentUserId,
      texto: `${IMG_PREFIX}loading`, lida: false, data_envio: new Date().toISOString(), ativo: 1
    };
    setMensagens((prev) => [...prev, msgTemp]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    const publicUrl = await uploadImagemChat(uri);
    if (publicUrl) {
      const resultado = await enviarMensagem(conversaId, currentUserId, `${IMG_PREFIX}${publicUrl}`);
      if (resultado) setMensagens((prev) => prev.map((m) => (m.id === tempId ? resultado : m)));
      else setMensagens((prev) => prev.filter((m) => m.id !== tempId));
    } else {
      setMensagens((prev) => prev.filter((m) => m.id !== tempId));
    }
    setUploadingImagem(false);
  };

  const handleCamera = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) await handleEnviarImagem(result.assets[0].uri);
  };

  const handleAnexar = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false, 
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) await handleEnviarImagem(result.assets[0].uri);
  };

  const handleApagarMensagem = async () => {
    if (!menuOpcoes) return;
    const id = menuOpcoes.id;
    setMenuOpcoes(null);
    setMensagens((prev) => prev.map((m) => m.id === id ? { ...m, ativo: 0 } : m)); 
    await apagarMensagem(id);
  };

  const handleEditarMensagem = () => {
    if (!menuOpcoes) return;
    setMensagemEditando(menuOpcoes);
    setTexto(menuOpcoes.texto);
    setMenuOpcoes(null);
  };

  const formatHora = (dateStr: string) => new Date(dateStr).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  const renderAvatarOutro = () => {
    if (fotoPerfilReal && fotoPerfilReal !== '') {
      return <Image source={{ uri: fotoPerfilReal }} className="w-full h-full" resizeMode="cover" />;
    }
    const iniciais = nomeOutro?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';
    return <Text className="text-white font-bold text-[14px]">{iniciais}</Text>;
  };

  const renderConteudoMensagem = (item: MensagemRow, isMinhas: boolean) => {
    if (item.ativo === 0) {
      return (
        <>
          <View className="flex-row items-center mb-0.5">
            <Ionicons name="ban" size={14} color="rgba(255,255,255,0.4)" />
            <Text className="text-white/40 text-[14px] italic ml-1.5 pr-8">Mensagem eliminada</Text>
          </View>
          <View className="flex-row items-center justify-end -mt-1.5">
            <Text className="text-white/40 text-[10px]">{formatHora(item.data_envio)}</Text>
          </View>
        </>
      );
    }

    if (item.texto.startsWith(IMG_PREFIX)) {
      const url = item.texto.replace(IMG_PREFIX, '');
      if (url === 'loading') {
        return (
          <View style={{ width: 200, height: 150, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="white" size="small" />
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 6 }}>A enviar...</Text>
          </View>
        );
      }
      return (
        <Pressable 
          onPress={() => setImagemFullScreen(url)}
          onLongPress={() => { if(isMinhas) setMenuOpcoes(item) }}
        >
          <Image source={{ uri: url }} style={{ width: 200, height: 200, borderRadius: 12 }} resizeMode="cover" />
        </Pressable>
      );
    }

    return (
      <>
        <Text className="text-white text-[15px] leading-5 pr-8">{item.texto}</Text>
        <View className="flex-row items-center justify-end -mt-1.5">
          <Text className="text-white/60 text-[10px]">{formatHora(item.data_envio)}</Text>
          {isMinhas && (
            <Ionicons name={item.lida ? 'checkmark-done' : 'checkmark'} size={14} color={item.lida ? '#60a5fa' : 'rgba(255,255,255,0.6)'} style={{ marginLeft: 2 }} />
          )}
        </View>
      </>
    );
  };

  const renderMensagem = ({ item, index }: { item: MensagemRow; index: number }) => {
    const isMinhas = item.id_remetente === currentUserId;
    const anterior = index > 0 ? mensagens[index - 1] : null;
    const mesmoDia = anterior ? new Date(anterior.data_envio).toDateString() === new Date(item.data_envio).toDateString() : false;
    
    const isImagem = item.ativo === 1 && item.texto.startsWith(IMG_PREFIX);

    return (
      <>
        {!mesmoDia && (
          <View className="items-center my-4">
            <View className="bg-white/10 px-3 py-1 rounded-full shadow-sm">
              <Text className="text-gray-300 text-[11px] font-bold uppercase tracking-wider">
                {new Date(item.data_envio).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
            </View>
          </View>
        )}
        <View className={`flex-row mb-1.5 px-3 ${isMinhas ? 'justify-end' : 'justify-start'}`}>
          <Pressable
            onLongPress={() => { if(isMinhas && item.ativo === 1) setMenuOpcoes(item); }}
            className={`rounded-2xl shadow-sm overflow-hidden ${isMinhas ? 'bg-[rgb(223,19,36)] rounded-tr-sm' : 'bg-[rgb(48,66,77)] rounded-tl-sm'}`}
            style={{ maxWidth: '80%', padding: isImagem ? 4 : undefined }}
          >
            <View style={isImagem ? undefined : { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}>
              {renderConteudoMensagem(item, isMinhas)}
            </View>

            {isImagem && item.texto !== `${IMG_PREFIX}loading` && (
              <View className="flex-row items-center justify-end px-2 pb-1">
                <Text className="text-white/60 text-[10px]">{formatHora(item.data_envio)}</Text>
                {isMinhas && <Ionicons name={item.lida ? 'checkmark-done' : 'checkmark'} size={14} color={item.lida ? '#60a5fa' : 'rgba(255,255,255,0.6)'} style={{ marginLeft: 2 }} />}
              </View>
            )}
          </Pressable>
        </View>
      </>
    );
  };

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 40) + 66 : 0}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgb(58,79,92)',
            marginBottom: Platform.OS === 'android' ? keyboardHeight : 0,
          }}
        >
          <View className="flex-row items-center bg-[rgb(48,66,77)] border-b border-white/5 px-2 pb-3 shadow-md z-20" style={{ paddingTop: Math.max(insets.top, 40) + 10 }}>
            <Pressable onPress={() => router.replace('/chat')} className="flex-row items-center p-2 active:opacity-60">
              <Ionicons name="chevron-back" size={28} color="white" />
              <View className="w-10 h-10 rounded-full bg-white/10 border border-white/20 items-center justify-center ml-1 overflow-hidden shadow-sm">
                {renderAvatarOutro()}
              </View>
            </Pressable>
            <View className="flex-1 justify-center ml-2">
              <Text className="text-white font-bold text-[17px]" numberOfLines={1}>{nomeOutro}</Text>
              <Text className="text-gray-300 font-medium text-[12px] mt-0.5" numberOfLines={1}>{tituloAnuncio}</Text>
            </View>
          </View>

          <FlatList
            ref={flatListRef}
            data={mensagens}
            style={{ flex: 1 }}
            keyExtractor={(item) => item.id}
            renderItem={renderMensagem}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center mt-32 px-8">
                <View className="bg-white/5 p-6 rounded-full mb-4">
                  <Ionicons name="chatbox-ellipses" size={48} color="rgba(255,255,255,0.2)" />
                </View>
                <Text className="text-white text-[18px] font-bold mb-1">Inicia a conversa</Text>
                <Text className="text-gray-400 text-center text-[14px] leading-6">
                  Mostra o teu interesse ou tira dúvidas sobre o anúncio com {nomeOutro?.split(' ')[0]}.
                </Text>
              </View>
            }
          />

          <View style={{ backgroundColor: 'rgb(58,79,92)' }}>
            
            {mensagemEditando && (
              <View className="flex-row justify-between items-center bg-white/10 mx-3 mb-2 px-4 py-2 rounded-xl">
                <View className="flex-row items-center flex-1">
                  <Ionicons name="pencil" size={14} color="rgba(255,255,255,0.7)" />
                  <Text className="text-white/70 text-[13px] ml-2" numberOfLines={1}>A editar: {mensagemEditando.texto}</Text>
                </View>
                <Pressable onPress={() => { setMensagemEditando(null); setTexto(''); }} className="p-1">
                  <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>
            )}

            <View style={{ paddingHorizontal: 8, paddingBottom: Math.max(insets.bottom, 10), flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <View className="flex-1 bg-[rgb(48,66,77)] rounded-3xl flex-row items-end px-1 min-h-[48px] max-h-[120px] shadow-sm">
                <Pressable onPress={handleCamera} disabled={uploadingImagem || !!mensagemEditando} className="p-2.5 active:opacity-60 mb-0.5">
                  <Ionicons name="camera" size={24} color={(uploadingImagem || mensagemEditando) ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)'} />
                </Pressable>

                <TextInput
                  value={texto}
                  onChangeText={setTexto}
                  placeholder={mensagemEditando ? "Edita a tua mensagem..." : "Mensagem"}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  className="flex-1 text-white text-[16px] pt-3 pb-3 px-1 leading-5"
                  multiline
                />

                <Pressable onPress={handleAnexar} disabled={uploadingImagem || !!mensagemEditando} className="p-2.5 active:opacity-60 mb-0.5 mr-1">
                  {uploadingImagem ? <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" /> : <Ionicons name="attach" size={26} color={(uploadingImagem || mensagemEditando) ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)'} style={{ transform: [{ rotate: '-45deg' }] }} />}
                </Pressable>
              </View>

              <Pressable onPress={handleEnviar} disabled={!texto.trim() || enviando} className={`w-[48px] h-[48px] rounded-full items-center justify-center shadow-md mb-0.5 ${texto.trim() && !enviando ? 'bg-[rgb(223,19,36)]' : 'bg-[rgb(48,66,77)]'}`}>
                {mensagemEditando ? <Ionicons name="checkmark" size={24} color="white" /> : <Ionicons name="send" size={20} color={texto.trim() && !enviando ? 'white' : 'rgba(255,255,255,0.4)'} style={{ marginLeft: 4 }} />}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!imagemFullScreen} transparent={true} animationType="fade" onRequestClose={() => setImagemFullScreen(null)}>
        <View className="flex-1 bg-black/95 justify-center items-center">
          <Pressable onPress={() => setImagemFullScreen(null)} className="absolute top-12 right-6 z-50 bg-white/10 p-2 rounded-full active:bg-white/20">
            <Ionicons name="close" size={28} color="white" />
          </Pressable>
          {imagemFullScreen && <Image source={{ uri: imagemFullScreen }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
        </View>
      </Modal>

      <Modal visible={!!menuOpcoes} transparent={true} animationType="slide" onRequestClose={() => setMenuOpcoes(null)}>
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} 
          onPress={() => setMenuOpcoes(null)}
        >
          <Pressable 
            className="bg-[rgb(48,66,77)] rounded-t-3xl px-6 pt-3 pb-8" 
            onPress={(e) => e.stopPropagation()} 
            style={{ paddingBottom: Math.max(insets.bottom, 24) }}
          >
            <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6 mt-1" />

            {menuOpcoes && !menuOpcoes.texto.startsWith(IMG_PREFIX) && (
              <Pressable className="flex-row items-center py-4 border-b border-white/5 active:opacity-50" onPress={handleEditarMensagem}>
                <Ionicons name="pencil-outline" size={24} color="white" />
                <Text className="text-white text-[16px] font-medium ml-4">Editar Mensagem</Text>
              </Pressable>
            )}

            <Pressable className="flex-row items-center py-4 border-b border-white/5 active:opacity-50" onPress={handleApagarMensagem}>
              <Ionicons name="trash-outline" size={24} color="rgb(223,19,36)" />
              <Text className="text-[rgb(223,19,36)] text-[16px] font-bold ml-4">Anular Envio</Text>
            </Pressable>

            <Pressable className="flex-row items-center py-4 mt-2 active:opacity-50" onPress={() => setMenuOpcoes(null)}>
              <Ionicons name="close-circle-outline" size={24} color="rgba(255,255,255,0.5)" />
              <Text className="text-white/50 text-[16px] font-medium ml-4">Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}