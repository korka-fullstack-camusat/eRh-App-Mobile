import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEmployee } from '@/contexts/EmployeeContext';
import { getMyAttendance } from '@/services/attendanceService';
import type { EmployeePeriodDetailResponse, EmployeePeriodDetailDay } from '@/types/attendance';
import { COLORS } from '@/theme';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type StatusFilter = 'all' | 'present' | 'absent' | 'incomplete';

const FILTER_OPTIONS: { key: StatusFilter; label: string; icon: string; color: string }[] = [
  { key: 'all', label: 'Tous', icon: 'apps', color: COLORS.primary },
  { key: 'present', label: 'Présent', icon: 'checkmark-circle', color: COLORS.success },
  { key: 'absent', label: 'Absent', icon: 'close-circle', color: COLORS.danger },
  { key: 'incomplete', label: 'Incomplet', icon: 'alert-circle', color: COLORS.warning },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ok:         { label: 'Présent',   color: COLORS.success, bg: '#DCFCE7' },
  present:    { label: 'Présent',   color: COLORS.success, bg: '#DCFCE7' },
  absent:     { label: 'Absent',    color: COLORS.danger,  bg: '#FEE2E2' },
  incomplete: { label: 'Incomplet', color: COLORS.warning, bg: '#FEF3C7' },
  anomaly:    { label: 'Anomalie',  color: COLORS.info,    bg: '#DBEAFE' },
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
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [exporting, setExporting] = useState(false);

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

  const allDays = data?.days ?? [];

  // Filter days
  const filteredDays = filter === 'all'
    ? allDays
    : allDays.filter(d => {
        if (filter === 'present') return d.status === 'ok' || d.status === 'present';
        if (filter === 'absent') return d.status === 'absent';
        return d.status === 'incomplete' || d.status === 'anomaly';
      });

  // KPIs
  const presentDays = allDays.filter(d => d.status === 'ok' || d.status === 'present').length;
  const absentDays = allDays.filter(d => d.status === 'absent').length;
  const incompleteDays = allDays.filter(d => d.status === 'incomplete' || d.status === 'anomaly').length;
  const totalWorked = allDays.reduce((s, d) => s + (d.worked_minutes ?? 0), 0);

  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: fr });
  const isCurrentOrFuture = format(currentMonth, 'yyyy-MM') >= format(new Date(), 'yyyy-MM');

  // PDF Export
  const handleExportPDF = async () => {
    if (filteredDays.length === 0) {
      Alert.alert('Export', 'Aucune donnée à exporter.');
      return;
    }
    setExporting(true);
    try {
      const employeeName = employee ? `${employee.prenom} ${employee.nom}` : 'Employé';
      const rows = filteredDays.map(d => {
        const cfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.absent;
        return `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;">${d.weekday_label?.slice(0, 3) || ''}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;">${format(new Date(d.date), 'd MMM yyyy', { locale: fr })}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;">
              <span style="background:${cfg.bg};color:${cfg.color};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">${cfg.label}</span>
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;">${d.in_time ?? '--:--'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;">${d.out_time ?? '--:--'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;">${minutesToTime(d.worked_minutes)}</td>
          </tr>
        `;
      }).join('');

      const html = `
        <html>
          <head><meta charset="utf-8" /><style>
            body { font-family: -apple-system, sans-serif; margin: 0; padding: 20px; color: #1A1A2E; }
            .header { background: #003C71; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 20px; }
            .header p { margin: 4px 0 0; opacity: 0.8; font-size: 13px; }
            .stats { display: flex; gap: 12px; margin-bottom: 20px; }
            .stat { flex: 1; background: #F5F7FA; border-radius: 8px; padding: 12px; text-align: center; }
            .stat .val { font-size: 24px; font-weight: bold; }
            .stat .lbl { font-size: 11px; color: #6C757D; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #F5F7FA; padding: 10px 12px; text-align: left; font-weight: 600; color: #6C757D; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
            .footer { margin-top: 20px; text-align: center; color: #6C757D; font-size: 10px; border-top: 1px solid #E2E8F0; padding-top: 10px; }
          </style></head>
          <body>
            <div class="header">
              <h1>Rapport de Présences — CAMUSAT</h1>
              <p>${employeeName} • ${employee?.matricule ?? ''} • ${employee?.service ?? ''}</p>
              <p>Période : ${monthLabel}</p>
            </div>
            <div class="stats">
              <div class="stat"><div class="val" style="color:#28A745">${presentDays}</div><div class="lbl">Présent</div></div>
              <div class="stat"><div class="val" style="color:#DC3545">${absentDays}</div><div class="lbl">Absent</div></div>
              <div class="stat"><div class="val" style="color:#FFC107">${incompleteDays}</div><div class="lbl">Incomplet</div></div>
              <div class="stat"><div class="val" style="color:#003C71">${minutesToTime(totalWorked)}</div><div class="lbl">Total heures</div></div>
            </div>
            <table>
              <thead><tr>
                <th>Jour</th><th>Date</th><th>Statut</th><th>Entrée</th><th>Sortie</th><th>Durée</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="footer">Document confidentiel — CAMUSAT eRH — Généré le ${format(new Date(), 'd MMMM yyyy à HH:mm', { locale: fr })}</div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e: any) {
      Alert.alert('Erreur', 'Impossible de générer le PDF.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Month navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setCurrentMonth(m => subMonths(m, 1))} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={() => setCurrentMonth(m => addMonths(m, 1))}
          style={styles.navBtn}
          disabled={isCurrentOrFuture}
        >
          <Ionicons name="chevron-forward" size={22} color={isCurrentOrFuture ? COLORS.border : COLORS.primary} />
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
              { label: 'Incomplets', value: incompleteDays, color: COLORS.warning },
              { label: 'Heures', value: minutesToTime(totalWorked), color: COLORS.primary },
            ].map((k, i) => (
              <View key={i} style={[styles.kpiCard, { borderTopColor: k.color }]}>
                <Text style={[styles.kpiValue, { color: k.color }]}>{k.value}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
            ))}
          </View>

          {/* Filters */}
          <View style={styles.filterRow}>
            {FILTER_OPTIONS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, filter === f.key && { backgroundColor: f.color, borderColor: f.color }]}
                onPress={() => setFilter(f.key)}
              >
                <Ionicons
                  name={f.icon as any} size={14}
                  color={filter === f.key ? COLORS.white : f.color}
                />
                <Text style={[styles.filterText, filter === f.key && { color: COLORS.white }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Export button */}
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF} disabled={exporting}>
            {exporting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="download-outline" size={16} color={COLORS.white} />
                <Text style={styles.exportBtnText}>Télécharger en PDF</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Day list */}
          {filteredDays.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>
                {allDays.length === 0 ? 'Aucune donnée pour ce mois' : 'Aucun résultat pour ce filtre'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                Détail journalier ({filteredDays.length} jour{filteredDays.length > 1 ? 's' : ''})
              </Text>
              {filteredDays.map((day, i) => {
                const cfg = STATUS_CONFIG[day.status] ?? { label: day.status, color: COLORS.textSecondary, bg: '#F1F5F9' };
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
                    <View style={[styles.dayBadge, { backgroundColor: cfg.bg }]}>
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
    margin: 12, backgroundColor: COLORS.white, borderRadius: 12,
    paddingHorizontal: 4, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  navBtn: { padding: 8 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text, textTransform: 'capitalize' },
  scroll: { padding: 12, paddingBottom: 32 },

  // KPIs
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpiCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 10,
    alignItems: 'center', borderTopWidth: 3,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  kpiValue: { fontSize: 20, fontWeight: 'bold' },
  kpiLabel: { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2 },

  // Filters
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
  },
  filterText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },

  // Export
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, marginBottom: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  exportBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },

  // Day rows
  dayRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12, marginBottom: 8,
    overflow: 'hidden',
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 1,
  },
  dayStrip: { width: 4, alignSelf: 'stretch' },
  dayDate: { width: 55, padding: 10, alignItems: 'center' },
  dayDateText: { fontSize: 10, color: COLORS.textSecondary, textTransform: 'uppercase' },
  dayDateNum: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  dayTimes: { flex: 1, paddingVertical: 10 },
  dayTime: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  dayWorked: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  dayBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginRight: 10 },
  dayBadgeText: { fontSize: 10, fontWeight: '600' },
});
