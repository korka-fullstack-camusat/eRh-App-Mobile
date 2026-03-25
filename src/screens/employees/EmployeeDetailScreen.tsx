import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { getEmployee, markExit, reinstate } from '@/services/employeeService';
import type { Employee } from '@/types/employee';
import type { EmployeeStackParamList } from '@/navigation/MainNavigator';
import { COLORS } from '@/theme';

type RouteProps = RouteProp<EmployeeStackParamList, 'EmployeeDetail'>;

const STATUS_COLORS = {
  ACTIVE: COLORS.success,
  EXITED: COLORS.danger,
  SUSPENDED: COLORS.warning,
};
const STATUS_LABELS = { ACTIVE: 'Actif', EXITED: 'Sorti', SUSPENDED: 'Suspendu' };

interface InfoRowProps { label: string; value?: string | null }
function InfoRow({ label, value }: InfoRowProps) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function EmployeeDetailScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { employeeId } = route.params;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmployee(employeeId)
      .then(setEmployee)
      .catch(() => Alert.alert('Erreur', 'Impossible de charger les données.'))
      .finally(() => setLoading(false));
  }, [employeeId]);

  const handleMarkExit = () => {
    Alert.prompt(
      'Date de sortie',
      'Entrez la date de sortie (YYYY-MM-DD)',
      async (date) => {
        if (!date || !employee) return;
        try {
          const updated = await markExit(employee.id, { date_sortie: date });
          setEmployee(updated);
          Alert.alert('Succès', 'Employé marqué comme sorti.');
        } catch {
          Alert.alert('Erreur', 'Opération échouée.');
        }
      }
    );
  };

  const handleReinstate = async () => {
    if (!employee) return;
    Alert.alert('Confirmation', 'Réintégrer cet employé ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        onPress: async () => {
          try {
            const updated = await reinstate(employee.id);
            setEmployee(updated);
            Alert.alert('Succès', 'Employé réintégré.');
          } catch {
            Alert.alert('Erreur', 'Opération échouée.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!employee) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Employé introuvable.</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[employee.status];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {employee.prenom[0]?.toUpperCase()}{employee.nom[0]?.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.fullName}>{employee.prenom} {employee.nom}</Text>
          <Text style={styles.fonction}>{employee.fonction}</Text>
          <View style={[styles.badge, { backgroundColor: `${statusColor}20`, borderColor: statusColor }]}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {STATUS_LABELS[employee.status]}
            </Text>
          </View>
        </View>

        {/* Informations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations générales</Text>
          <InfoRow label="Matricule" value={employee.matricule} />
          <InfoRow label="Sexe" value={employee.sexe === 'H' ? 'Homme' : employee.sexe === 'F' ? 'Femme' : null} />
          <InfoRow label="Date d'embauche" value={employee.date_embauche} />
          <InfoRow label="Service" value={employee.service} />
          <InfoRow label="Manager" value={employee.manager} />
          <InfoRow label="Localisation" value={employee.localisation} />
          <InfoRow label="Business Line" value={employee.business_line} />
          <InfoRow label="Projet" value={employee.projet} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <InfoRow label="Email" value={employee.email} />
          <InfoRow label="Téléphone" value={employee.telephone} />
        </View>

        {employee.status === 'EXITED' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sortie</Text>
            <InfoRow label="Date de sortie" value={employee.date_sortie} />
            <InfoRow label="Motif" value={employee.motif_sortie} />
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {employee.status === 'ACTIVE' && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.danger }]} onPress={handleMarkExit}>
              <Ionicons name="exit-outline" size={18} color={COLORS.white} />
              <Text style={styles.actionBtnText}>Marquer sortie</Text>
            </TouchableOpacity>
          )}
          {employee.status === 'EXITED' && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={handleReinstate}>
              <Ionicons name="enter-outline" size={18} color={COLORS.white} />
              <Text style={styles.actionBtnText}>Réintégrer</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: COLORS.textSecondary, fontSize: 15 },
  scroll: { padding: 16, paddingBottom: 32 },
  header: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${COLORS.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary },
  fullName: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  fonction: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  infoValue: { fontSize: 13, color: COLORS.text, fontWeight: '500', flex: 2, textAlign: 'right' },
  actions: { gap: 10, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    height: 48,
  },
  actionBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
});
