import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AuthService } from '../src/services/auth';
import { setupDatabase } from '../src/services/database';

export default function LoginScreen() {
  const router = useRouter();
  
  // Estados do Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Estados da Reposição de Password
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotName, setForgotName] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  
  // === CORREÇÃO: Estados separados para cada olho ===
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() && !password.trim()) {
      Alert.alert("Atenção", "Preenchimento obrigatório: Email e Password.");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Atenção", "Preenchimento obrigatório: Email.");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Atenção", "Preenchimento obrigatório: Password.");
      return;
    }

    try {
      const user = await AuthService.login(email.trim().toLowerCase(), password);
      if (user) {
        router.replace('/home');
      } else {
        Alert.alert("Erro de Acesso", "Email ou password incorretos. Tenta novamente.");
      }
    } catch (error) {
      console.error("Erro técnico no Login:", error);
      Alert.alert("Erro", "Não foi possível ligar à base de dados.");
    }
  };

  // Função para repor a password na BD SQLite
  const handleResetPassword = async () => {
    if (!forgotName.trim() || !forgotEmail.trim() || !forgotNewPassword || !forgotConfirmPassword) {
      Alert.alert("Atenção", "Por favor, preenche todos os campos para repor a tua palavra-passe.");
      return;
    }

    const emailLimpo = forgotEmail.trim().toLowerCase();

    if (!emailLimpo.endsWith('@alumni.iscac.pt')) {
      Alert.alert("Erro", "O email deve ser o teu endereço institucional (@alumni.iscac.pt).");
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      Alert.alert("Erro", "As novas palavras-passe não coincidem.");
      return;
    }

    try {
      const db = await setupDatabase();
      if (!db) throw new Error("DB não inicializada");

      // Procura se o utilizador existe combinando o Nome e o Email
      const user = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM core_utilizador WHERE email = ? AND nome = ?`,
        [emailLimpo, forgotName.trim()]
      );

      if (user) {
        // Atualiza a password
        await db.runAsync(
          `UPDATE core_utilizador SET password = ? WHERE id = ?`,
          [forgotNewPassword, user.id]
        );
        
        Alert.alert("Sucesso!", "A tua palavra-passe foi alterada com sucesso. Já podes iniciar sessão.");
        handleCloseForgotModal();
      } else {
        Alert.alert("Conta não encontrada", "Os dados introduzidos não correspondem a nenhuma conta registada. Verifica o Nome e Email.");
      }
    } catch (error) {
      console.error("Erro ao repor password:", error);
      Alert.alert("Erro", "Ocorreu um erro ao tentar repor a palavra-passe.");
    }
  };

  const handleCloseForgotModal = () => {
    setForgotModalVisible(false);
    setForgotName('');
    setForgotEmail('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    // Resetar os olhos quando fecha
    setShowForgotNewPassword(false);
    setShowForgotConfirmPassword(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[rgb(58,79,92)]"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-8 pt-16" showsVerticalScrollIndicator={false}>

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
        <TouchableOpacity
          onPress={handleLogin}
          activeOpacity={0.85}
          className="bg-[rgb(223,19,36)] h-[54px] rounded-[14px] justify-center items-center mt-8 flex-row gap-x-2 shadow-lg"
        >
          <Ionicons name="key-outline" size={20} color="white" />
          <Text className="text-white font-bold text-base tracking-widest ml-1">ENTRAR</Text>
        </TouchableOpacity>

        {/* Link Registo */}
        <TouchableOpacity onPress={() => router.push('/register')} className="mt-8 items-center pb-10">
          <Text className="text-[rgba(160,168,180,0.9)] font-medium text-sm">
            Ainda não tens conta?{' '}
            <Text className="text-[rgb(215,220,228)] font-bold">Regista-te aqui.</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL: REPOR PASSWORD */}
      {/* ======================================================== */}
      <Modal animationType="fade" transparent visible={forgotModalVisible} onRequestClose={handleCloseForgotModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className="flex-1 justify-center items-center bg-black/70 px-5">
            <View className="bg-[rgb(45,65,77)] w-full rounded-3xl p-6 border border-white/10 shadow-2xl">
              
              {/* Header Modal */}
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

              {/* Campos Modal */}
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

                {/* === Nova Password === */}
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

                {/* === Repetir Nova Password === */}
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

              {/* Botão Submeter Modal */}
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

    </KeyboardAvoidingView>
  );
}