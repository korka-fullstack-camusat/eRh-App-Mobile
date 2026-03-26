import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEmployee } from '@/contexts/EmployeeContext';
import { getMyAttendance } from '@/services/attendanceService';
import type { EmployeePeriodDetailResponse, EmployeePeriodDetailDay } from '@/types/attendance';
import { COLORS } from '@/theme';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  ok:         { label: 'Présent',   color: COLORS.success,       icon: 'checkmark-circle' },
  present:    { label: 'Présent',   color: COLORS.success,       icon: 'checkmark-circle' },
  absent:     { label: 'Absent',    color: COLORS.danger,        icon: 'close-circle' },
  incomplete: { label: 'Incomplet', color: COLORS.warning,       icon: 'alert-circle' },
  anomaly:    { label: 'Anomalie',  color: COLORS.info,          icon: 'warning' },
};

function minutesToTime(min?: number | null): string {
  if (!min && min !== 0) return '--:--';
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}

export default function AttendanceScreen() {
  const { employee } = useEmployee();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [data, setData] = useState<EmployeePeriodDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const result = await getMyAttendance({ employee_id: employee.id, start, end });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [employee, currentMonth]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const days = data?.days ?? [];
  const presentDays = days.filter(d => d.status === 'ok' || d.status === 'present').length;
  const absentDays = days.filter(d => d.status === 'absent').length;
  const incompleteDays = days.filter(d => d.status === 'incomplete' || d.status === 'anomaly').length;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Navigation mois */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setCurrentMonth(m => subMonths(m, 1))} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </Text>
        <TouchableOpacity
          onPress={() => setCurrentMonth(m => addMonths(m, 1))}
          style={styles.navBtn}
          disabled={format(currentMonth, 'yyyy-MM') >= format(new Date(), 'yyyy-MM')}
        >
          <Ionicons
            name="chevron-forward" size={22}
            color={format(currentMonth, 'yyyy-MM') >= format(new Date(), 'yyyy-MM') ? COLORS.border : COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {/* KPIs */}
          <View style={styles.kpiRow}>
            {[
              { label: 'Présents', value: presentDays, color: COLORS.success },
              { label: 'Absents', value: absentDays, color: COLORS.danger },
              { label: 'Irréguliers', value: incompleteDays, color: COLORS.warning },
              { label: 'Total jours', value: days.length, color: COLORS.primary },
            ].map((k, i) => (
              <View key={i} style={[styles.kpiCard, { borderTopColor: k.color }]}>
                <Text style={[styles.kpiValue, { color: k.color }]}>{k.value}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
            ))}
          </View>

          {/* Liste des jours */}
          {days.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucune donnée pour ce mois</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Détail journalier ({days.length} jours)</Text>
              {days.map((day, i) => {
                const cfg = STATUS_CONFIG[day.status] ?? { label: day.status, color: COLORS.textSecondary, icon: 'ellipse' };
                return (
                  <View key={i} style={styles.dayRow}>
                    <View style={[styles.dayStrip, { backgroundColor: cfg.color }]} />
                    <View style={styles.dayDate}>
                      <Text style={styles.dayDateText}>
                        {day.weekday_label?.slice(0, 3) || ''}
                      </Text>
                      <Text style={styles.dayDateNum}>
                        {format(new Date(day.date), 'd MMM', { locale: fr })}
                      </Text>
                    </View>
                    <View style={styles.dayTimes}>
                      <Text style={styles.dayTime}>
                        {day.in_time ?? '--:--'} → {day.out_time ?? '--:--'}
                      </Text>
                      {day.worked_minutes != null && (
                        <Text style={styles.dayWorked}>{minutesToTime(day.worked_minutes)} travaillées</Text>
                      )}
                    </View>
                    <View style={[styles.dayBadge, { backgroundColor: `${cfg.color}15` }]}>
                      <Text style={[styles.dayBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    margin: 12, backgroundColor: COLORS.white, borderRadius: 10,
    paddingHorizontal: 4, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  navBtn: { padding: 6 },
  monthLabel: { fontSize: 16, fontWeight: '600', color: COLORS.text, textTransform: 'capitalize' },
  scroll: { padding: 12, paddingBottom: 32 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  kpiCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 10, padding: 10,
    alignItems: 'center', borderTopWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  kpiValue: { fontSize: 22, fontWeight: 'bold' },
  kpiLabel: { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
  dayRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 10, marginBottom: 6,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  dayStrip: { width: 4, alignSelf: 'stretch' },
  dayDate: { width: 52, padding: 10, alignItems: 'center' },
  dayDateText: { fontSize: 10, color: COLORS.textSecondary, textTransform: 'uppercase' },
  dayDateNum: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  dayTimes: { flex: 1, paddingVertical: 10 },
  dayTime: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  dayWorked: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  dayBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginRight: 10,
  },
  dayBadgeText: { fontSize: 10, fontWeight: '600' },
});
