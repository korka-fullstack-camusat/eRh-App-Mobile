import { DefaultTheme } from 'react-native-paper';

export const COLORS = {
  primary: '#1E3A5F',
  primaryLight: '#2E5F9F',
  secondary: '#F0A500',
  success: '#28A745',
  danger: '#DC3545',
  warning: '#FFC107',
  info: '#17A2B8',
  background: '#F4F6F9',
  surface: '#FFFFFF',
  text: '#212529',
  textSecondary: '#6C757D',
  border: '#DEE2E6',
  white: '#FFFFFF',
  black: '#000000',
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
