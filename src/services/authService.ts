import * as SecureStore from 'expo-secure-store';
import api from '@/api/axios';
import type { LoginCredentials, AuthTokens, UserProfile } from '@/types/auth';

export async function login(credentials: LoginCredentials): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>('/api/auth/login/', credentials);
  await SecureStore.setItemAsync('access_token', data.access);
  await SecureStore.setItemAsync('refresh_token', data.refresh);
  return data;
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
}

export async function getProfile(): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>('/api/auth/profile/');
  return data;
}

export async function changePassword(payload: {
  old_password: string;
  new_password: string;
}): Promise<void> {
  await api.post('/api/auth/change-password/', payload);
}

export async function getStoredTokens(): Promise<{ access: string | null; refresh: string | null }> {
  const access = await SecureStore.getItemAsync('access_token');
  const refresh = await SecureStore.getItemAsync('refresh_token');
  return { access, refresh };
}
