// Stockage des jetons : Keychain / Keystore sur mobile (SecureStore), localStorage sur la version web.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const web = Platform.OS === 'web';

export const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (!web) return SecureStore.getItemAsync(key);
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (!web) return SecureStore.setItemAsync(key, value);
    try { window.localStorage.setItem(key, value); } catch { /* navigation privée : session non conservée */ }
  },
  removeItem: async (key: string): Promise<void> => {
    if (!web) return SecureStore.deleteItemAsync(key);
    try { window.localStorage.removeItem(key); } catch { /* ignoré */ }
  },
};
