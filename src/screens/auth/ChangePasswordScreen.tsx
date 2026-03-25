import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { changePassword } from '@/services/authService';
import { COLORS } from '@/theme';

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les nouveaux mots de passe ne correspondent pas.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setLoading(true);
    try {
      await changePassword({ old_password: oldPassword, new_password: newPassword });
      Alert.alert('Succès', 'Mot de passe modifié avec succès.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      const msg =
        error?.response?.data?.old_password?.[0] ||
        error?.response?.data?.detail ||
        'Erreur lors du changement de mot de passe.';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={40} color={COLORS.primary} />
        </View>

        <Text style={styles.description}>
          Veuillez choisir un nouveau mot de passe sécurisé d'au moins 8 caractères.
        </Text>

        {[
          { label: 'Mot de passe actuel', value: oldPassword, onChange: setOldPassword, show: showOld, toggle: () => setShowOld(!showOld) },
          { label: 'Nouveau mot de passe', value: newPassword, onChange: setNewPassword, show: showNew, toggle: () => setShowNew(!showNew) },
          { label: 'Confirmer le nouveau mot de passe', value: confirmPassword, onChange: setConfirmPassword, show: showNew, toggle: () => {} },
        ].map((field, i) => (
          <View key={i} style={styles.inputGroup}>
            <Text style={styles.label}>{field.label}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={field.value}
                onChangeText={field.onChange}
                secureTextEntry={!field.show}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
              />
              {i < 2 && (
                <TouchableOpacity onPress={field.toggle} style={styles.eyeBtn}>
                  <Ionicons name={field.show ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.buttonText}>Confirmer le changement</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24 },
  iconContainer: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 12,
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  inputGroup: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.white,
  },
  inputIcon: { paddingLeft: 12 },
  input: { flex: 1, height: 48, paddingHorizontal: 10, fontSize: 15, color: COLORS.text },
  eyeBtn: { paddingRight: 12, padding: 4 },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
});
