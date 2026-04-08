import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupDatabase } from './database';

const SESSION_KEY = 'iscac_user_session';

export const AuthService = {

  login: async (email: string, pass: string) => {
    const db = await setupDatabase();
    if (!db) throw new Error("Não foi possível carregar a base de dados.");

    const user = await db.getFirstAsync<{ id: number; nome: string; email: string; curso: string; ano: number; foto_perfil: string | null }>(
      'SELECT id, nome, email, curso, ano, foto_perfil FROM core_utilizador WHERE email = ? AND password = ?',
      [email, pass]
    );

    if (user) {
      // Guardar sessão em AsyncStorage
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }

    return user;
  },

  register: async (nome: string, email: string, curso: string, ano: number, pass: string) => {
    const db = await setupDatabase();
    if (!db) return { success: false, error: "BD indisponível" };

    const dataRegisto = new Date().toISOString();
    try {
      await db.runAsync(
        `INSERT INTO core_utilizador (nome, email, curso, ano, password, data_registo, ativo, user_id) 
         VALUES (?, ?, ?, ?, ?, ?, 1, NULL)`,
        [nome, email, curso, ano, pass, dataRegisto]
      );
      return { success: true };
    } catch (error: any) {
      console.error("ERRO REAL SQLITE:", error.message);
      return { success: false, error: error.message };
    }
  },

  // Obter o utilizador da sessão atual
  getCurrentUser: async () => {
    try {
      const data = await AsyncStorage.getItem(SESSION_KEY);
      if (!data) return null;
      return JSON.parse(data) as { id: number; nome: string; email: string; curso: string; ano: number; foto_perfil: string | null };
    } catch {
      return null;
    }
  },

  // Terminar sessão
  logout: async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
  },
};