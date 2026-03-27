import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEmployee } from '@/contexts/EmployeeContext';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/theme';

/* ── Ligne d'info ── */
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/* ── Section ── */
function Section({ title, icon, children }: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={14} color={COLORS.textSecondary} />
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
  const initials = `${employee.prenom[0]?.toUpperCase() ?? ''}${employee.nom[0]?.toUpperCase() ?? ''}`;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Carte identité ── */}
        <View style={styles.idCard}>
          {/* Avatar */}
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {/* Nom + fonction */}
          <Text style={styles.fullName}>{employee.prenom} {employee.nom}</Text>
          {employee.fonction ? <Text style={styles.fonction}>{employee.fonction}</Text> : null}
          {/* Matricule + status */}
          <View style={styles.idFooter}>
            <Text style={styles.matricule}>{employee.matricule}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}25` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        {/* ── Informations professionnelles ── */}
        <Section title="Informations professionnelles" icon="briefcase-outline">
          <InfoRow label="Fonction" value={employee.fonction} />
          <InfoRow label="Service" value={employee.service} />
          <InfoRow label="Business Line" value={employee.business_line} />
          <InfoRow label="Projet" value={employee.projet} />
          <InfoRow label="Manager" value={employee.manager} />
          <InfoRow label="Localisation" value={employee.localisation} />
          <InfoRow label="Date d'embauche" value={employee.date_embauche} />
        </Section>

        {/* ── Informations personnelles ── */}
        <Section title="Informations personnelles" icon="person-outline">
          <InfoRow
            label="Sexe"
            value={employee.sexe === 'H' ? 'Homme' : employee.sexe === 'F' ? 'Femme' : null}
          />
          <InfoRow label="Email" value={employee.email} />
          <InfoRow label="Téléphone" value={employee.telephone} />
        </Section>

        {/* ── Compte utilisateur ── */}
        <Section title="Compte utilisateur" icon="shield-checkmark-outline">
          <InfoRow label="Identifiant" value={user?.username} />
          <InfoRow label="Email" value={user?.email} />
        </Section>

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('ChangePassword')}>
            <View style={styles.actionBtnLeft}>
              <View style={[styles.actionIcon, { backgroundColor: `${COLORS.primary}12` }]}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.actionBtnText}>Changer le mot de passe</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.logoutBtn]} onPress={() => logout()}>
            <View style={styles.actionBtnLeft}>
              <View style={[styles.actionIcon, { backgroundColor: `${COLORS.danger}12` }]}>
                <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
              </View>
              <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Se déconnecter</Text>
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  notFoundText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  notFoundSub: { fontSize: 13, color: COLORS.textSecondary },
  scroll: { padding: 16, paddingBottom: 40 },

  // ── Carte identité ──
  idCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: COLORS.white },
  fullName: {
    fontSize: 20, fontWeight: 'bold', color: COLORS.white,
    textAlign: 'center', marginBottom: 4,
  },
  fonction: {
    fontSize: 13, color: 'rgba(255,255,255,0.75)',
    textAlign: 'center', marginBottom: 14,
  },
  idFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4,
  },
  matricule: {
    fontSize: 12, color: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },

  // ── Section ──
  section: {
    backgroundColor: COLORS.white, borderRadius: 14,
    marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  // ── Ligne ──
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  rowLabel: { fontSize: 13, color: COLORS.textSecondary },
  rowValue: {
    fontSize: 13, color: COLORS.text, fontWeight: '500',
    maxWidth: '58%', textAlign: 'right',
  },

  // ── Actions ──
  actions: { gap: 10, marginTop: 4 },
  actionBtn: {
    backgroundColor: COLORS.white, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  logoutBtn: {},
  actionBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 14, fontWeight: '600', color: COLORS.text,
  },
});
