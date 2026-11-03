import { DefaultTheme } from 'react-native-paper';

// Palette alignée sur l'application Inventory-Camusat (même ligne graphique).
export const COLORS = {
  primary: '#0f3b82',       // bleu Inventory-Camusat
  primaryLight: '#2563EB',
  primaryDark: '#0B1F44',
  accent: '#E30613',        // rouge Camusat
  secondary: '#F0A500',
  success: '#059669',
  danger: '#DC2626',
  warning: '#FFC107',
  info: '#2563EB',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#0B1F44',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  white: '#FFFFFF',
  black: '#000000',
  cardShadow: 'rgba(15,59,130,0.08)',
  blue50: '#EFF6FF',
  blue100: '#DBEAFE',
  green100: '#D1FAE5',
  red100: '#FEE2E2',
};

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    background: COLORS.background,
    surface: COLORS.surface,
  },
};
