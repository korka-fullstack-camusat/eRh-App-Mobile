import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployee } from '@/contexts/EmployeeContext';
import { getMyLeaveBalances } from '@/services/leaveService';
import { getMyAttendance } from '@/services/attendanceService';
import type { LeaveBalance } from '@/types/leave';
import { COLORS } from '@/theme';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { employee, isLoading: empLoading } = useEmployee();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [attendance, setAttendance] = useState<{ present: number; absent: number; total: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date();
  const todayLabel = format(today, 'EEEE d MMMM yyyy', { locale: fr });

  const loadData = useCallback(async () => {
    if (!employee) return;
    const start = format(startOfMonth(today), 'yyyy-MM-dd');
    const end = format(endOfMonth(today), 'yyyy-MM-dd');

    const [bal, att] = await Promise.allSettled([
      getMyLeaveBalances(employee.id),
      getMyAttendance({ employee_id: employee.id, start, end }),
    ]);

    if (bal.status === 'fulfilled') setBalances(bal.value);
    if (att.status === 'fulfilled') {
      const days = att.value.days ?? [];
      const present = days.filter(d => d.status === 'ok' || d.status === 'present').length;
      const absent = days.filter(d => d.status === 'absent').length;
      setAttendance({ present, absent, total: days.length });
    }
  }, [employee]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const fullName = employee
    ? `${employee.prenom} ${employee.nom}`
    : user?.username || 'Employé';

  if (empLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Bannière */}
        <View style={styles.banner}>
          <View style={styles.bannerLeft}>
            <Text style={styles.greeting}>Bonjour, {fullName.split(' ')[0]} 👋</Text>
            <Text style={styles.date}>{todayLabel}</Text>
            {employee && (
              <Text style={styles.fonction}>{employee.fonction} • {employee.matricule}</Text>
            )}
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{fullName[0]?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Stats présences du mois */}
        {attendance && (
          <>
            <Text style={styles.sectionTitle}>Mes présences — {format(today, 'MMMM yyyy', { locale: fr })}</Text>
            <View style={styles.statsRow}>
              {[
                { label: 'Jours présent', value: attendance.present, color: COLORS.success, icon: 'checkmark-circle' },
                { label: 'Jours absent', value: attendance.absent, color: COLORS.danger, icon: 'close-circle' },
                { label: 'Jours ouvrés', value: attendance.total, color: COLORS.primary, icon: 'calendar' },
              ].map((s, i) => (
                <View key={i} style={[styles.statCard, { borderTopColor: s.color }]}>
                  <Ionicons name={s.icon as any} size={22} color={s.color} />
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Soldes de congés */}
        {balances.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Mes soldes de congés</Text>
            {balances.map((b, i) => (
              <View key={i} style={styles.balanceCard}>
                <View style={styles.balanceLeft}>
                  <Text style={styles.balanceName}>{b.leave_type_name}</Text>
                  <Text style={styles.balanceSub}>{b.year}</Text>
                </View>
                <View style={styles.balanceRight}>
                  <View style={styles.balancePill}>
                    <Text style={styles.balancePillText}>{b.remaining_days}j</Text>
                  </View>
                  <Text style={styles.balanceDetail}>sur {b.total_days}j</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Info employé */}
        {employee && (
          <>
            <Text style={styles.sectionTitle}>Mes informations</Text>
            <View style={styles.infoCard}>
              {[
                { label: 'Service', value: employee.service },
                { label: 'Localisation', value: employee.localisation },
                { label: 'Manager', value: employee.manager },
                { label: 'Date d\'embauche', value: employee.date_embauche },
              ].filter(r => r.value).map((row, i) => (
                <View key={i} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  banner: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  bannerLeft: { flex: 1 },
  greeting: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  date: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  fonction: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 10, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 10, padding: 12,
    alignItems: 'center', borderTopWidth: 3, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  statValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.text },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center' },
  balanceCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  balanceLeft: { flex: 1 },
  balanceName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  balanceSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  balanceRight: { alignItems: 'center', gap: 2 },
  balancePill: {
    backgroundColor: `${COLORS.primary}15`, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  balancePillText: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  balanceDetail: { fontSize: 11, color: COLORS.textSecondary },
  infoCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary },
  infoValue: { fontSize: 13, color: COLORS.text, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
});
