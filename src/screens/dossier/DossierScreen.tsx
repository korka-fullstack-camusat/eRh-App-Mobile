import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEmployee } from '@/contexts/EmployeeContext';
import { useAuth } from '@/contexts/AuthContext';
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
  const navigation = useNavigation<any>();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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
          <InfoRow label="Service"    value={employee.service}   icon="business-outline" />
          <InfoRow label="Manager"    value={employee.manager}   icon="people-outline" />
          <InfoRow label="Email"      value={employee.email}     icon="mail-outline" />
          <InfoRow label="Téléphone"  value={employee.telephone} icon="call-outline" />
          <InfoRow label="Identifiant" value={user?.username}    icon="key-outline" />
        </Section>

        {/* ── Boutons ── */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnBlue]}
            onPress={() => navigation.navigate('ChangePassword')}
            activeOpacity={0.85}
          >
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.white} />
            <Text style={styles.btnText}>Mot de passe</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnRed]}
            onPress={() => setShowLogoutModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="log-out-outline" size={18} color={COLORS.white} />
            <Text style={styles.btnText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Modal déconnexion ── */}
      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={32} color={COLORS.danger} />
            </View>
            <Text style={styles.modalTitle}>Déconnexion</Text>
            <Text style={styles.modalMessage}>Êtes-vous sûr de vouloir vous déconnecter ?</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowLogoutModal(false)} activeOpacity={0.8}>
                <Text style={styles.modalBtnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={() => { setShowLogoutModal(false); logout(); }} activeOpacity={0.8}>
                <Text style={styles.modalBtnConfirmText}>Déconnecter</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  notFoundText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  notFoundSub: { fontSize: 13, color: COLORS.textSecondary },
  scroll: { padding: 16, paddingBottom: 32 },

  // ── Carte identité ──
  idCard: {
    backgroundColor: 'transparent',
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${COLORS.primary}15`,
    borderWidth: 2, borderColor: `${COLORS.primary}30`,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 26, fontWeight: 'bold', color: COLORS.primary },
  fullName: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginBottom: 2 },
  fonction: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 12 },
  idFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  matricule: {
    fontSize: 12, color: COLORS.textSecondary,
    backgroundColor: COLORS.background,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },

  // ── Sections ──
  section: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },

  // ── Ligne ──
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  rowIcon: { marginRight: 10, marginTop: 1 },
  rowContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  rowValue: { fontSize: 13, color: COLORS.text, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },

  // ── Boutons ──
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  btnBlue: { backgroundColor: COLORS.primary, shadowColor: COLORS.primary },
  btnRed:  { backgroundColor: COLORS.danger,  shadowColor: COLORS.danger  },
  btnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  // ── Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  modalBox: {
    backgroundColor: COLORS.white, borderRadius: 20,
    padding: 28, width: '100%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  modalIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: `${COLORS.danger}12`,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  modalMessage: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: COLORS.background },
  modalBtnConfirm: { backgroundColor: COLORS.danger },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  modalBtnConfirmText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
