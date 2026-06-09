import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  ScrollView, Modal, TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { forgotPasswordSms, verifyOtpSms, resetPasswordSms } from '@/services/authService';
import { COLORS } from '@/theme';
import CamusatLogo from '@/components/CamusatLogo';

type ForgotStep = 'phone' | 'otp' | 'reset' | 'success';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Mot de passe oublié ──
  const [forgotVisible, setForgotVisible]   = useState(false);
  const [forgotStep,    setForgotStep]      = useState<ForgotStep>('phone');
  const [fpPhone,       setFpPhone]         = useState('');
  const [fpCode,        setFpCode]          = useState('');
  const [fpNewPwd,      setFpNewPwd]        = useState('');
  const [fpConfirmPwd,  setFpConfirmPwd]    = useState('');
  const [showFpPwd,     setShowFpPwd]       = useState(false);
  const [showFpConfirm, setShowFpConfirm]   = useState(false);
  const [fpLoading,     setFpLoading]       = useState(false);
  const [fpError,       setFpError]         = useState('');
  const [fpResendTimer, setFpResendTimer]   = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compte à rebours renvoi SMS
  useEffect(() => {
    if (fpResendTimer > 0) {
      timerRef.current = setInterval(() => {
        setFpResendTimer(t => {
          if (t <= 1) { clearInterval(timerRef.current!); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fpResendTimer]);

  const openForgot = () => {
    setFpPhone(''); setFpCode(''); setFpNewPwd(''); setFpConfirmPwd('');
    setFpError(''); setForgotStep('phone'); setFpLoading(false); setFpResendTimer(0);
    setForgotVisible(true);
  };

  const closeForgot = () => setForgotVisible(false);

  const handleSendOtp = async () => {
    setFpError('');
    if (!fpPhone.trim()) { setFpError('Veuillez saisir votre numéro de téléphone.'); return; }
    setFpLoading(true);
    try {
      await forgotPasswordSms(fpPhone.trim());
      setForgotStep('otp');
      setFpResendTimer(60);
    } catch (e: any) {
      setFpError(e?.response?.data?.detail || 'Erreur lors de l\'envoi du SMS.');
    } finally {
      setFpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (fpResendTimer > 0) return;
    setFpError('');
    setFpLoading(true);
    try {
      await forgotPasswordSms(fpPhone.trim());
      setFpResendTimer(60);
    } catch (e: any) {
      setFpError(e?.response?.data?.detail || 'Erreur lors du renvoi du SMS.');
    } finally {
      setFpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setFpError('');
    if (fpCode.length < 6) { setFpError('Veuillez saisir le code à 6 chiffres.'); return; }
    setFpLoading(true);
    try {
      await verifyOtpSms(fpPhone.trim(), fpCode.trim());
      setForgotStep('reset');
    } catch (e: any) {
      setFpError(e?.response?.data?.detail || 'Code invalide ou expiré.');
    } finally {
      setFpLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setFpError('');
    if (!fpNewPwd || !fpConfirmPwd) { setFpError('Veuillez remplir tous les champs.'); return; }
    if (fpNewPwd.length < 6) { setFpError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (fpNewPwd !== fpConfirmPwd) { setFpError('Les mots de passe ne correspondent pas.'); return; }
    setFpLoading(true);
    try {
      await resetPasswordSms({ phone: fpPhone.trim(), code: fpCode.trim(), new_password: fpNewPwd, confirm_password: fpConfirmPwd });
      setForgotStep('success');
    } catch (e: any) {
      setFpError(e?.response?.data?.detail || 'Erreur lors de la réinitialisation.');
    } finally {
      setFpLoading(false);
    }
  };

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
        Alert.alert('Erreur réseau', `Impossible de joindre le serveur.\n\nVérifiez que :\n• Votre téléphone est connecté au WiFi\n• L'URL du serveur est correcte\n\nServeur : ${process.env.EXPO_PUBLIC_API_URL || 'non configuré'}`);
        return;
      }
      const st   = error.response.status;
      const data = error.response.data;
      const msg  = data?.detail || data?.non_field_errors?.[0] ||
        (st === 401 ? 'Identifiants incorrects.' : st === 400 ? 'Données invalides.' :
         st === 500 ? 'Erreur serveur. Contactez l\'administrateur.' : `Erreur ${st}`);
      Alert.alert('Connexion échouée', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Rendu étape mot de passe oublié ──
  const renderForgotContent = () => {
    if (forgotStep === 'success') {
      return (
        <View style={fp.successBox}>
          <View style={fp.successIcon}>
            <Ionicons name="checkmark-circle" size={60} color={COLORS.success} />
          </View>
          <Text style={fp.successTitle}>Mot de passe réinitialisé !</Text>
          <Text style={fp.successSub}>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</Text>
          <TouchableOpacity style={fp.btn} onPress={closeForgot}>
            <Text style={fp.btnText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={fp.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Indicateur d'étapes */}
        <View style={fp.steps}>
          {(['phone', 'otp', 'reset'] as ForgotStep[]).map((s, i) => {
            const done    = forgotStep === 'otp' && i === 0 || forgotStep === 'reset' && i <= 1;
            const active  = forgotStep === s;
            return (
              <React.Fragment key={s}>
                <View style={[fp.stepDot, active && fp.stepActive, done && fp.stepDone]}>
                  {done
                    ? <Ionicons name="checkmark" size={11} color={COLORS.white} />
                    : <Text style={[fp.stepNum, active && { color: COLORS.white }]}>{i + 1}</Text>
                  }
                </View>
                {i < 2 && <View style={[fp.stepLine, done && fp.stepLineDone]} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* Erreur */}
        {!!fpError && (
          <View style={fp.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color={COLORS.danger} />
            <Text style={fp.errorText}>{fpError}</Text>
          </View>
        )}

        {/* ── Étape 1 : Numéro de téléphone ── */}
        {forgotStep === 'phone' && (
          <>
            <Text style={fp.stepTitle}>Numéro de téléphone</Text>
            <Text style={fp.stepDesc}>Saisissez le numéro enregistré dans votre dossier RH. Un code sera envoyé par SMS.</Text>
            <View style={fp.inputWrap}>
              <Ionicons name="call-outline" size={18} color={COLORS.textSecondary} style={{ marginLeft: 12 }} />
              <TextInput
                style={fp.input}
                value={fpPhone}
                onChangeText={t => { setFpPhone(t); setFpError(''); }}
                placeholder="Entrez votre numéro"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="phone-pad"
                autoFocus
              />
            </View>
            <TouchableOpacity style={[fp.btn, fpLoading && { opacity: 0.6 }]} onPress={handleSendOtp} disabled={fpLoading}>
              {fpLoading
                ? <ActivityIndicator color={COLORS.white} />
                : <><Ionicons name="send-outline" size={16} color={COLORS.white} /><Text style={fp.btnText}>Envoyer le code SMS</Text></>
              }
            </TouchableOpacity>
          </>
        )}

        {/* ── Étape 2 : Code OTP ── */}
        {forgotStep === 'otp' && (
          <>
            <Text style={fp.stepTitle}>Code de vérification</Text>
            <Text style={fp.stepDesc}>
              Un code à 6 chiffres a été envoyé au{'\n'}<Text style={{ fontWeight: '700', color: COLORS.text }}>{fpPhone}</Text>
            </Text>
            <Text style={fp.label}>Code OTP</Text>
            <View style={fp.otpWrap}>
              <TextInput
                style={fp.otpInput}
                value={fpCode}
                onChangeText={t => { setFpCode(t.replace(/\D/g, '').slice(0, 6)); setFpError(''); }}
                placeholder="- - - - - -"
                placeholderTextColor={COLORS.border}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
                autoFocus
              />
            </View>
            <TouchableOpacity style={[fp.btn, fpLoading && { opacity: 0.6 }]} onPress={handleVerifyOtp} disabled={fpLoading}>
              {fpLoading
                ? <ActivityIndicator color={COLORS.white} />
                : <><Ionicons name="checkmark-outline" size={16} color={COLORS.white} /><Text style={fp.btnText}>Vérifier le code</Text></>
              }
            </TouchableOpacity>
            {/* Renvoi */}
            <TouchableOpacity style={fp.resendRow} onPress={handleResendOtp} disabled={fpResendTimer > 0 || fpLoading}>
              <Ionicons name="refresh-outline" size={14} color={fpResendTimer > 0 ? COLORS.textSecondary : COLORS.primary} />
              <Text style={[fp.resendText, fpResendTimer > 0 && { color: COLORS.textSecondary }]}>
                {fpResendTimer > 0 ? `Renvoyer dans ${fpResendTimer}s` : 'Renvoyer le code'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setForgotStep('phone'); setFpCode(''); setFpError(''); }} style={fp.backRow}>
              <Ionicons name="chevron-back" size={14} color={COLORS.textSecondary} />
              <Text style={fp.backText}>Changer de numéro</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Étape 3 : Nouveau mot de passe ── */}
        {forgotStep === 'reset' && (
          <>
            <Text style={fp.stepTitle}>Nouveau mot de passe</Text>
            <Text style={fp.stepDesc}>Choisissez un mot de passe sécurisé d'au moins 6 caractères.</Text>
            <Text style={fp.label}>Nouveau mot de passe</Text>
            <View style={fp.inputWrap}>
              <Ionicons name="lock-open-outline" size={18} color={COLORS.textSecondary} style={{ marginLeft: 12 }} />
              <TextInput
                style={fp.input}
                value={fpNewPwd}
                onChangeText={t => { setFpNewPwd(t); setFpError(''); }}
                secureTextEntry={!showFpPwd}
                placeholder="Min. 6 caractères"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
                autoFocus
              />
              <TouchableOpacity onPress={() => setShowFpPwd(v => !v)} style={fp.eye}>
                <Ionicons name={showFpPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[fp.label, { marginTop: 12 }]}>Confirmer le mot de passe</Text>
            <View style={[
              fp.inputWrap,
              fpConfirmPwd.length > 0 && fpNewPwd !== fpConfirmPwd && { borderColor: COLORS.danger },
              fpConfirmPwd.length > 0 && fpNewPwd === fpConfirmPwd && { borderColor: COLORS.success },
            ]}>
              <Ionicons name="lock-open-outline" size={18} color={COLORS.textSecondary} style={{ marginLeft: 12 }} />
              <TextInput
                style={fp.input}
                value={fpConfirmPwd}
                onChangeText={t => { setFpConfirmPwd(t); setFpError(''); }}
                secureTextEntry={!showFpConfirm}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowFpConfirm(v => !v)} style={fp.eye}>
                <Ionicons name={showFpConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[fp.btn, { marginTop: 20 }, fpLoading && { opacity: 0.6 }]} onPress={handleResetPassword} disabled={fpLoading}>
              {fpLoading
                ? <ActivityIndicator color={COLORS.white} />
                : <><Ionicons name="shield-checkmark-outline" size={16} color={COLORS.white} /><Text style={fp.btnText}>Réinitialiser le mot de passe</Text></>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <CamusatLogo size={64} showText={false} />
            <Text style={styles.appName}>eRH · Camusat</Text>
            <Text style={styles.subtitle}>Gérez vos congés, bulletins et pointages</Text>
          </View>

          {/* Formulaire */}
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
                  placeholder="Entrez votre identifiant"
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
                  placeholder="Entrez votre mot de passe"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Lien mot de passe oublié */}
            <TouchableOpacity onPress={openForgot} style={styles.forgotLink}>
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.loginButtonText}>Se connecter</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>CAMUSAT — eRH Employé v1.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ══ MODAL MOT DE PASSE OUBLIÉ ══ */}
      <Modal
        visible={forgotVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeForgot}
      >
        <SafeAreaView style={fp.safe} edges={['top', 'bottom']}>
          {/* En-tête */}
          <View style={fp.header}>
            <View style={fp.headerLeft}>
              <View style={fp.headerIcon}>
                <Ionicons name="lock-open-outline" size={16} color={COLORS.primary} />
              </View>
              <Text style={fp.headerTitle}>Mot de passe oublié</Text>
            </View>
            <TouchableOpacity onPress={closeForgot} style={fp.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {renderForgotContent()}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles login ──
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.primary },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header:  { alignItems: 'center', marginBottom: 36 },
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
  forgotLink: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 16 },
  forgotText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  loginButton: {
    backgroundColor: COLORS.primary, borderRadius: 12, height: 52,
    justifyContent: 'center', alignItems: 'center',
  },
  loginButtonDisabled: { opacity: 0.7 },
  loginButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 32 },
});

// ── Styles modal forgot password ──
const fp = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.background },
  header:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon:  {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  content: { padding: 24, paddingBottom: 40 },

  // Étapes
  steps:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
  },
  stepActive:   { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  stepDone:     { borderColor: COLORS.success,  backgroundColor: COLORS.success },
  stepNum:      { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  stepLine:     { flex: 1, height: 2, backgroundColor: COLORS.border, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: COLORS.success },

  // Erreur
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${COLORS.danger}12`, borderRadius: 10,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: `${COLORS.danger}25`,
  },
  errorText: { fontSize: 13, color: COLORS.danger, flex: 1 },

  // Textes
  stepTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  stepDesc:  { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 20 },
  label: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },

  // Champs
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    backgroundColor: COLORS.white, marginBottom: 4,
  },
  input: { flex: 1, height: 50, paddingHorizontal: 10, fontSize: 15, color: COLORS.text },
  eye:   { paddingRight: 12, padding: 6 },

  // OTP
  otpWrap:  { marginBottom: 20 },
  otpInput: {
    borderWidth: 2, borderColor: COLORS.primary, borderRadius: 14,
    height: 64, fontSize: 28, fontWeight: '800',
    color: COLORS.primary, backgroundColor: COLORS.white,
    letterSpacing: 12,
  },

  // Bouton principal
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, marginTop: 16,
  },
  btnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },

  // Renvoi / retour
  resendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 14 },
  resendText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  backRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', marginTop: 10 },
  backText:  { fontSize: 12, color: COLORS.textSecondary },

  // Succès
  successBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  successIcon:  { marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  successSub:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
});
