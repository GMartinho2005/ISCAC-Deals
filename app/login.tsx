import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SuporteTicketList from '../components/SuporteTicketList';
import { AuthService } from '../src/services/auth';
import { BiometricService } from '../src/services/biometrics';
import { enviarTicketSuporte } from '../src/services/database';
import { supabase } from '../src/services/supabase';

export default function LoginScreen() {
  const router = useRouter();
  
  // Estados do Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Estados da Impressão Digital
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricPulse] = useState(new Animated.Value(1));

  // NOVO: Guarda o email APENAS se a password estiver certa mas a conta estiver Inativa/Restringida
  const [verifiedRestrictedEmail, setVerifiedRestrictedEmail] = useState<string | null>(null);

  // ─── ESTADOS PARA O MENU DE SUPORTE (GERAL) ───
  const [supportMenuVisible, setSupportMenuVisible] = useState(false);
  
  // Formulário Geral
  const [generalSupportModalVisible, setGeneralSupportModalVisible] = useState(false);
  const [supportEmailInput, setSupportEmailInput] = useState('');
  const [supportSubjectInput, setSupportSubjectInput] = useState('');
  const [supportMsgInput, setSupportMsgInput] = useState('');

  // Visualizador de Tickets Seguro
  const [ticketListModalVisible, setTicketListModalVisible] = useState(false);

  // Estados da Reposição de Password
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotName, setForgotName] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  // ESTADO DO ALERTA CUSTOMIZADO
  const [alertState, setAlertState] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'warning' as 'success' | 'error' | 'warning',
    confirmText: 'Entendido',
    showCloseIcon: false,
    onConfirm: null as (() => void) | null
  });

  const showAlert = (
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'warning' = 'warning', 
    onConfirm: (() => void) | null = null,
    confirmText = 'Entendido',
    showCloseIcon = false
  ) => {
    setAlertState({ visible: true, title, message, type, onConfirm, confirmText, showCloseIcon });
  };

  const closeAlert = () => {
    setAlertState(prev => ({ ...prev, visible: false, onConfirm: null }));
  };

  const handleConfirmAlert = () => {
    const onConfirm = alertState.onConfirm;
    setAlertState(prev => ({ ...prev, visible: false, onConfirm: null }));
    if (onConfirm) onConfirm();
  };

  // ─── VERIFICAR IMPRESSÃO DIGITAL AO ABRIR O ECRÃ ───
  useEffect(() => {
    const checkBiometric = async () => {
      const available = await BiometricService.isAvailable();
      const enabled = await BiometricService.isEnabled();
      setBiometricAvailable(available && enabled);

      // Se biometria está ativada, tentar login automático
      if (available && enabled) {
        // Animação de pulso no ícone
        Animated.loop(
          Animated.sequence([
            Animated.timing(biometricPulse, { toValue: 1.15, duration: 800, useNativeDriver: true }),
            Animated.timing(biometricPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
          ])
        ).start();

        handleBiometricLogin();
      }
    };
    checkBiometric();
  }, []);

  const handleBiometricLogin = async () => {
    try {
      const credentials = await BiometricService.getStoredCredentials();
      if (!credentials) return;

      const authenticated = await BiometricService.authenticate();
      if (!authenticated) return;

      const result = await AuthService.login(credentials.email, credentials.password);
      if (result.user) {
        router.replace('/home');
      } else if (result.error === "RESTRICTED") {
        showAlert("Conta Restringida", "A tua conta encontra-se inativa.", "error");
      } else {
        // Credenciais guardadas já não são válidas — desativar biometria
        await BiometricService.disable();
        setBiometricAvailable(false);
        showAlert("Sessão Expirada", "As tuas credenciais mudaram. Inicia sessão manualmente.", "warning");
      }
    } catch (error) {
      console.error("Erro biométrico:", error);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() && !password.trim()) {
      showAlert("Atenção", "Preenchimento obrigatório: Email e Password.", "warning");
      return;
    }
    if (!email.trim()) {
      showAlert("Atenção", "Preenchimento obrigatório: Email.", "warning");
      return;
    }
    if (!password.trim()) {
      showAlert("Atenção", "Preenchimento obrigatório: Password.", "warning");
      return;
    }

    try {
      const result = await AuthService.login(email.trim().toLowerCase(), password);
      
      if (result.user) {
        // Guardar credenciais se biometria estiver disponível e ativada
        const bioEnabled = await BiometricService.isEnabled();
        const bioAvailable = await BiometricService.isAvailable();
        if (bioEnabled && bioAvailable) {
          await BiometricService.enable(email.trim().toLowerCase(), password);
        }
        // Login com sucesso
        router.replace('/home');
      } else if (result.error === "RESTRICTED") {
        // Conta Inativa (mas identidade verificada): Permite ver tickets
        setVerifiedRestrictedEmail(email.trim().toLowerCase());
        showAlert(
          "Conta Restringida", 
          "A tua conta encontra-se inativa. Acede ao menu de 'Suporte' para contactares os administradores ou veres as tuas mensagens de suporte.", 
          "error",
          () => setSupportMenuVisible(true), // Ao clicar OK, abre logo o menu de suporte
          "Abrir Suporte",
          true
        );
      } else {
        // Erro genérico (pass errada, não existe, etc)
        showAlert("Erro de Acesso", result.error || "Email ou password incorretos. Tenta novamente.", "error");
      }
    } catch (error) {
      console.error("Erro técnico no Login:", error);
      showAlert("Erro", "Não foi possível ligar à base de dados.", "error");
    }
  };

  // ─── FUNÇÕES DO NOVO MENU DE SUPORTE ───
  const openGeneralSupport = () => {
    setSupportMenuVisible(false);
    setSupportEmailInput(verifiedRestrictedEmail || email); // Aproveita o email
    setSupportSubjectInput(verifiedRestrictedEmail ? 'Reclamação: Conta Restringida' : '');
    setSupportMsgInput('');
    setGeneralSupportModalVisible(true);
  };

  const handleSendGeneralSupport = async () => {
    if (!supportEmailInput.trim() || !supportSubjectInput.trim() || !supportMsgInput.trim()) {
      return showAlert("Aviso", "Por favor, preenche todos os campos.", "warning");
    }
    const success = await enviarTicketSuporte(supportEmailInput.trim().toLowerCase(), supportSubjectInput.trim(), supportMsgInput.trim());
    if (success) {
      setGeneralSupportModalVisible(false);
      if (verifiedRestrictedEmail && supportEmailInput.trim().toLowerCase() === verifiedRestrictedEmail) {
        showAlert("Mensagem Enviada", "O teu pedido foi enviado. Podes acompanhar a resposta no menu 'Ver Meus Pedidos'.", "success");
      } else {
        showAlert("Mensagem Enviada", "O teu pedido foi enviado com sucesso. A nossa equipa irá analisar e responder.", "success");
      }
    } else {
      showAlert("Erro", "Não foi possível enviar a tua mensagem neste momento.", "error");
    }
  };

  const openTicketListViewer = () => {
    setSupportMenuVisible(false);
    setTicketListModalVisible(true);
  };

  const handleResetPassword = async () => {
    if (!forgotName.trim() || !forgotEmail.trim() || !forgotNewPassword || !forgotConfirmPassword) {
      showAlert("Atenção", "Por favor, preenche todos os campos.", "warning");
      return;
    }
    const emailLimpo = forgotEmail.trim().toLowerCase();
    if (!emailLimpo.endsWith('@alumni.iscac.pt')) {
      showAlert("Erro", "O email deve ser o teu endereço institucional.", "error");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      showAlert("Erro", "As novas palavras-passe não coincidem.", "error");
      return;
    }
    try {
      const { data, error } = await supabase
        .from('core_utilizador')
        .select('id')
        .eq('email', emailLimpo)
        .eq('nome', forgotName.trim())
        .single();

      if (error || !data) {
        showAlert("Conta não encontrada", "Os dados não correspondem a nenhuma conta.", "error");
        return;
      }
      await supabase
        .from('core_utilizador')
        .update({ password: forgotNewPassword })
        .eq('id', data.id);

      showAlert("Sucesso!", "A tua palavra-passe foi alterada. Já podes iniciar sessão.", "success", () => {
        handleCloseForgotModal();
      });
    } catch {
      showAlert("Erro", "Ocorreu um erro ao tentar repor a palavra-passe.", "error");
    }
  };

  const handleCloseForgotModal = () => {
    setForgotModalVisible(false);
    setForgotName('');
    setForgotEmail('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setShowForgotNewPassword(false);
    setShowForgotConfirmPassword(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[rgb(58,79,92)]"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-8 pt-16 pb-6" showsVerticalScrollIndicator={false}>

        {/* Botão Voltar */}
        <View className="flex-row items-center mb-10">
          <TouchableOpacity
            className="p-2 -ml-2"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            }}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
        </View>

        {/* Logo + Título */}
        <View className="items-center mb-10">
          <Image
            source={require('@/assets/images/logo.png')}
            className="w-48 h-24"
            contentFit="contain"
          />
          <Text className="text-white text-3xl font-bold mt-4 tracking-tight">
            Bem-vindo!
          </Text>
          <Text className="text-[rgb(215,220,228)] text-center mt-2 text-sm leading-5 px-4">
            Inicia sessão para aceder às melhores ofertas do ISCAC.
          </Text>
        </View>

        {/* Campos de Login */}
        <View className="gap-y-4">
          <View className="bg-white/10 border border-white/10 rounded-2xl px-4 h-[56px] flex-row items-center">
            <Ionicons name="mail-outline" size={20} color="rgba(255,255,255,0.45)" />
            <TextInput
              placeholder="Email @alumni.iscac.pt"
              placeholderTextColor="rgba(255,255,255,0.35)"
              className="flex-1 ml-3 text-white font-medium text-[15px]"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          <View>
            <View className="bg-white/10 border border-white/10 rounded-2xl px-4 h-[56px] flex-row items-center">
              <Ionicons name="lock-closed-outline" size={20} color="rgba(255,255,255,0.45)" />
              <TextInput
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.35)"
                secureTextEntry={!showPassword}
                className="flex-1 ml-3 text-white font-medium text-[15px]"
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-1">
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="rgba(255,255,255,0.45)"
                />
              </TouchableOpacity>
            </View>

            {/* Link Esqueceste a Password */}
            <TouchableOpacity onPress={() => setForgotModalVisible(true)} className="self-end mt-3 pr-1 active:opacity-60">
              <Text className="text-[rgba(215,220,228,0.8)] font-semibold text-[13px]">
                Esqueceste-te da password?
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Botão Entrar */}
        <View className="flex-row items-center mt-8 gap-x-3">
          <TouchableOpacity
            onPress={handleLogin}
            activeOpacity={0.85}
            className={`bg-[rgb(223,19,36)] h-[54px] rounded-[14px] justify-center items-center flex-row gap-x-2 shadow-lg ${biometricAvailable ? 'flex-1' : 'flex-1'}`}
          >
            <Ionicons name="key-outline" size={20} color="white" />
            <Text className="text-white font-bold text-base tracking-widest ml-1">ENTRAR</Text>
          </TouchableOpacity>

          {biometricAvailable && (
            <Animated.View style={{ transform: [{ scale: biometricPulse }] }}>
              <TouchableOpacity
                onPress={handleBiometricLogin}
                activeOpacity={0.7}
                className="bg-white/10 border border-white/20 h-[54px] w-[54px] rounded-[14px] justify-center items-center"
              >
                <Ionicons name="finger-print" size={28} color="white" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        {/* Link Registo */}
        <TouchableOpacity onPress={() => router.push('/register')} className="mt-8 items-center">
          <Text className="text-[rgba(160,168,180,0.9)] font-medium text-sm">
            Ainda não tens conta?{' '}
            <Text className="text-[rgb(215,220,228)] font-bold">Regista-te aqui.</Text>
          </Text>
        </TouchableOpacity>

        {/* ─── NOVO BOTÃO DE SUPORTE ─── */}
        <TouchableOpacity onPress={() => setSupportMenuVisible(true)} className="mt-8 items-center flex-row justify-center active:opacity-60 pb-10">
          <View className="bg-white/10 p-1.5 rounded-full mr-2">
            <Ionicons name="help-circle-outline" size={18} color="rgba(215,220,228,0.9)" />
          </View>
          <Text className="text-[rgba(215,220,228,0.9)] font-bold text-sm underline">
            Suporte
          </Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ======================================================== */}
      {/* NOVO MODAL: MENU DE SUPORTE (OPÇÕES) */}
      {/* ======================================================== */}
      <Modal animationType="slide" transparent visible={supportMenuVisible} onRequestClose={() => setSupportMenuVisible(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-[rgb(45,65,77)] rounded-t-3xl p-6 border-t border-white/10 pb-10">
            <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6 -mt-2" />
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold">Menu de Suporte</Text>
              <Pressable onPress={() => setSupportMenuVisible(false)} className="p-1 bg-white/10 rounded-full">
                <Ionicons name="close" size={20} color="white" />
              </Pressable>
            </View>

            <TouchableOpacity onPress={openGeneralSupport} className="flex-row items-center bg-white/5 border border-white/10 p-4 rounded-2xl mb-4 active:bg-white/10">
              <View className="w-10 h-10 bg-[rgb(223,19,36)]/20 rounded-full items-center justify-center mr-4 border border-[rgb(223,19,36)]/30">
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="rgb(223,19,36)" />
              </View>
              <View>
                <Text className="text-white text-[16px] font-bold">Contactar Suporte</Text>
                <Text className="text-gray-400 text-[12px] mt-0.5">Criar um novo pedido de suporte.</Text>
              </View>
            </TouchableOpacity>

            {/* SÓ MOSTRA ESTA OPÇÃO SE O UTILIZADOR TENTOU ENTRAR E ESTAVA INATIVO */}
            {verifiedRestrictedEmail && (
              <TouchableOpacity onPress={openTicketListViewer} className="flex-row items-center bg-white/5 border border-white/10 p-4 rounded-2xl active:bg-white/10">
                <View className="w-10 h-10 bg-[#fbbf24]/20 rounded-full items-center justify-center mr-4 border border-[#fbbf24]/30">
                  <Ionicons name="list-outline" size={20} color="#fbbf24" />
                </View>
                <View>
                  <Text className="text-white text-[16px] font-bold">Ver Meus Pedidos</Text>
                  <Text className="text-gray-400 text-[12px] mt-0.5">Acompanhar chats em aberto.</Text>
                </View>
              </TouchableOpacity>
            )}

          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* NOVO MODAL: CRIAR PEDIDO GERAL */}
      {/* ======================================================== */}
      <Modal animationType="slide" transparent visible={generalSupportModalVisible} onRequestClose={() => setGeneralSupportModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-[rgb(45,65,77)] rounded-t-3xl p-6 border-t border-white/10">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold">Novo Pedido</Text>
              <Pressable onPress={() => setGeneralSupportModalVisible(false)} className="p-1">
                <Ionicons name="close" size={24} color="white" />
              </Pressable>
            </View>

            <View className="gap-y-4 mb-6">
              <View className="bg-white/5 border border-white/10 rounded-xl px-4 h-[50px] flex-row items-center">
                <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.4)" />
                <TextInput
                  placeholder="O teu Email"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  className="flex-1 ml-3 text-white text-[14px]"
                  value={supportEmailInput}
                  onChangeText={setSupportEmailInput}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View className="bg-white/5 border border-white/10 rounded-xl px-4 h-[50px] flex-row items-center">
                <Ionicons name="pricetag-outline" size={18} color="rgba(255,255,255,0.4)" />
                <TextInput
                  placeholder="Assunto"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  className="flex-1 ml-3 text-white text-[14px]"
                  value={supportSubjectInput}
                  onChangeText={setSupportSubjectInput}
                />
              </View>

              <TextInput
                multiline
                numberOfLines={5}
                placeholder="Explica a tua situação detalhadamente..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                className="bg-white/5 border border-white/10 rounded-xl p-4 text-white text-[15px] h-32"
                textAlignVertical="top"
                value={supportMsgInput}
                onChangeText={setSupportMsgInput}
              />
            </View>

            <TouchableOpacity onPress={handleSendGeneralSupport} className="bg-[rgb(223,19,36)] h-[54px] rounded-xl justify-center items-center mb-4">
              <Text className="text-white font-bold">ENVIAR MENSAGEM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* NOVO MODAL: VISUALIZADOR DE TICKETS (LISTA PRIVADA) */}
      {/* ======================================================== */}
      <Modal animationType="slide" transparent visible={ticketListModalVisible} onRequestClose={() => setTicketListModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-[rgb(45,65,77)] rounded-t-3xl p-6 border-t border-white/10 h-[85%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-xl font-bold">Meus Pedidos de Suporte</Text>
              <Pressable onPress={() => setTicketListModalVisible(false)} className="p-1">
                <Ionicons name="close" size={24} color="white" />
              </Pressable>
            </View>

            <Text className="text-gray-400 text-sm mb-4 text-center">
              A visualizar o histórico seguro para:{"\n"}
              <Text className="text-white font-bold">{verifiedRestrictedEmail}</Text>
            </Text>

            {/* Lista renderizada de forma segura, o utilizador não pode alterar o email */}
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {verifiedRestrictedEmail && (
                <SuporteTicketList email={verifiedRestrictedEmail} />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: REPOR PASSWORD */}
      {/* ======================================================== */}
      <Modal animationType="fade" transparent visible={forgotModalVisible} onRequestClose={handleCloseForgotModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className="flex-1 justify-center items-center bg-black/80 px-5">
            <View className="bg-[rgb(45,65,77)] w-full rounded-3xl p-6 border border-white/10 shadow-2xl">
              
              <View className="flex-row justify-between items-center mb-6">
                <View className="flex-row items-center">
                  <View className="bg-white/10 p-2 rounded-full mr-3">
                    <Ionicons name="key-outline" size={22} color="white" />
                  </View>
                  <Text className="text-white text-xl font-bold">Repor Password</Text>
                </View>
                <Pressable onPress={handleCloseForgotModal} className="p-1 active:opacity-50">
                  <Ionicons name="close" size={24} color="rgba(255,255,255,0.5)" />
                </Pressable>
              </View>

              <Text className="text-gray-300 text-[14px] leading-5 mb-6">
                Para garantirmos que a conta é tua, introduz o teu Nome e Email institucional exatamente como usaste no registo.
              </Text>

              <View className="gap-y-4">
                <View className="bg-white/5 border border-white/10 rounded-xl px-4 h-[50px] flex-row items-center">
                  <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.4)" />
                  <TextInput
                    placeholder="Nome"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    className="flex-1 ml-3 text-white text-[14px]"
                    value={forgotName}
                    onChangeText={setForgotName}
                  />
                </View>

                <View className="bg-white/5 border border-white/10 rounded-xl px-4 h-[50px] flex-row items-center">
                  <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.4)" />
                  <TextInput
                    placeholder="Email Institucional"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    className="flex-1 ml-3 text-white text-[14px]"
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View className="bg-white/5 border border-white/10 rounded-xl px-4 h-[50px] flex-row items-center">
                  <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.4)" />
                  <TextInput
                    placeholder="Nova Password"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    secureTextEntry={!showForgotNewPassword}
                    className="flex-1 ml-3 text-white text-[14px]"
                    value={forgotNewPassword}
                    onChangeText={setForgotNewPassword}
                  />
                  <TouchableOpacity onPress={() => setShowForgotNewPassword(!showForgotNewPassword)} className="p-1">
                    <Ionicons name={showForgotNewPassword ? "eye-outline" : "eye-off-outline"} size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                </View>

                <View className="bg-white/5 border border-white/10 rounded-xl px-4 h-[50px] flex-row items-center">
                  <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.4)" />
                  <TextInput
                    placeholder="Repetir Nova Password"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    secureTextEntry={!showForgotConfirmPassword}
                    className="flex-1 ml-3 text-white text-[14px]"
                    value={forgotConfirmPassword}
                    onChangeText={setForgotConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)} className="p-1">
                    <Ionicons name={showForgotConfirmPassword ? "eye-outline" : "eye-off-outline"} size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleResetPassword}
                activeOpacity={0.8}
                className="bg-[rgb(223,19,36)] h-[50px] rounded-xl justify-center items-center mt-6"
              >
                <Text className="text-white font-bold text-[15px]">Atualizar Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: ALERTA CUSTOMIZADO */}
      {/* ======================================================== */}
      <Modal animationType="fade" transparent visible={alertState.visible} onRequestClose={closeAlert}>
        <View className="flex-1 justify-center items-center bg-black/70 px-6">
          <View className="bg-[rgb(48,66,77)] w-full rounded-3xl p-6 items-center shadow-2xl border border-white/10 relative">
            
            {alertState.showCloseIcon && (
              <Pressable onPress={closeAlert} className="absolute top-4 right-4 p-2 z-10 active:opacity-50">
                <Ionicons name="close" size={24} color="rgba(255,255,255,0.5)" />
              </Pressable>
            )}

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
              <Text className="text-white font-bold text-[16px]">
                {alertState.confirmText}
              </Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}