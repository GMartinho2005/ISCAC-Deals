import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AuthService } from '../src/services/auth';
import { getCursos } from '../src/services/database';

type Curso = { id: number; nome: string };

export default function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: '',
    email: '',
    id_curso: null as number | null,
    ano: '',
    password: ''
  });

  const [cursos, setCursos] = useState<Curso[]>([]);
  
  // ESTADOS DOS MODAIS
  const [showCursoModal, setShowCursoModal] = useState(false);
  const [showAnoModal, setShowAnoModal] = useState(false);

  // ESTADO DO ALERTA CUSTOMIZADO
  const [alertState, setAlertState] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'warning' as 'success' | 'error' | 'warning',
    onConfirm: null as (() => void) | null
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'warning', onConfirm: (() => void) | null = null) => {
    setAlertState({ visible: true, title, message, type, onConfirm });
  };

  const closeAlert = () => {
    const onConfirm = alertState.onConfirm;
    setAlertState(prev => ({ ...prev, visible: false, onConfirm: null }));
    if (onConfirm) onConfirm();
  };

  useEffect(() => {
    const loadCursos = async () => {
      try {
        const res = await getCursos();
        setCursos(res);
      } catch (error) {
        console.error("Erro ao carregar cursos:", error);
      }
    };
    loadCursos();
  }, []);

  const handleRegister = async () => {
    if (!form.nome || !form.email || !form.password || !form.id_curso || !form.ano) {
      showAlert("Aviso", "Preenche os campos obrigatórios (Nome, Email, Curso, Ano e Password).", "warning");
      return;
    }

    const emailLimpo = form.email.trim().toLowerCase();
    if (!emailLimpo.endsWith('@alumni.iscac.pt')) {
      showAlert("Acesso Restrito", "Apenas são permitidos emails institucionais do ISCAC (@alumni.iscac.pt).", "warning");
      return;
    }

    const result = await AuthService.register(
      form.nome,
      emailLimpo,
      form.id_curso,
      parseInt(form.ano) || 1,
      form.password
    );

    if (result.success) {
      showAlert("Sucesso!", "A tua conta foi criada. Já podes entrar.", "success", () => {
        router.replace('/login');
      });
    } else {
      let errorMessage = result.error || "Tenta novamente.";
      
      // A MAGIA ESTÁ AQUI: Traduzir o erro da base de dados para linguagem humana
      if (errorMessage.includes("duplicate key value") || errorMessage.includes("core_utilizador_email_key") || errorMessage.includes("User already registered")) {
        errorMessage = "Este email já se encontra registado. Por favor, volta atrás e faz login com a tua conta.";
      }

      showAlert("Erro no Registo", errorMessage, "error");
    }
  };

  const cursoSelecionado = cursos.find(c => c.id === form.id_curso)?.nome;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[rgb(58,79,92)]"
    >
      <ScrollView className="px-8" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} className="mt-14 mb-6 w-10 h-10 justify-center">
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>

        <View className="items-center mb-8">
          <Text className="text-white text-3xl font-bold">Criar Conta</Text>
          <Text className="text-[rgb(215,220,228)] mt-2">Junta-te à rede de alunos do ISCAC.</Text>
        </View>

        <View className="gap-y-4">
          <View className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 justify-center">
            <TextInput
              placeholder="Nome Completo"
              placeholderTextColor="rgba(255,255,255,0.4)"
              className="text-white font-medium"
              onChangeText={(t) => setForm({...form, nome: t})}
            />
          </View>

          <View className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 justify-center">
            <TextInput
              placeholder="Email Institucional (@alumni.iscac.pt)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              className="text-white font-medium"
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={(t) => setForm({...form, email: t})}
            />
          </View>

          {/* BOTÃO SELEÇÃO CURSO */}
          <Pressable 
            onPress={() => setShowCursoModal(true)}
            className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 flex-row items-center justify-between"
          >
            <Text className={`font-medium ${cursoSelecionado ? 'text-white' : 'text-[rgba(255,255,255,0.4)]'}`} numberOfLines={1}>
              {cursoSelecionado || "Seleciona o teu Curso"}
            </Text>
            <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.4)" />
          </Pressable>

          {/* BOTÃO SELEÇÃO ANO */}
          <Pressable 
            onPress={() => setShowAnoModal(true)}
            className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 flex-row items-center justify-between"
          >
            <Text className={`font-medium ${form.ano ? 'text-white' : 'text-[rgba(255,255,255,0.4)]'}`}>
              {form.ano ? `${form.ano}º Ano` : "Ano de Curso"}
            </Text>
            <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.4)" />
          </Pressable>

          <View className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 justify-center mt-2">
            <TextInput
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.4)"
              secureTextEntry
              className="text-white font-medium"
              onChangeText={(t) => setForm({...form, password: t})}
            />
          </View>
        </View>

        <TouchableOpacity 
          onPress={handleRegister}
          activeOpacity={0.8}
          className="bg-black h-16 rounded-2xl justify-center items-center mt-8 mb-10 shadow-lg"
        >
          <Text className="text-white font-bold text-lg">REGISTAR AGORA</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL: SELEÇÃO DE CURSO */}
      {/* ======================================================== */}
      <Modal visible={showCursoModal} transparent animationType="slide" onRequestClose={() => setShowCursoModal(false)}>
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setShowCursoModal(false)}>
          <Pressable className="bg-[rgb(48,66,77)] rounded-t-3xl p-6 pb-10 max-h-[60%] border-t border-white/10" onPress={(e) => e.stopPropagation()}>
            <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6 -mt-2" />
            
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-white">Seleciona o Curso</Text>
              <Pressable onPress={() => setShowCursoModal(false)} className="bg-white/10 p-2 rounded-full">
                <Ionicons name="close" size={20} color="white" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {cursos.length === 0 ? (
                <Text className="text-gray-400 text-center py-4">A carregar cursos...</Text>
              ) : (
                cursos.map((c) => {
                  const isSelected = form.id_curso === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => {
                        setForm({ ...form, id_curso: c.id });
                        setShowCursoModal(false);
                      }}
                      className={`py-4 border-b border-white/5 flex-row justify-between items-center ${isSelected ? 'bg-white/5 px-3 rounded-xl border-b-0' : ''}`}
                    >
                      <Text className={`text-[16px] ${isSelected ? 'font-bold text-[rgb(223,19,36)]' : 'text-gray-300'}`}>
                        {c.nome}
                      </Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={22} color="rgb(223,19,36)" />}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: SELEÇÃO DE ANO */}
      {/* ======================================================== */}
      <Modal visible={showAnoModal} transparent animationType="slide" onRequestClose={() => setShowAnoModal(false)}>
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setShowAnoModal(false)}>
          <Pressable className="bg-[rgb(48,66,77)] rounded-t-3xl p-6 pb-10 border-t border-white/10" onPress={(e) => e.stopPropagation()}>
            <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6 -mt-2" />
            
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-white">Ano de Curso</Text>
              <Pressable onPress={() => setShowAnoModal(false)} className="bg-white/10 p-2 rounded-full">
                <Ionicons name="close" size={20} color="white" />
              </Pressable>
            </View>

            <View>
              {['1', '2', '3'].map((ano) => {
                const isSelected = form.ano === ano;
                return (
                  <Pressable
                    key={ano}
                    onPress={() => {
                      setForm({ ...form, ano: ano });
                      setShowAnoModal(false);
                    }}
                    className={`py-4 border-b border-white/5 flex-row justify-between items-center ${isSelected ? 'bg-white/5 px-3 rounded-xl border-b-0' : ''}`}
                  >
                    <Text className={`text-[16px] ${isSelected ? 'font-bold text-[rgb(223,19,36)]' : 'text-gray-300'}`}>
                      {ano}º Ano
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color="rgb(223,19,36)" />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
            
            <TouchableOpacity 
              onPress={closeAlert}
              activeOpacity={0.8}
              className="bg-[rgb(223,19,36)] w-full h-[50px] rounded-xl justify-center items-center"
            >
              <Text className="text-white font-bold text-[16px]">Entendido</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}