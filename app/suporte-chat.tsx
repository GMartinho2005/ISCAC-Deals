import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MensagemSuporte, enviarMensagemSuporte, getMensagensTicket } from '../src/services/database';
import { supabase } from '../src/services/supabase';

export default function SuporteChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ticketId, assunto } = useLocalSearchParams<{ ticketId: string; assunto: string }>();
  
  const [mensagens, setMensagens] = useState<MensagemSuporte[]>([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const scrollRef = useRef<ScrollView>(null);

  // Lógica do teclado igual ao conversa.tsx
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadMensagens = useCallback(async () => {
    if (!ticketId) return;
    const data = await getMensagensTicket(Number(ticketId));
    setMensagens(data);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, [ticketId]);

  useEffect(() => {
    loadMensagens();

    const channel = supabase
      .channel(`suporte-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'core_suporte_mensagens', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          setMensagens((prev) => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as MensagemSuporte];
          });
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticketId, loadMensagens]);

  const handleEnviar = async () => {
    if (!texto.trim() || !ticketId) return;
    setLoading(true);

    const mensagemTexto = texto.trim();
    setTexto(''); // Limpa o input imediatamente
    
    // Agora enviamos 'aluno' como remetente
    const sucesso = await enviarMensagemSuporte(Number(ticketId), mensagemTexto, 'aluno');
    
    if (sucesso) {
      await loadMensagens();
    }
    setLoading(false);
  };

  const formatHora = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
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
        {/* Header - Adaptado com safe area insets igual ao conversa.tsx */}
        <View className="flex-row items-center bg-[rgb(48,66,77)] border-b border-white/5 px-2 pb-3 shadow-md z-20" style={{ paddingTop: Math.max(insets.top, 40) + 10 }}>
          <Pressable onPress={() => router.back()} className="flex-row items-center p-2 active:opacity-60">
            <Ionicons name="chevron-back" size={28} color="white" />
            <View className="w-10 h-10 rounded-full bg-white/10 items-center justify-center ml-1 border border-white/20 shadow-sm">
              <Ionicons name="help-circle" size={26} color="rgba(255,255,255,0.7)" />
            </View>
          </Pressable>
          <View className="flex-1 justify-center ml-2">
            <Text className="text-white font-bold text-[17px]" numberOfLines={1}>Suporte ISCAC Deals</Text>
            <Text className="text-gray-300 font-medium text-[12px] mt-0.5" numberOfLines={1}>{assunto}</Text>
          </View>
        </View>

        {/* Mensagens */}
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {mensagens.map((m) => {
            const isAluno = m.remetente === 'aluno'; 

            return (
              <View
                key={m.id || Math.random()}
                className={`mb-3 max-w-[80%] ${isAluno ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <View
                  className={`px-4 py-3 rounded-2xl shadow-sm ${
                    isAluno
                      ? 'bg-[rgb(223,19,36)] rounded-tr-sm'
                      : 'bg-white/10 border border-white/10 rounded-tl-sm'
                  }`}
                >
                  <Text className="text-white text-[15px] leading-5">{m.mensagem}</Text>
                </View>
                <Text className={`text-white/60 text-[10px] mt-1 px-1 ${isAluno ? 'text-right' : 'text-left'}`}>
                  {formatHora(m.data_envio)}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Input - Layout moderno idêntico ao conversa.tsx */}
        <View style={{ backgroundColor: 'rgb(58,79,92)' }}>
          <View style={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 12), paddingTop: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View className="flex-1 bg-[rgb(48,66,77)] rounded-3xl flex-row items-end px-3 min-h-[48px] max-h-[120px] shadow-sm">
              <TextInput
                value={texto}
                onChangeText={setTexto}
                placeholder="Mensagem"
                placeholderTextColor="rgba(255,255,255,0.4)"
                className="flex-1 text-white text-[16px] pt-3 pb-3 leading-5"
                multiline
              />
            </View>

            <Pressable
              onPress={handleEnviar}
              disabled={!texto.trim() || loading}
              className={`w-[48px] h-[48px] rounded-full items-center justify-center shadow-md mb-0.5 ${
                texto.trim() && !loading ? 'bg-[rgb(223,19,36)]' : 'bg-[rgb(48,66,77)]'
              }`}
            >
              <Ionicons name="send" size={20} color={texto.trim() && !loading ? 'white' : 'rgba(255,255,255,0.4)'} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}