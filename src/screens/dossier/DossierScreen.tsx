import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEmployee } from '@/contexts/EmployeeContext';
import { useAuth } from '@/contexts/AuthContext';
import { changePassword } from '@/services/authService';
import { COLORS } from '@/theme';

interface InfoRowProps { label: string; value?: string | null; icon?: keyof typeof Ionicons.glyphMap }
function InfoRow({ label, value, icon }: InfoRowProps) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      {icon && <Ionicons name={icon} size={15} color={COLORS.textSecondary} style={styles.rowIcon} />}
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

interface SectionProps { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }
function Section({ title, icon, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={15} color={COLORS.textSecondary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function DossierScreen() {
  const { employee, isLoading } = useEmployee();
  const { user, logout } = useAuth();

  // ── Modal déconnexion ──
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // ── Modal changement de mot de passe ──
  const [showPwdModal,  setShowPwdModal]  = useState(false);
  const [oldPwd,        setOldPwd]        = useState('');
  const [newPwd,        setNewPwd]        = useState('');
  const [confirmPwd,    setConfirmPwd]    = useState('');
  const [showOld,       setShowOld]       = useState(false);
  const [showNew,       setShowNew]       = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [pwdLoading,    setPwdLoading]    = useState(false);
  const [pwdError,      setPwdError]      = useState('');
  const [pwdSuccess,    setPwdSuccess]    = useState(false);

  const openPwdModal = () => {
    setOldPwd(''); setNewPwd(''); setConfirmPwd('');
    setPwdError(''); setPwdSuccess(false);
    setShowOld(false); setShowNew(false); setShowConfirm(false);
    setShowPwdModal(true);
  };

  const closePwdModal = () => setShowPwdModal(false);

  const handleChangePwd = async () => {
    setPwdError('');
    if (!oldPwd || !newPwd || !confirmPwd) {
      setPwdError('Veuillez remplir tous les champs.');
      return;
    }
    if (newPwd.length < 8) {
      setPwdError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Les nouveaux mots de passe ne correspondent pas.');
      return;
    }
    setPwdLoading(true);
    try {
      await changePassword({ old_password: oldPwd, new_password: newPwd, confirm_password: confirmPwd });
      setPwdSuccess(true);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.old_password?.[0] ||
        e?.response?.data?.detail ||
        'Erreur lors du changement de mot de passe.';
      setPwdError(msg);
    } finally {
      setPwdLoading(false);
    }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (!employee) {
    return (
      <View style={styles.center}>
        <Ionicons name="folder-open-outline" size={56} color={COLORS.border} />
        <Text style={styles.notFoundText}>Dossier introuvable</Text>
        <Text style={styles.notFoundSub}>Aucun dossier lié à votre compte</Text>
      </View>
    );
  }

  const statusColors: Record<string, string> = {
    ACTIVE: COLORS.success, EXITED: COLORS.danger, SUSPENDED: '#F59E0B',
  };
  const statusLabels: Record<string, string> = {
    ACTIVE: 'Actif', EXITED: 'Sorti', SUSPENDED: 'Suspendu',
  };
  const statusColor = statusColors[employee.status] ?? COLORS.textSecondary;
  const statusLabel = statusLabels[employee.status] ?? employee.status;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Carte identité ── */}
        <View style={styles.idCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {employee.prenom[0]?.toUpperCase()}{employee.nom[0]?.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.fullName}>{employee.prenom} {employee.nom}</Text>
          {employee.fonction ? <Text style={styles.fonction}>{employee.fonction}</Text> : null}
          <View style={styles.idFooter}>
            <Text style={styles.matricule}>{employee.matricule}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}25` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        {/* ── Informations ── */}
        <Section title="Informations" icon="information-circle-outline">
          <InfoRow label="Service"     value={employee.service}   icon="business-outline" />
          <InfoRow label="Manager"     value={employee.manager}   icon="people-outline" />
          <InfoRow label="Email"       value={employee.email}     icon="mail-outline" />
          <InfoRow label="Téléphone"   value={employee.telephone} icon="call-outline" />
          <InfoRow label="Identifiant" value={user?.username}     icon="key-outline" />
        </Section>

        {/* ── Boutons ── */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, styles.btnBlue]} onPress={openPwdModal} activeOpacity={0.85}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.white} />
            <Text style={styles.btnText}>Mot de passe</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnRed]} onPress={() => setShowLogoutModal(true)} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.white} />
            <Text style={styles.btnText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ══ MODAL CHANGEMENT MOT DE PASSE ══ */}
      <Modal
        visible={showPwdModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePwdModal}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          {/* En-tête */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <View style={styles.modalIcon}>
                <Ionicons name="lock-closed-outline" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.modalTitle}>Changer le mot de passe</Text>
            </View>
            <TouchableOpacity onPress={closePwdModal} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {pwdSuccess ? (
            /* ── Succès ── */
            <View style={styles.successBox}>
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark-circle" size={56} color={COLORS.success} />
              </View>
              <Text style={styles.successTitle}>Mot de passe modifié !</Text>
              <Text style={styles.successSub}>
                Votre mot de passe a été mis à jour avec succès.
              </Text>
              <TouchableOpacity style={styles.successBtn} onPress={closePwdModal}>
                <Text style={styles.successBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

              {/* Message d'erreur */}
              {!!pwdError && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
                  <Text style={styles.errorText}>{pwdError}</Text>
                </View>
              )}

              {/* Champ mot de passe actuel */}
              <Text style={styles.fieldLabel}>Mot de passe actuel</Text>
              <View style={[styles.inputWrap, !!pwdError && !oldPwd && styles.inputError]}>
                <Ionicons name="lock-closed-outline" size={17} color={COLORS.textSecondary} style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.input}
                  value={oldPwd}
                  onChangeText={t => { setOldPwd(t); setPwdError(''); }}
                  secureTextEntry={!showOld}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowOld(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showOld ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Séparateur */}
              <View style={styles.divider} />

              {/* Nouveau mot de passe */}
              <Text style={styles.fieldLabel}>Nouveau mot de passe</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-open-outline" size={17} color={COLORS.textSecondary} style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.input}
                  value={newPwd}
                  onChangeText={t => { setNewPwd(t); setPwdError(''); }}
                  secureTextEntry={!showNew}
                  placeholder="Min. 8 caractères"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Indicateur de force */}
              {newPwd.length > 0 && (
                <View style={styles.strengthRow}>
                  {[...Array(4)].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            newPwd.length >= (i + 1) * 2
                              ? newPwd.length >= 8 ? COLORS.success : '#F59E0B'
                              : COLORS.border,
                        },
                      ]}
                    />
                  ))}
                  <Text style={[styles.strengthLabel, { color: newPwd.length >= 8 ? COLORS.success : '#F59E0B' }]}>
                    {newPwd.length < 4 ? 'Trop court' : newPwd.length < 8 ? 'Moyen' : 'Fort'}
                  </Text>
                </View>
              )}

              {/* Confirmer */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Confirmer le nouveau mot de passe</Text>
              <View style={[
                styles.inputWrap,
                confirmPwd.length > 0 && newPwd !== confirmPwd && styles.inputError,
                confirmPwd.length > 0 && newPwd === confirmPwd && styles.inputOk,
              ]}>
                <Ionicons name="lock-open-outline" size={17} color={COLORS.textSecondary} style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.input}
                  value={confirmPwd}
                  onChangeText={t => { setConfirmPwd(t); setPwdError(''); }}
                  secureTextEntry={!showConfirm}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              {confirmPwd.length > 0 && newPwd !== confirmPwd && (
                <Text style={styles.matchError}>Les mots de passe ne correspondent pas</Text>
              )}

              {/* Bouton confirmer */}
              <TouchableOpacity
                style={[styles.submitBtn, pwdLoading && { opacity: 0.6 }]}
                onPress={handleChangePwd}
                disabled={pwdLoading}
                activeOpacity={0.85}
              >
                {pwdLoading
                  ? <ActivityIndicator color={COLORS.white} />
                  : <>
                      <Ionicons name="checkmark-outline" size={18} color={COLORS.white} />
                      <Text style={styles.submitBtnText}>Confirmer le changement</Text>
                    </>
                }
              </TouchableOpacity>

            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* ══ MODAL DÉCONNEXION ══ */}
      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <View style={styles.logoutOverlay}>
          <View style={styles.logoutBox}>
            <View style={styles.logoutIconWrap}>
              <Ionicons name="log-out-outline" size={32} color={COLORS.danger} />
            </View>
            <Text style={styles.logoutTitle}>Déconnexion</Text>
            <Text style={styles.logoutMessage}>Êtes-vous sûr de vouloir vous déconnecter ?</Text>
            <View style={styles.logoutBtns}>
              <TouchableOpacity style={[styles.logoutBtn, styles.logoutBtnCancel]} onPress={() => setShowLogoutModal(false)} activeOpacity={0.8}>
                <Text style={styles.logoutCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.logoutBtn, styles.logoutBtnConfirm]} onPress={() => { setShowLogoutModal(false); logout(); }} activeOpacity={0.8}>
                <Text style={styles.logoutConfirmText}>Déconnecter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  notFoundText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  notFoundSub:  { fontSize: 13, color: COLORS.textSecondary },
  scroll:    { padding: 16, paddingBottom: 32 },

  // ── Carte identité ──
  idCard: {
    paddingVertical: 20, paddingHorizontal: 20,
    alignItems: 'center', marginBottom: 8,
  },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${COLORS.primary}15`,
    borderWidth: 2, borderColor: `${COLORS.primary}30`,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 26, fontWeight: 'bold', color: COLORS.primary },
  fullName:   { fontSize: 18, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginBottom: 2 },
  fonction:   { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 12 },
  idFooter:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  matricule: {
    fontSize: 12, color: COLORS.textSecondary,
    backgroundColor: COLORS.background,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },

  // ── Sections ──
  section: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:  { fontSize: 13, fontWeight: '700', color: COLORS.text },

  // ── Ligne ──
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  rowIcon:    { marginRight: 10, marginTop: 1 },
  rowContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel:   { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  rowValue:   { fontSize: 13, color: COLORS.text, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },

  // ── Boutons profil ──
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  btnBlue: { backgroundColor: COLORS.primary, shadowColor: COLORS.primary },
  btnRed:  { backgroundColor: COLORS.danger,  shadowColor: COLORS.danger  },
  btnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  // ── Modal partagé ──
  modalSafe:   { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  modalIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center', alignItems: 'center',
  },
  modalTitle:    { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: { padding: 20, paddingBottom: 40 },

  // ── Champs ──
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    backgroundColor: COLORS.white, marginBottom: 16,
  },
  inputError: { borderColor: COLORS.danger },
  inputOk:    { borderColor: COLORS.success },
  input: { flex: 1, height: 50, paddingHorizontal: 10, fontSize: 15, color: COLORS.text },
  eyeBtn: { paddingRight: 12, padding: 6 },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 20 },

  // ── Force mot de passe ──
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -8, marginBottom: 4 },
  strengthBar: { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '600', marginLeft: 4 },

  matchError: { fontSize: 12, color: COLORS.danger, marginTop: -12, marginBottom: 12 },

  // ── Erreur globale ──
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${COLORS.danger}12`, borderRadius: 10,
    padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: `${COLORS.danger}25`,
  },
  errorText: { fontSize: 13, color: COLORS.danger, flex: 1 },

  // ── Bouton soumettre ──
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 15, marginTop: 8,
  },
  submitBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },

  // ── Succès ──
  successBox:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  successIconWrap: { marginBottom: 16 },
  successTitle:   { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  successSub:     { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  successBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingHorizontal: 40, paddingVertical: 14,
  },
  successBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },

  // ── Modal déconnexion ──
  logoutOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  logoutBox: {
    backgroundColor: COLORS.white, borderRadius: 20,
    padding: 28, width: '100%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  logoutIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: `${COLORS.danger}12`,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  logoutTitle:       { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  logoutMessage:     { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  logoutBtns:        { flexDirection: 'row', gap: 10, width: '100%' },
  logoutBtn:         { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  logoutBtnCancel:   { backgroundColor: COLORS.background },
  logoutBtnConfirm:  { backgroundColor: COLORS.danger },
  logoutCancelText:  { fontSize: 14, fontWeight: '600', color: COLORS.text },
  logoutConfirmText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
