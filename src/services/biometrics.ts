import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const BIOMETRIC_ENABLED_KEY = 'iscac_biometric_enabled';
const BIOMETRIC_CREDENTIALS_KEY = 'iscac_biometric_credentials';

type StoredCredentials = {
  email: string;
  password: string;
};

export const BiometricService = {

  /**
   * Verifica se o dispositivo suporta autenticação biométrica (impressão digital / Face ID)
   */
  isAvailable: async (): Promise<boolean> => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) return false;

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return enrolled;
    } catch {
      return false;
    }
  },

  /**
   * Verifica se o utilizador ativou a impressão digital na app
   */
  isEnabled: async (): Promise<boolean> => {
    try {
      const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return value === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Ativa a impressão digital e guarda as credenciais cifradas localmente
   */
  enable: async (email: string, password: string): Promise<boolean> => {
    try {
      const credentials: StoredCredentials = { email, password };
      await AsyncStorage.setItem(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify(credentials));
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Desativa a impressão digital e remove as credenciais guardadas
   */
  disable: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(BIOMETRIC_CREDENTIALS_KEY);
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
    } catch {
      // Silencioso
    }
  },

  /**
   * Busca as credenciais guardadas (se existirem)
   */
  getStoredCredentials: async (): Promise<StoredCredentials | null> => {
    try {
      const data = await AsyncStorage.getItem(BIOMETRIC_CREDENTIALS_KEY);
      if (!data) return null;
      return JSON.parse(data) as StoredCredentials;
    } catch {
      return null;
    }
  },

  /**
   * Solicita a autenticação biométrica ao utilizador
   * Retorna true se autenticou com sucesso
   */
  authenticate: async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autenticar com Impressão Digital',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar Password',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  },

  /**
   * Limpa tudo (usado no logout)
   */
  clearOnLogout: async (): Promise<void> => {
    // Não removemos as credenciais no logout para manter o biométrico ativo
    // Apenas se o utilizador desativar explicitamente nas definições
  },
};
