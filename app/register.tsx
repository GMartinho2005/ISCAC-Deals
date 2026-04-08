import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AuthService } from '../src/services/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: '',
    email: '',
    curso: '',
    ano: '',
    password: ''
  });

  const handleRegister = async () => {
    // 1. Validação básica de campos vazios
    if (!form.nome || !form.email || !form.password) {
      Alert.alert("Aviso", "Preenche os campos obrigatórios (Nome, Email e Password).");
      return;
    }

    // 2. Validação do Email Institucional (Limpa espaços e passa para minúsculas)
    const emailLimpo = form.email.trim().toLowerCase();
    if (!emailLimpo.endsWith('@alumni.iscac.pt')) {
      Alert.alert("Acesso Restrito", "Apenas são permitidos emails institucionais do ISCAC (@alumni.iscac.pt).");
      return;
    }

    // 3. Chamada explícita à função (Evita o erro de spread argument)
    const result = await AuthService.register(
      form.nome,
      emailLimpo, // Enviamos o email já limpo e validado
      form.curso,
      parseInt(form.ano) || 1, // Converte para número como a BD exige
      form.password
    );

    if (result.success) {
      Alert.alert("Sucesso!", "A tua conta foi criada. Já podes entrar.");
      router.replace('/login');
    } else {
      // Mostra o erro real que vem da BD (ex: violação de constraint)
      Alert.alert("Erro no Registo", result.error || "Tenta novamente.");
    }
  };

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
          {/* Nome */}
          <View className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 justify-center">
            <TextInput
              placeholder="Nome Completo"
              placeholderTextColor="rgba(255,255,255,0.4)"
              className="text-white font-medium"
              onChangeText={(t) => setForm({...form, nome: t})}
            />
          </View>

          {/* Email */}
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

          {/* Curso */}
          <View className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 justify-center">
            <TextInput
              placeholder="Curso (ex: Informática de Gestão)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              className="text-white font-medium"
              onChangeText={(t) => setForm({...form, curso: t})}
            />
          </View>

          {/* Ano */}
          <View className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 justify-center">
            <TextInput
              placeholder="Ano de Curso (1, 2, 3)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              className="text-white font-medium"
              keyboardType="numeric"
              onChangeText={(t) => setForm({...form, ano: t})}
            />
          </View>

          {/* Password */}
          <View className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 justify-center">
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
    </KeyboardAvoidingView>
  );
}