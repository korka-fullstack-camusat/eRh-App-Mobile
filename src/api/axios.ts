import axios from 'axios';
import { Platform } from 'react-native';
import { storage } from '@/platform/storage';

// Version web : même adresse que le site (le serveur web relaie /api vers le backend du pays : Sénégal ou Burkina).
const BASE_URL = Platform.OS === 'web'
  ? window.location.origin
  : process.env.EXPO_PUBLIC_API_URL || 'https://apierh.camusatsn.com';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Inject access token on every request
api.interceptors.request.use(
  async (config) => {
    const token = await storage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

// Auto-refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      const refreshToken = await storage.getItem('refresh_token');
      if (!refreshToken) return Promise.reject(error);

      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${BASE_URL}/api/auth/token/refresh/`, {
          refresh: refreshToken,
        });
        const newToken = res.data.access;
        await storage.setItem('access_token', newToken);
        api.defaults.headers.Authorization = `Bearer ${newToken}`;
        onRefreshed(newToken);
        return api(originalRequest);
      } catch {
        await storage.removeItem('access_token');
        await storage.removeItem('refresh_token');
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
