import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput,
  Alert, Animated, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployee } from '@/contexts/EmployeeContext';
import {
  getMyLeaveBalances, getMyLeaveRequests,
  getLeaveTypes, createLeaveRequest,
} from '@/services/leaveService';
import { getMyAttendance } from '@/services/attendanceService';
import type { LeaveBalance, LeaveRequest, LeaveType } from '@/types/leave';
import type { EmployeePeriodDetailDay } from '@/types/attendance';
import { COLORS } from '@/theme';
import { format, startOfMonth, endOfMonth, subMonths, getDate } from 'date-fns';
import { fr } from 'date-fns/locale';
import CamusatLogo from '@/components/CamusatLogo';

// Extrait HH:mm depuis ISO ou HH:mm:ss
function fmtTime(val?: string | null): string {
  if (!val) return '--:--';
  const iso = val.match(/T(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const hms = val.match(/^(\d{2}):(\d{2})/);
  if (hms) return `${hms[1]}:${hms[2]}`;
  return val;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { employee, isLoading: empLoading } = useEmployee();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [todayRecord, setTodayRecord] = useState<EmployeePeriodDetailDay | null>(null);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Modal congé
  const [showModal, setShowModal] = useState(false);
  const [selType, setSelType] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayLabel = format(today, 'EEEE d MMMM yyyy', { locale: fr });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadData = useCallback(async () => {
    if (!employee) return;
    const start = format(startOfMonth(today), 'yyyy-MM-dd');
    const end = format(endOfMonth(today), 'yyyy-MM-dd');

    const [bal, att, reqs, types] = await Promise.allSettled([
      getMyLeaveBalances(employee.id),
      getMyAttendance({ employee_id: employee.id, start, end }),
      getMyLeaveRequests(employee.id),
      getLeaveTypes(),
    ]);

    if (bal.status === 'fulfilled') setBalances(bal.value);
    if (att.status === 'fulfilled') {
      const days = att.value.days ?? [];
      setTodayRecord(days.find(d => d.date === todayStr) ?? null);
    }
    if (reqs.status === 'fulfilled') setAllLeaves(reqs.value);
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

  // Pointage
  const getPt = () => {
    if (!todayRecord) return { label: 'Aucun pointage', color: COLORS.textSecondary, icon: 'remove-circle-outline' as const, entree: '--:--', sortie: '--:--' };
    const s = todayRecord.status;
    const entree = fmtTime(todayRecord.in_time);
    const sortie = fmtTime(todayRecord.out_time);
    if (s === 'ok' || s === 'present') return { label: 'Présent', color: COLORS.success, icon: 'checkmark-circle' as const, entree, sortie };
    if (s === 'absent') return { label: 'Absent', color: COLORS.danger, icon: 'close-circle' as const, entree, sortie };
    return { label: 'Incomplet', color: COLORS.warning, icon: 'alert-circle' as const, entree, sortie };
  };
  const pt = getPt();

  // Soldes congés
  const totalRemaining = balances.reduce((s, b) => s + (b.remaining_days ?? b.remaining ?? 0), 0);

  // Solde pris sur les 3 derniers mois (congés APPROVED qui chevauchent la période)
  const threeMonthsAgo = format(startOfMonth(subMonths(today, 2)), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');
  const takenLast3Months = allLeaves
    .filter(l =>
      (l.status === 'APPROVED' || l.status === 'approved') &&
      l.start_date <= monthEnd &&
      l.end_date >= threeMonthsAgo
    )
    .reduce((sum, l) => sum + (l.duration_days ?? 0), 0);

  // Notification début de mois (jours 1-7)
  const isStartOfMonth = getDate(today) <= 7;

  const fullName = employee ? `${employee.prenom} ${employee.nom}` : user?.username || 'Employé';
  const firstName = fullName.split(' ')[0];

  // Responsive: padding horizontal adapté à la largeur
  const hPad = width < 375 ? 12 : 16;

  if (empLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: hPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Bannière ── */}
        <Animated.View style={[styles.banner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.bannerLeft}>
            <Text style={[styles.greeting, { fontSize: width < 375 ? 17 : 20 }]}>
              Bonjour, {firstName} !
            </Text>
            <Text style={styles.date}>{todayLabel}</Text>
            {employee && (
              <Text style={styles.fonction}>{employee.fonction} • {employee.matricule}</Text>
            )}
          </View>
          <CamusatLogo size={width < 375 ? 30 : 36} showText={false} />
        </Animated.View>

        {/* ── Pointage du jour ── */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('AttendanceTab')}
        >
          <View style={styles.cardHeader}>
            <View style={styles.row}>
              <Ionicons name="finger-print-outline" size={17} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Pointage du jour</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={COLORS.border} />
          </View>

          <View style={styles.ptBody}>
            {/* Heures */}
            <View style={styles.ptTimes}>
              <View style={styles.ptLine}>
                <Ionicons name="log-in-outline" size={15} color={COLORS.success} />
                <Text style={styles.ptLabel}>Entrée</Text>
                <Text style={[styles.ptValue, { color: pt.entree !== '--:--' ? COLORS.success : COLORS.textSecondary }]}>
                  {pt.entree}
                </Text>
              </View>
              <View style={styles.ptSep} />
              <View style={styles.ptLine}>
                <Ionicons name="log-out-outline" size={15} color={COLORS.primary} />
                <Text style={styles.ptLabel}>Sortie</Text>
                <Text style={[styles.ptValue, { color: pt.sortie !== '--:--' ? COLORS.primary : COLORS.textSecondary }]}>
                  {pt.sortie}
                </Text>
              </View>
            </View>

            {/* Statut */}
            <View style={[styles.statusBadge, { backgroundColor: `${pt.color}15` }]}>
              <Ionicons name={pt.icon} size={20} color={pt.color} />
              <Text style={[styles.statusText, { color: pt.color }]}>{pt.label}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── En-tête Congés ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes congés</Text>
          <TouchableOpacity style={styles.requestBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={16} color={COLORS.white} />
            <Text style={styles.requestBtnText}>Demander</Text>
          </TouchableOpacity>
        </View>

        {/* Notification début de mois */}
        {isStartOfMonth && (
          <View style={styles.notifCard}>
            <Ionicons name="gift-outline" size={19} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>Solde mis à jour</Text>
              <Text style={styles.notifSub}>+2 jours de congé crédités ce mois</Text>
            </View>
          </View>
        )}

        {/* ── Soldes : deux blocs côte à côte ── */}
        <View style={styles.soldesRow}>
          {/* Solde actuel */}
          <View style={[styles.soldeCard, styles.soldeCardPrimary, { flex: 1 }]}>
            <Text style={styles.soldeLabelLight}>Solde actuel</Text>
            <Text style={styles.soldeValueBig}>{totalRemaining}</Text>
            <Text style={styles.soldeLabelLight}>jours restants</Text>
          </View>

          {/* Solde pris 3 mois */}
          <View style={[styles.soldeCard, styles.soldeCardSecondary, { flex: 1 }]}>
            <Text style={styles.soldeLabelDark}>Pris (3 mois)</Text>
            <Text style={[styles.soldeValueBig, { color: COLORS.text }]}>{takenLast3Months}</Text>
            <Text style={styles.soldeLabelDark}>jours utilisés</Text>
          </View>
        </View>

        {/* ── Détail par type de congé ── */}
        {balances.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle2}>Détail par type</Text>
            {balances.map((b, i) => {
              const rem = b.remaining_days ?? b.remaining ?? 0;
              const total = b.total_days ?? b.acquired ?? 0;
              const pct = total > 0 ? Math.min((rem / total) * 100, 100) : 0;
              const low = pct < 20;
              return (
                <View
                  key={i}
                  style={[styles.balanceRow, i < balances.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.background }]}
                >
                  <Text style={styles.balanceType} numberOfLines={1}>{b.leave_type_name}</Text>
                  <View style={styles.balanceRight}>
                    {/* Barre de progression */}
                    <View style={styles.bar}>
                      <View style={[styles.barFill, {
                        width: `${pct}%`,
                        backgroundColor: low ? COLORS.danger : COLORS.primary,
                      }]} />
                    </View>
                    <Text style={[styles.balanceDays, low && { color: COLORS.danger }]}>
                      {rem}j
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Modal demande de congé ── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouvelle demande de congé</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={[styles.modalContent, { paddingHorizontal: hPad }]}
            keyboardShouldPersistTaps="handled"
          >
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
              style={styles.input}
              value={startDate} onChangeText={setStartDate}
              placeholder="2026-04-01" placeholderTextColor={COLORS.textSecondary}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>Date de fin * (AAAA-MM-JJ)</Text>
            <TextInput
              style={styles.input}
              value={endDate} onChangeText={setEndDate}
              placeholder="2026-04-10" placeholderTextColor={COLORS.textSecondary}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>Motif</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={reason} onChangeText={setReason}
              placeholder="Raison de votre demande..."
              placeholderTextColor={COLORS.textSecondary}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingTop: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // ── Bannière ──
  banner: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  bannerLeft: { flex: 1, paddingRight: 10 },
  greeting: { color: COLORS.white, fontWeight: 'bold' },
  date: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 3, textTransform: 'capitalize' },
  fonction: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 },

  // ── Carte générique ──
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  cardTitle2: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 },

  // ── Pointage ──
  ptBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ptTimes: { gap: 8 },
  ptLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ptLabel: { fontSize: 14, color: COLORS.textSecondary, width: 48 },
  ptValue: { fontSize: 22, fontWeight: 'bold' },
  ptSep: { height: 1, backgroundColor: COLORS.border, marginLeft: 23 },
  statusBadge: {
    alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: '700' },

  // ── Section congés ──
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  requestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
  },
  requestBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  // ── Notif début de mois ──
  notifCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ECFDF5', borderRadius: 12, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  notifTitle: { fontSize: 13, fontWeight: '700', color: '#059669' },
  notifSub: { fontSize: 12, color: '#065F46', marginTop: 1 },

  // ── Soldes (2 blocs côte à côte) ──
  soldesRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  soldeCard: {
    borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  soldeCardPrimary: { backgroundColor: COLORS.primary },
  soldeCardSecondary: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  soldeLabelLight: { fontSize: 11, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  soldeLabelDark: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },
  soldeValueBig: { fontSize: 34, fontWeight: 'bold', color: COLORS.white, marginVertical: 4 },

  // ── Détail balances ──
  balanceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  balanceType: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '500' },
  balanceRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { width: 64, height: 6, backgroundColor: COLORS.background, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  balanceDays: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary, minWidth: 30, textAlign: 'right' },

  // ── Modal ──
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  modalContent: { paddingTop: 8, paddingBottom: 40 },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, marginRight: 8,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text,
  },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, height: 52,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8, marginTop: 24,
  },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
});
