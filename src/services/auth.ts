import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const SESSION_KEY = 'iscac_user_session';

export type SessionUser = {
  id: number;
  nome: string;
  email: string;
  curso: string;
  id_curso: number;
  ano: number;
  foto_perfil: string | null;
};

export const AuthService = {

  // Login via core_utilizador (alunos da app — independente do Django admin)
login: async (email: string, pass: string): Promise<{ user: SessionUser | null; error?: string }> => {
  // 1. Buscar o utilizador APENAS pelo email (sem filtrar por ativo aqui)
  const { data, error } = await supabase
    .from('core_utilizador')
    .select('id, nome, email, ano, foto_perfil, id_curso, password, ativo')
    .eq('email', email.trim().toLowerCase())
    .single();

  if (error || !data) return { user: null, error: "Email ou password incorretos. Tenta novamente." };
  
  if (data.password !== pass) return { user: null, error: "Email ou password incorretos. Tenta novamente." };

  // 2. VERIFICAR SE A CONTA ESTÁ RESTRINGIDA (Ativo = 0)
  if (data.ativo === 0) {
    return { user: null, error: "RESTRICTED" };
  }

  // 3. Buscar o nome do curso separadamente
  let nomeCurso = '';
  if (data.id_curso) {
    const { data: cursoData } = await supabase
      .from('core_curso')
      .select('nome')
      .eq('id', data.id_curso)
      .single();
    nomeCurso = cursoData?.nome ?? '';
  }

  const user: SessionUser = {
    id: data.id,
    nome: data.nome,
    email: data.email,
    ano: data.ano,
    foto_perfil: data.foto_perfil,
    id_curso: data.id_curso,
    curso: nomeCurso,
  };

  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return { user, error: undefined };
},

  // Registo de novo aluno
  register: async (
    nome: string,
    email: string,
    id_curso: number,
    ano: number,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase
      .from('core_utilizador')
      .insert({
        nome,
        email: email.trim().toLowerCase(),
        id_curso,
        ano,
        password: pass,
        data_registo: new Date().toISOString(),
        ativo: 1,
      });

    if (error) {
      // 1. Verificar se é erro de email duplicado (Código Postgres 23505)
      if (error.code === '23505' || error.message.includes('unique constraint')) {
        // Usamos console.log (ou nada) em vez de console.error para não inundar o terminal de vermelho
        console.log('Info: Tentativa de registo com email já existente.');
        return { success: false, error: 'Este email já se encontra registado.' };
      }

      // 2. Se for QUALQUER OUTRO erro (ligação, permissões, etc), aí sim mostramos no terminal
      console.error('ERRO CRÍTICO SUPABASE REGISTER:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  getCurrentUser: async (): Promise<SessionUser | null> => {
    try {
      const data = await AsyncStorage.getItem(SESSION_KEY);
      if (!data) return null;
      return JSON.parse(data) as SessionUser;
    } catch {
      return null;
    }
  },

  // Atualiza campos da sessão em memória sem novo login (ex: foto de perfil)
  updateSession: async (updates: Partial<SessionUser>): Promise<void> => {
    try {
      const data = await AsyncStorage.getItem(SESSION_KEY);
      if (!data) return;
      const current = JSON.parse(data) as SessionUser;
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...updates }));
    } catch (error) {
      console.error('Erro ao atualizar sessão:', error);
    }
  },

  logout: async (): Promise<void> => {
    await AsyncStorage.removeItem(SESSION_KEY);
  },
  
};