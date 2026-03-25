import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDailyStats, getMonthlyStats } from '@/services/attendanceService';
import type { DailyStatsResponse, MonthlyStatsResponse } from '@/types/attendance';
import { COLORS } from '@/theme';
import { format, subDays, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

type TabMode = 'daily' | 'monthly';

export default function AttendanceScreen() {
  const [mode, setMode] = useState<TabMode>('daily');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [dailyData, setDailyData] = useState<DailyStatsResponse | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'daily') {
        const data = await getDailyStats(date);
        setDailyData(data);
      } else {
        const data = await getMonthlyStats(month);
        setMonthlyData(data);
      }
    } catch {
      // Keep stale data
    } finally {
      setLoading(false);
    }
  }, [mode, date, month]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const changeDate = (delta: number) => {
    const d = new Date(date);
    setDate(format(delta > 0 ? addDays(d, 1) : subDays(d, 1), 'yyyy-MM-dd'));
  };

  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(format(d, 'yyyy-MM'));
  };

  const STATUS_COLOR: Record<string, string> = {
    ok: COLORS.success,
    absent: COLORS.danger,
    incomplete: COLORS.warning,
    anomaly: COLORS.info,
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Mode tabs */}
      <View style={styles.modeTabs}>
        {(['daily', 'monthly'] as TabMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeTab, mode === m && styles.modeTabActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
              {m === 'daily' ? 'Journalier' : 'Mensuel'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => mode === 'daily' ? changeDate(-1) : changeMonth(-1)} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.dateLabel}>
          {mode === 'daily'
            ? format(new Date(date), 'd MMMM yyyy', { locale: fr })
            : format(new Date(`${month}-01`), 'MMMM yyyy', { locale: fr })}
        </Text>
        <TouchableOpacity onPress={() => mode === 'daily' ? changeDate(1) : changeMonth(1)} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {mode === 'daily' && dailyData && (
            <>
              {/* KPIs */}
              <View style={styles.kpiGrid}>
                {[
                  { label: 'Présents', value: dailyData.kpis.present, color: COLORS.success, icon: 'checkmark-circle' },
                  { label: 'Absents', value: dailyData.kpis.absent, color: COLORS.danger, icon: 'close-circle' },
                  { label: 'Incomplets', value: dailyData.kpis.incomplete, color: COLORS.warning, icon: 'alert-circle' },
                  { label: 'Anomalies', value: dailyData.kpis.anomalies, color: COLORS.info, icon: 'warning' },
                ].map((kpi, i) => (
                  <View key={i} style={[styles.kpiCard, { borderTopColor: kpi.color }]}>
                    <Ionicons name={kpi.icon as any} size={22} color={kpi.color} />
                    <Text style={styles.kpiValue}>{kpi.value}</Text>
                    <Text style={styles.kpiLabel}>{kpi.label}</Text>
                  </View>
                ))}
              </View>

              {/* Records */}
              <Text style={styles.sectionTitle}>Pointages ({dailyData.records.length})</Text>
              {dailyData.records.map((rec, i) => (
                <View key={i} style={styles.recordRow}>
                  <View style={[styles.statusStrip, { backgroundColor: STATUS_COLOR[rec.status] || COLORS.textSecondary }]} />
                  <View style={styles.recordBody}>
                    <Text style={styles.recordName}>{rec.full_name || rec.matricule}</Text>
                    <Text style={styles.recordMeta}>
                      {rec.in_time ?? '--:--'} → {rec.out_time ?? '--:--'}
                      {rec.department ? ` • ${rec.department}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.recordStatus, { color: STATUS_COLOR[rec.status] || COLORS.textSecondary }]}>
                    {rec.status === 'ok' ? 'OK' : rec.status === 'absent' ? 'Absent' : rec.status === 'incomplete' ? 'Incomplet' : 'Anomalie'}
                  </Text>
                </View>
              ))}
            </>
          )}

          {mode === 'monthly' && monthlyData && (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Résumé mensuel</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Heures travaillées</Text>
                  <Text style={styles.summaryValue}>{Math.round(monthlyData.worked_minutes / 60)}h</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Heures attendues</Text>
                  <Text style={styles.summaryValue}>{Math.round(monthlyData.expected_minutes / 60)}h</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Par employé</Text>
              {monthlyData.by_employee.map((emp, i) => (
                <View key={i} style={styles.empRow}>
                  <View style={styles.empAvatar}>
                    <Text style={styles.empAvatarText}>{(emp.full_name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={styles.empBody}>
                    <Text style={styles.empName}>{emp.full_name}</Text>
                    <Text style={styles.empMeta}>
                      {emp.worked_hours}h / {emp.expected_hours}h
                      {emp.absent_days ? ` • ${emp.absent_days}j absent(s)` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.delta, { color: emp.delta_minutes >= 0 ? COLORS.success : COLORS.danger }]}>
                    {emp.delta_minutes >= 0 ? '+' : ''}{Math.round(emp.delta_minutes / 60)}h
                  </Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  modeTabs: { flexDirection: 'row', margin: 12, gap: 8 },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  modeTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeTabText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  modeTabTextActive: { color: COLORS.white },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navBtn: { padding: 6 },
  dateLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text, textTransform: 'capitalize' },
  scroll: { padding: 12, paddingBottom: 32 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 4,
  },
  kpiValue: { fontSize: 26, fontWeight: 'bold', color: COLORS.text },
  kpiLabel: { fontSize: 12, color: COLORS.textSecondary },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 10, marginTop: 4 },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statusStrip: { width: 4, alignSelf: 'stretch' },
  recordBody: { flex: 1, padding: 12 },
  recordName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  recordMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  recordStatus: { fontSize: 12, fontWeight: '600', paddingRight: 12 },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.background },
  summaryLabel: { color: COLORS.textSecondary, fontSize: 14 },
  summaryValue: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  empAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${COLORS.primary}20`, justifyContent: 'center', alignItems: 'center' },
  empAvatarText: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
  empBody: { flex: 1 },
  empName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  empMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  delta: { fontSize: 13, fontWeight: '700' },
});
