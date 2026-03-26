import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/theme';
import CamusatLogo from '@/components/CamusatLogo';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    try {
      await login({ username: username.trim(), password });
    } catch (error: any) {
      if (!error?.response) {
        Alert.alert(
          'Erreur réseau',
          `Impossible de joindre le serveur.\n\nVérifiez que :\n• Votre téléphone est connecté au WiFi\n• L'URL du serveur est correcte\n\nServeur : ${process.env.EXPO_PUBLIC_API_URL || 'non configuré'}`
        );
        return;
      }
      const status = error.response.status;
      const data = error.response.data;
      const msg =
        data?.detail ||
        data?.non_field_errors?.[0] ||
        (status === 401 ? 'Identifiants incorrects.' :
         status === 400 ? 'Données invalides.' :
         status === 500 ? 'Erreur serveur. Contactez l\'administrateur.' :
         `Erreur ${status}`);
      Alert.alert('Connexion échouée', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header with Camusat Logo */}
          <View style={styles.header}>
            <CamusatLogo size={64} showText={false} />
            <Text style={styles.appName}>eRH Mobile</Text>
            <Text style={styles.subtitle}>Espace Employé</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Connexion</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Identifiant</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Matricule ou email"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Votre mot de passe"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.loginButtonText}>Se connecter</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>CAMUSAT — eRH Employé v1.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 36 },
  appName: { fontSize: 28, fontWeight: 'bold', color: COLORS.white, marginTop: 16 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  formContainer: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 10,
  },
  formTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 24, textAlign: 'center' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.background,
  },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, height: 50, paddingHorizontal: 10, fontSize: 15, color: COLORS.text },
  eyeIcon: { paddingRight: 14, padding: 4 },
  loginButton: {
    backgroundColor: COLORS.primary, borderRadius: 12, height: 52,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  loginButtonDisabled: { opacity: 0.7 },
  loginButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 32 },
});
