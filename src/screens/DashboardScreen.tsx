import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployee } from '@/contexts/EmployeeContext';
import { getMyLeaveBalances } from '@/services/leaveService';
import { getMyAttendance } from '@/services/attendanceService';
import type { LeaveBalance } from '@/types/leave';
import type { EmployeePeriodDetailDay } from '@/types/attendance';
import { COLORS } from '@/theme';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';

function fmtTime(val?: string | null): string {
  if (!val) return '--:--';
  const iso = val.match(/T(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const hms = val.match(/^(\d{2}):(\d{2})/);
  if (hms) return `${hms[1]}:${hms[2]}`;
  return val;
}

function minutesToTime(min?: number | null): string {
  if (!min && min !== 0) return '--';
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`;
}

function formatDays(val: number): string {
  const rounded = Math.round(val * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  ok:         { label: 'Pr\u00e9sent',   color: COLORS.success, bg: '#DCFCE7' },
  present:    { label: 'Pr\u00e9sent',   color: COLORS.success, bg: '#DCFCE7' },
  absent:     { label: 'Absent',    color: COLORS.danger,  bg: '#FEE2E2' },
  incomplete: { label: 'Incomplet', color: COLORS.warning, bg: '#FEF3C7' },
  anomaly:    { label: 'Anomalie',  color: '#6366F1',      bg: '#EEF2FF' },
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const { employee, isLoading: empLoading } = useEmployee();
  const navigation = useNavigation<any>();

  const [balances, setBalances]     = useState<LeaveBalance[]>([]);
  const [allDays, setAllDays]       = useState<EmployeePeriodDetailDay[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showPtModal, setShowPtModal] = useState(false);

  // Animations d'entr\u00e9e (stagger)
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const card1Anim  = useRef(new Animated.Value(0)).current;
  const card2Anim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(130, [
      Animated.spring(bannerAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
      Animated.spring(card1Anim,  { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
      Animated.spring(card2Anim,  { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  const today    = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const rawDate  = format(today, 'EEEE d MMMM yyyy', { locale: fr });
  const todayLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  const loadData = useCallback(async () => {
    if (!employee) return;
    const start = format(startOfMonth(today), 'yyyy-MM-dd');
    const end   = format(endOfMonth(today),   'yyyy-MM-dd');

    const [bal, att] = await Promise.allSettled([
      getMyLeaveBalances(employee.id),
      getMyAttendance({ employee_id: employee.id, start, end }),
    ]);

    if (bal.status === 'fulfilled') setBalances(bal.value);
    if (att.status === 'fulfilled') setAllDays(att.value.days ?? []);
  }, [employee]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const todayRecord  = allDays.find(d => d.date === todayStr) ?? null;
  const weekStart    = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd      = endOfWeek(today,   { weekStartsOn: 1 });
  const weekDays     = allDays.filter(d =>
    d.date >= format(weekStart, 'yyyy-MM-dd') && d.date <= format(weekEnd, 'yyyy-MM-dd')
  );

  const totalRemaining = balances.reduce((s, b) => s + (b.remaining_days ?? b.remaining ?? 0), 0);
  const fullName  = employee ? `${employee.prenom} ${employee.nom}` : user?.username || 'Employ\u00e9';
  const firstName = fullName.split(' ')[0];
  const initials  = fullName.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase();

  const getStatus = () => {
    if (!todayRecord) return { label: 'Non point\u00e9', color: COLORS.textSecondary, bg: '#F1F5F9', icon: 'remove-circle-outline' as const };
    const s = todayRecord.status;
    if (s === 'ok' || s === 'present') return { label: 'Pr\u00e9sent',   color: COLORS.success, bg: '#DCFCE7', icon: 'checkmark-circle' as const };
    if (s === 'absent')                return { label: 'Absent',    color: COLORS.danger,  bg: '#FEE2E2', icon: 'close-circle'     as const };
    return                                    { label: 'Incomplet', color: COLORS.warning, bg: '#FEF3C7', icon: 'alert-circle'      as const };
  };
  const pt = getStatus();

  if (empLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Banni\u00e8re ── */}
        <Animated.View
          style={[
            styles.banner,
            {
              opacity: bannerAnim,
              transform: [{
                translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }),
              }],
            },
          ]}
        >
          <View style={styles.bannerTop}>
            <Text style={styles.appLabel}>eRH Camusat</Text>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={styles.greeting}>Bonjour, {firstName} !</Text>
          <Text style={styles.date}>{todayLabel}</Text>
          {employee && (
            <Text style={styles.fonction}>{employee.fonction} \u2022 {employee.matricule}</Text>
          )}
        </Animated.View>

        {/* ── Pointage du jour ── */}
        <Animated.View style={{
          opacity: card1Anim,
          transform: [{ translateY: card1Anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        }}>
          <TouchableOpacity style={styles.card} activeOpacity={0.78} onPress={() => setShowPtModal(true)}>
            <View style={styles.cardTop}>
              <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="finger-print-outline" size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.cardTitle}>Pointage du jour</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: pt.bg }]}>
                <Ionicons name={pt.icon} size={12} color={pt.color} />
                <Text style={[styles.badgeText, { color: pt.color }]}>{pt.label}</Text>
              </View>
            </View>

            <View style={styles.timesRow}>
              <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>Entr\u00e9e</Text>
                <Text style={[styles.timeValue, { color: COLORS.success }]}>
                  {fmtTime(todayRecord?.in_time)}
                </Text>
              </View>
              <View style={styles.timeSep} />
              <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>Sortie</Text>
                <Text style={[styles.timeValue, { color: todayRecord?.out_time ? COLORS.primary : COLORS.textSecondary }]}>
                  {fmtTime(todayRecord?.out_time)}
                </Text>
              </View>
            </View>

            <View style={styles.hintRow}>
              <Text style={styles.hint}>Appuyez pour voir la semaine</Text>
              <Ionicons name="chevron-forward" size={12} color={COLORS.textSecondary} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Solde de cong\u00e9s ── */}
        <Animated.View style={{
          opacity: card2Anim,
          transform: [{ translateY: card2Anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        }}>
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="calendar-outline" size={18} color="#059669" />
                </View>
                <Text style={styles.cardTitle}>Solde de cong\u00e9s</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('LeavesTab')}>
                <Text style={styles.seeMore}>Voir \u2192</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceValue}>{formatDays(totalRemaining)}</Text>
              <Text style={styles.balanceUnit}> jours disponibles</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ── Modal pointage hebdomadaire ── */}
      <Modal visible={showPtModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Pointage de la semaine</Text>
              <Text style={styles.modalSub}>
                {format(weekStart, 'd MMM', { locale: fr })} \u2014 {format(weekEnd, 'd MMM yyyy', { locale: fr })}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowPtModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {weekDays.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="time-outline" size={48} color={COLORS.border} />
                <Text style={styles.emptyText}>Aucune donn\u00e9e cette semaine</Text>
              </View>
            ) : (
              weekDays.map((day, i) => {
                const cfg = STATUS_CFG[day.status] ?? STATUS_CFG.absent;
                return (
                  <View key={i} style={styles.dayRow}>
                    <View style={[styles.dayStrip, { backgroundColor: cfg.color }]} />
                    <View style={styles.dayDateCol}>
                      <Text style={styles.dayWeekday}>
                        {format(new Date(day.date), 'EEE', { locale: fr }).toUpperCase()}
                      </Text>
                      <Text style={styles.dayNum}>
                        {format(new Date(day.date), 'd MMM', { locale: fr })}
                      </Text>
                    </View>
                    <View style={styles.dayTimesCol}>
                      <Text style={styles.dayTimeText}>Entr\u00e9e : {fmtTime(day.in_time)}</Text>
                      <Text style={[styles.dayTimeText, { marginTop: 3 }]}>Sortie : {fmtTime(day.out_time)}</Text>
                      {day.worked_minutes != null && (
                        <Text style={styles.dayWorked}>{minutesToTime(day.worked_minutes)} travaill\u00e9es</Text>
                      )}
                    </View>
                    <View style={[styles.dayBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.dayBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scroll:    { paddingBottom: 40 },

  // ── Banni\u00e8re ──
  banner: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    marginBottom: 20,
  },
  bannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  appLabel:   { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  avatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' },
  avatarText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  greeting:   { color: COLORS.white, fontSize: 26, fontWeight: 'bold', marginBottom: 5 },
  date:       { color: 'rgba(255,255,255,0.78)', fontSize: 13, marginBottom: 6 },
  fonction:   { color: 'rgba(255,255,255,0.48)', fontSize: 12 },

  // ── Carte ──
  card: {
    backgroundColor: COLORS.white,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  iconBox:   { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // ── Pointage ──
  timesRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  timeItem:  { flex: 1, alignItems: 'center' },
  timeLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  timeValue: { fontSize: 30, fontWeight: 'bold', letterSpacing: 0.5 },
  timeSep:   { width: 1, height: 42, backgroundColor: COLORS.border },
  hintRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  hint:      { fontSize: 11, color: COLORS.textSecondary },

  // ── Solde ──
  balanceRow:   { flexDirection: 'row', alignItems: 'baseline' },
  balanceValue: { fontSize: 38, fontWeight: 'bold', color: '#059669', letterSpacing: -0.5 },
  balanceUnit:  { fontSize: 15, color: COLORS.textSecondary },
  seeMore:      { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  // ── Modal ──
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  modalTitle:   { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  modalSub:     { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  modalContent: { padding: 16, paddingBottom: 24 },

  // ── Lignes pointage modal ──
  dayRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12, marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  dayStrip:    { width: 4, alignSelf: 'stretch' },
  dayDateCol:  { width: 56, padding: 12, alignItems: 'center' },
  dayWeekday:  { fontSize: 10, color: COLORS.textSecondary },
  dayNum:      { fontSize: 12, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  dayTimesCol: { flex: 1, paddingVertical: 12 },
  dayTimeText: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  dayWorked:   { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  dayBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 10 },
  dayBadgeText: { fontSize: 10, fontWeight: '600' },

  empty:     { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
});
