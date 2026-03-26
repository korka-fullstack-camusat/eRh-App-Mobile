import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEmployee } from '@/contexts/EmployeeContext';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/theme';

interface InfoRowProps { label: string; value?: string | null; icon?: keyof typeof Ionicons.glyphMap }
function InfoRow({ label, value, icon }: InfoRowProps) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      {icon && <Ionicons name={icon} size={16} color={COLORS.textSecondary} style={styles.rowIcon} />}
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
        <View style={styles.sectionIconBox}>
          <Ionicons name={icon} size={18} color={COLORS.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function DossierScreen() {
  const { employee, isLoading } = useEmployee();
  const { user } = useAuth();

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
    ACTIVE: COLORS.success, EXITED: COLORS.danger, SUSPENDED: COLORS.warning,
  };
  const statusLabels: Record<string, string> = {
    ACTIVE: 'Actif', EXITED: 'Sorti', SUSPENDED: 'Suspendu',
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Carte identité */}
        <View style={styles.idCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {employee.prenom[0]?.toUpperCase()}{employee.nom[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={styles.idInfo}>
            <Text style={styles.fullName}>{employee.prenom} {employee.nom}</Text>
            <Text style={styles.fonction}>{employee.fonction}</Text>
            <Text style={styles.matricule}>Matricule : {employee.matricule}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColors[employee.status]}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[employee.status] }]} />
            <Text style={[styles.statusText, { color: statusColors[employee.status] }]}>
              {statusLabels[employee.status]}
            </Text>
          </View>
        </View>

        {/* Informations professionnelles */}
        <Section title="Informations professionnelles" icon="briefcase-outline">
          <InfoRow label="Fonction" value={employee.fonction} icon="person-outline" />
          <InfoRow label="Service" value={employee.service} icon="business-outline" />
          <InfoRow label="Business Line" value={employee.business_line} icon="layers-outline" />
          <InfoRow label="Projet" value={employee.projet} icon="folder-outline" />
          <InfoRow label="Manager" value={employee.manager} icon="people-outline" />
          <InfoRow label="Localisation" value={employee.localisation} icon="location-outline" />
          <InfoRow label="Date d'embauche" value={employee.date_embauche} icon="calendar-outline" />
        </Section>

        {/* Informations personnelles */}
        <Section title="Informations personnelles" icon="person-outline">
          <InfoRow label="Sexe" value={employee.sexe === 'H' ? 'Homme' : employee.sexe === 'F' ? 'Femme' : null} icon="person-outline" />
          <InfoRow label="Email" value={employee.email} icon="mail-outline" />
          <InfoRow label="Téléphone" value={employee.telephone} icon="call-outline" />
        </Section>

        {/* Compte utilisateur */}
        <Section title="Compte utilisateur" icon="shield-checkmark-outline">
          <InfoRow label="Identifiant" value={user?.username} icon="key-outline" />
          <InfoRow label="Email compte" value={user?.email} icon="mail-outline" />
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  notFoundText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  notFoundSub: { fontSize: 13, color: COLORS.textSecondary },
  scroll: { padding: 16, paddingBottom: 32 },
  idCard: {
    backgroundColor: COLORS.primary, borderRadius: 16, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16,
  },
  avatarCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: 'bold', color: COLORS.white },
  idInfo: { flex: 1 },
  fullName: { fontSize: 16, fontWeight: 'bold', color: COLORS.white },
  fonction: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  matricule: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  section: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionIconBox: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: `${COLORS.primary}15`, justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  rowIcon: { marginRight: 10, marginTop: 2 },
  rowContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  rowValue: { fontSize: 13, color: COLORS.text, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
});
