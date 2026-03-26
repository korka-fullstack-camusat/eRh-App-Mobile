import { DefaultTheme } from 'react-native-paper';

export const COLORS = {
  primary: '#003C71',       // Camusat navy blue
  primaryLight: '#1A5A9E',
  primaryDark: '#002A50',
  accent: '#E30613',        // Camusat red
  secondary: '#F0A500',     // Amber/gold
  success: '#28A745',
  danger: '#DC3545',
  warning: '#FFC107',
  info: '#17A2B8',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6C757D',
  border: '#E2E8F0',
  white: '#FFFFFF',
  black: '#000000',
  cardShadow: 'rgba(0,60,113,0.08)',
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
