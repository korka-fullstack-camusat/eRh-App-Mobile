import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployee } from '@/contexts/EmployeeContext';
import {
  getMyLeaveBalances, getLeaveTypes, createLeaveRequest,
} from '@/services/leaveService';
import { getMyAttendance } from '@/services/attendanceService';
import type { LeaveBalance, LeaveType } from '@/types/leave';
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

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  ok:         { label: 'Présent',   color: COLORS.success, bg: '#DCFCE7' },
  present:    { label: 'Présent',   color: COLORS.success, bg: '#DCFCE7' },
  absent:     { label: 'Absent',    color: COLORS.danger,  bg: '#FEE2E2' },
  incomplete: { label: 'Incomplet', color: COLORS.warning, bg: '#FEF3C7' },
  anomaly:    { label: 'Anomalie',  color: '#6366F1',      bg: '#EEF2FF' },
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const { employee, isLoading: empLoading } = useEmployee();
  const navigation = useNavigation<any>();

  const [balances, setBalances]   = useState<LeaveBalance[]>([]);
  const [allDays, setAllDays]     = useState<EmployeePeriodDetailDay[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [showPtModal, setShowPtModal] = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [selType, setSelType]         = useState<number | null>(null);
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [reason, setReason]           = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const today    = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayLabel = format(today, 'EEEE d MMMM yyyy', { locale: fr });

  const loadData = useCallback(async () => {
    if (!employee) return;
    const start = format(startOfMonth(today), 'yyyy-MM-dd');
    const end   = format(endOfMonth(today),   'yyyy-MM-dd');

    const [bal, att, types] = await Promise.allSettled([
      getMyLeaveBalances(employee.id),
      getMyAttendance({ employee_id: employee.id, start, end }),
      getLeaveTypes(),
    ]);

    if (bal.status   === 'fulfilled') setBalances(bal.value);
    if (att.status   === 'fulfilled') setAllDays(att.value.days ?? []);
    if (types.status === 'fulfilled') setLeaveTypes(types.value);
  }, [employee]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSubmit = async () => {
    if (!employee || !selType || !startDate || !endDate) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      Alert.alert('Erreur', 'Format invalide. Utilisez AAAA-MM-JJ.');
      return;
    }
    setSubmitting(true);
    try {
      await createLeaveRequest({
        employee: employee.id, leave_type: selType,
        start_date: startDate, end_date: endDate, reason,
      });
      setShowModal(false);
      setSelType(null); setStartDate(''); setEndDate(''); setReason('');
      await loadData();
      Alert.alert('Succès', 'Demande soumise avec succès.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.detail || 'Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  const todayRecord = allDays.find(d => d.date === todayStr) ?? null;

  const weekStart    = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd      = endOfWeek(today,   { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr   = format(weekEnd,   'yyyy-MM-dd');
  const weekDays     = allDays.filter(d => d.date >= weekStartStr && d.date <= weekEndStr);

  const totalRemaining = balances.reduce((s, b) => s + (b.remaining_days ?? b.remaining ?? 0), 0);
  const fullName  = employee ? `${employee.prenom} ${employee.nom}` : user?.username || 'Employé';
  const firstName = fullName.split(' ')[0];

  const getStatus = () => {
    if (!todayRecord) return {
      label: 'Non pointé', color: COLORS.textSecondary,
      bg: '#F1F5F9', icon: 'remove-circle-outline' as const,
    };
    const s = todayRecord.status;
    if (s === 'ok' || s === 'present') return { label: 'Présent',   color: COLORS.success, bg: '#DCFCE7', icon: 'checkmark-circle' as const };
    if (s === 'absent')                return { label: 'Absent',    color: COLORS.danger,  bg: '#FEE2E2', icon: 'close-circle'      as const };
    return                                    { label: 'Incomplet', color: COLORS.warning, bg: '#FEF3C7', icon: 'alert-circle'       as const };
  };
  const pt = getStatus();

  if (empLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Bannière ── */}
        <View style={styles.banner}>
          <Text style={styles.greeting}>Bonjour, {firstName} !</Text>
          <Text style={styles.date}>{todayLabel}</Text>
          {employee && (
            <Text style={styles.fonction}>{employee.fonction} • {employee.matricule}</Text>
          )}
        </View>

        {/* ── Pointage du jour ── */}
        <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => setShowPtModal(true)}>
          <View style={styles.cardTop}>
            <View style={styles.row}>
              <Ionicons name="finger-print-outline" size={17} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Pointage du jour</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: pt.bg }]}>
              <Ionicons name={pt.icon} size={13} color={pt.color} />
              <Text style={[styles.badgeText, { color: pt.color }]}>{pt.label}</Text>
            </View>
          </View>
          <View style={styles.timesRow}>
            <View style={styles.timeItem}>
              <Text style={styles.timeLabel}>Entrée</Text>
              <Text style={[styles.timeValue, { color: COLORS.success }]}>{fmtTime(todayRecord?.in_time)}</Text>
            </View>
            <View style={styles.timeSep} />
            <View style={styles.timeItem}>
              <Text style={styles.timeLabel}>Sortie</Text>
              <Text style={[styles.timeValue, { color: COLORS.primary }]}>{fmtTime(todayRecord?.out_time)}</Text>
            </View>
          </View>
          <Text style={styles.hint}>Appuyez pour voir la semaine</Text>
        </TouchableOpacity>

        {/* ── Solde de congés ── */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.row}>
              <Ionicons name="calendar-outline" size={17} color="#059669" />
              <Text style={styles.cardTitle}>Solde de congés</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('LeavesTab')}>
              <Text style={styles.seeMore}>Voir →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceValue}>{totalRemaining}</Text>
            <Text style={styles.balanceLabel}> jours disponibles</Text>
          </View>
        </View>

        {/* ── Accès rapides ── */}
        <Text style={styles.sectionTitle}>Accès rapides</Text>
        <View style={styles.grid}>
          <TouchableOpacity style={styles.gridItem} onPress={() => setShowModal(true)}>
            <View style={[styles.gridIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="add-circle" size={26} color={COLORS.primary} />
            </View>
            <Text style={styles.gridLabel}>Demande</Text>
            <Text style={styles.gridSub}>de congé</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('PayslipsTab')}>
            <View style={[styles.gridIcon, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="document-text" size={26} color="#059669" />
            </View>
            <Text style={styles.gridLabel}>Bulletins</Text>
            <Text style={styles.gridSub}>de paie</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('ProfileTab')}>
            <View style={[styles.gridIcon, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="person" size={26} color="#EA580C" />
            </View>
            <Text style={styles.gridLabel}>Mon profil</Text>
            <Text style={styles.gridSub} numberOfLines={1}>{firstName}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ════════════════════════════════════
          MODAL POINTAGE HEBDOMADAIRE
      ════════════════════════════════════ */}
      <Modal visible={showPtModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Pointage de la semaine</Text>
              <Text style={styles.modalSub}>
                {format(weekStart, 'd MMM', { locale: fr })} — {format(weekEnd, 'd MMM yyyy', { locale: fr })}
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
                <Text style={styles.emptyText}>Aucune donnée cette semaine</Text>
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
                      <Text style={styles.dayTimeText}>Entrée : {fmtTime(day.in_time)}</Text>
                      <Text style={[styles.dayTimeText, { marginTop: 3 }]}>Sortie : {fmtTime(day.out_time)}</Text>
                      {day.worked_minutes != null && (
                        <Text style={styles.dayWorked}>{minutesToTime(day.worked_minutes)} travaillées</Text>
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

      {/* ════════════════════════════════════
          MODAL DEMANDE DE CONGÉ
      ════════════════════════════════════ */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouvelle demande de congé</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Type de congé *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {leaveTypes.map(lt => (
                <TouchableOpacity
                  key={lt.id}
                  style={[styles.chip, selType === lt.id && styles.chipActive]}
                  onPress={() => setSelType(lt.id)}
                >
                  <Text style={[styles.chipText, selType === lt.id && styles.chipTextActive]}>
                    {lt.label || lt.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Date de début * (AAAA-MM-JJ)</Text>
            <TextInput
              style={styles.input} value={startDate} onChangeText={setStartDate}
              placeholder="2026-04-01" placeholderTextColor={COLORS.textSecondary}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>Date de fin * (AAAA-MM-JJ)</Text>
            <TextInput
              style={styles.input} value={endDate} onChangeText={setEndDate}
              placeholder="2026-04-10" placeholderTextColor={COLORS.textSecondary}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>Motif</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={reason} onChangeText={setReason}
              placeholder="Raison de votre demande..." placeholderTextColor={COLORS.textSecondary}
              multiline numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit} disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={COLORS.white} />
                : <><Ionicons name="send" size={16} color={COLORS.white} /><Text style={styles.submitBtnText}>Soumettre</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scroll:    { paddingBottom: 40 },

  // ── Bannière ──
  banner: {
    backgroundColor: COLORS.primary,
    padding: 20,
    marginBottom: 12,
  },
  greeting: { color: COLORS.white, fontSize: 22, fontWeight: 'bold' },
  date:     { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4, textTransform: 'capitalize' },
  fonction: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 5 },

  // ── Carte ──
  card: {
    backgroundColor: COLORS.white,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // ── Pointage ──
  timesRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  timeItem:  { flex: 1, alignItems: 'center' },
  timeLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  timeValue: { fontSize: 26, fontWeight: 'bold', letterSpacing: 1 },
  timeSep:   { width: 1, height: 36, backgroundColor: COLORS.border },
  hint:      { fontSize: 11, color: COLORS.textSecondary, textAlign: 'right' },

  // ── Solde ──
  balanceRow:   { flexDirection: 'row', alignItems: 'baseline' },
  balanceValue: { fontSize: 32, fontWeight: 'bold', color: '#059669' },
  balanceLabel: { fontSize: 14, color: COLORS.textSecondary },
  seeMore:      { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  // ── Accès rapides ──
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    paddingHorizontal: 16, marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  grid:     { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  gridItem: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  gridIcon:  { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  gridLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  gridSub:   { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2 },

  // ── Modal ──
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  modalTitle:   { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  modalSub:     { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  modalContent: { padding: 16, paddingBottom: 24 },

  // ── Rows pointage modal ──
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

  // ── Formulaire congé ──
  fieldLabel:     { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  chip:           { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, marginRight: 8, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  input:          { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, height: 52,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24,
  },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
});
