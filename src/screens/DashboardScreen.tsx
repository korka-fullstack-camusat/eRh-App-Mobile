import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployee } from '@/contexts/EmployeeContext';
import { getMyLeaveBalances, getMyLeaveRequests, getLeaveTypes, createLeaveRequest } from '@/services/leaveService';
import { getMyAttendance } from '@/services/attendanceService';
import type { LeaveBalance, LeaveRequest, LeaveType } from '@/types/leave';
import type { EmployeePeriodDetailDay } from '@/types/attendance';
import { COLORS } from '@/theme';
import { format, startOfMonth, endOfMonth, getDate } from 'date-fns';
import { fr } from 'date-fns/locale';
import CamusatLogo from '@/components/CamusatLogo';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { employee, isLoading: empLoading } = useEmployee();
  const navigation = useNavigation<any>();

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [todayRecord, setTodayRecord] = useState<EmployeePeriodDetailDay | null>(null);
  const [activeLeaves, setActiveLeaves] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Leave request modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

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
    if (reqs.status === 'fulfilled') {
      const active = reqs.value.filter((r: LeaveRequest) =>
        ['APPROVED', 'approved', 'PENDING', 'pending', 'PENDING_SECOND', 'PENDING_RH'].includes(r.status)
      );
      setActiveLeaves(active);
    }
    if (types.status === 'fulfilled') setLeaveTypes(types.value);
  }, [employee]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSubmitLeave = async () => {
    if (!employee || !selectedType || !startDate || !endDate) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      Alert.alert('Erreur', 'Format de date invalide. Utilisez AAAA-MM-JJ.');
      return;
    }
    setSubmitting(true);
    try {
      await createLeaveRequest({ employee: employee.id, leave_type: selectedType, start_date: startDate, end_date: endDate, reason });
      setShowLeaveModal(false);
      setSelectedType(null); setStartDate(''); setEndDate(''); setReason('');
      await loadData();
      Alert.alert('Succès', 'Votre demande de congé a été soumise.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.detail || 'Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  // Extrait HH:mm depuis n'importe quel format (ISO, HH:mm, etc.)
  function fmtTime(val?: string | null): string {
    if (!val) return '--:--';
    // Format ISO : 2026-03-26T07:45:01+00:00 ou 2026-03-26T07:45:01Z
    const isoMatch = val.match(/T(\d{2}):(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`;
    // Format HH:mm:ss
    const hmsMatch = val.match(/^(\d{2}):(\d{2})/);
    if (hmsMatch) return `${hmsMatch[1]}:${hmsMatch[2]}`;
    return val;
  }

  // Pointage info
  const getPointage = () => {
    if (!todayRecord) return { status: 'Aucun pointage', color: COLORS.textSecondary, icon: 'remove-circle-outline' as const, entree: '--:--', sortie: '--:--' };
    const s = todayRecord.status;
    const entree = fmtTime(todayRecord.in_time);
    const sortie = fmtTime(todayRecord.out_time);
    if (s === 'ok' || s === 'present') return { status: 'Présent', color: COLORS.success, icon: 'checkmark-circle' as const, entree, sortie };
    if (s === 'absent') return { status: 'Absent', color: COLORS.danger, icon: 'close-circle' as const, entree, sortie };
    return { status: 'Incomplet', color: COLORS.warning, icon: 'alert-circle' as const, entree, sortie };
  };
  const pt = getPointage();

  const fullName = employee ? `${employee.prenom} ${employee.nom}` : user?.username || 'Employé';
  const firstName = fullName.split(' ')[0];
  const totalRemaining = balances.reduce((s, b) => s + (b.remaining_days ?? 0), 0);

  // Congés du mois en cours (approuvés dont les dates chevauchent ce mois)
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd   = format(endOfMonth(today), 'yyyy-MM-dd');
  const leavesThisMonth = activeLeaves.filter(l =>
    (l.status === 'APPROVED' || l.status === 'approved') &&
    l.start_date <= monthEnd && l.end_date >= monthStart
  );

  // Notification début de mois (jours 1 à 7)
  const isStartOfMonth = getDate(today) <= 7;

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
        <Animated.View style={[styles.banner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.bannerLeft}>
            <Text style={styles.greeting}>Bonjour, {firstName} !</Text>
            <Text style={styles.date}>{todayLabel}</Text>
            {employee && <Text style={styles.fonction}>{employee.fonction} • {employee.matricule}</Text>}
          </View>
          <CamusatLogo size={36} showText={false} />
        </Animated.View>

        {/* Pointage du jour — cliquable vers Présences */}
        <TouchableOpacity
          style={styles.pointageCard}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('AttendanceTab')}
        >
          {/* Titre */}
          <View style={styles.pointageTop}>
            <View style={styles.pointageLeft}>
              <Ionicons name="finger-print-outline" size={18} color={COLORS.primary} />
              <Text style={styles.pointageTitle}>Pointage du jour</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.border} />
          </View>

          {/* Corps : heures à gauche, statut à droite */}
          <View style={styles.pointageBody}>
            {/* Colonne heures */}
            <View style={styles.pointageTimes}>
              <View style={styles.pointageLine}>
                <Ionicons name="log-in-outline" size={16} color={COLORS.success} />
                <Text style={styles.pointageLineLabel}>Entrée</Text>
                <Text style={[styles.pointageLineValue, { color: pt.entree !== '--:--' ? COLORS.success : COLORS.textSecondary }]}>
                  {pt.entree}
                </Text>
              </View>
              <View style={styles.pointageDivider} />
              <View style={styles.pointageLine}>
                <Ionicons name="log-out-outline" size={16} color={COLORS.primary} />
                <Text style={styles.pointageLineLabel}>Sortie</Text>
                <Text style={[styles.pointageLineValue, { color: pt.sortie !== '--:--' ? COLORS.primary : COLORS.textSecondary }]}>
                  {pt.sortie}
                </Text>
              </View>
            </View>

            {/* Statut à droite */}
            <View style={[styles.statusBadge, { backgroundColor: `${pt.color}15` }]}>
              <Ionicons name={pt.icon} size={18} color={pt.color} />
              <Text style={[styles.statusBadgeText, { color: pt.color }]}>{pt.status}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Section Congés */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes congés</Text>
          <TouchableOpacity style={styles.requestBtn} onPress={() => setShowLeaveModal(true)}>
            <Ionicons name="add" size={16} color={COLORS.white} />
            <Text style={styles.requestBtnText}>Demander</Text>
          </TouchableOpacity>
        </View>

        {/* Notification début de mois */}
        {isStartOfMonth && (
          <View style={styles.notifCard}>
            <Ionicons name="gift-outline" size={20} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>Solde mis à jour</Text>
              <Text style={styles.notifText}>+2 jours de congé crédités ce mois</Text>
            </View>
          </View>
        )}

        {/* Solde actuel */}
        <View style={styles.balancesCard}>
          {/* Total en évidence */}
          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Solde actuel</Text>
              <Text style={styles.totalValue}>{totalRemaining} jours</Text>
            </View>
            <View style={styles.totalIcon}>
              <Ionicons name="wallet-outline" size={24} color={COLORS.primary} />
            </View>
          </View>

          {/* Détail par type */}
          {balances.length > 0 && (
            <View style={styles.balancesList}>
              {balances.map((b, i) => {
                const remaining = b.remaining_days ?? 0;
                const total = b.total_days ?? 0;
                const pct = total > 0 ? Math.min((remaining / total) * 100, 100) : 0;
                return (
                  <View key={i} style={[styles.balanceRow, i < balances.length - 1 && styles.balanceRowBorder]}>
                    <Text style={styles.balanceType} numberOfLines={1}>{b.leave_type_name}</Text>
                    <View style={styles.balanceRight}>
                      <View style={styles.balanceMini}>
                        <View style={[styles.balanceMiniBar, { width: `${pct}%`, backgroundColor: pct < 20 ? COLORS.danger : COLORS.primary }]} />
                      </View>
                      <Text style={[styles.balanceDays, pct < 20 && { color: COLORS.danger }]}>{remaining}j</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Congés ce mois */}
        <View style={styles.monthLeaveCard}>
          <View style={styles.monthLeaveHeader}>
            <Ionicons name="calendar-outline" size={15} color={COLORS.textSecondary} />
            <Text style={styles.monthLeaveTitle}>
              Ce mois — {format(today, 'MMMM yyyy', { locale: fr })}
            </Text>
          </View>
          {leavesThisMonth.length > 0 ? (
            leavesThisMonth.map((leave, i) => (
              <View key={i} style={styles.leaveChip}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.leaveChipType}>{leave.leave_type_name}</Text>
                  <Text style={styles.leaveChipDates}>
                    {format(new Date(leave.start_date), 'd MMM', { locale: fr })} → {format(new Date(leave.end_date), 'd MMM', { locale: fr })} · {leave.duration_days}j
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noLeaveText}>Pas de congé ce mois</Text>
          )}
        </View>
      </ScrollView>

      {/* Modal demande de congé */}
      <Modal visible={showLeaveModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouvelle demande de congé</Text>
            <TouchableOpacity onPress={() => setShowLeaveModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Type de congé *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {leaveTypes.map(lt => (
                <TouchableOpacity
                  key={lt.id}
                  style={[styles.typeChip, selectedType === lt.id && styles.typeChipActive]}
                  onPress={() => setSelectedType(lt.id)}
                >
                  <Text style={[styles.typeChipText, selectedType === lt.id && styles.typeChipTextActive]}>
                    {lt.label || lt.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Date de début * (AAAA-MM-JJ)</Text>
            <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="2026-04-01" placeholderTextColor={COLORS.textSecondary} keyboardType="numbers-and-punctuation" />

            <Text style={styles.fieldLabel}>Date de fin * (AAAA-MM-JJ)</Text>
            <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="2026-04-10" placeholderTextColor={COLORS.textSecondary} keyboardType="numbers-and-punctuation" />

            <Text style={styles.fieldLabel}>Motif</Text>
            <TextInput style={[styles.input, styles.textarea]} value={reason} onChangeText={setReason} placeholder="Raison de votre demande..." placeholderTextColor={COLORS.textSecondary} multiline numberOfLines={3} />

            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmitLeave} disabled={submitting}>
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
  scroll: { padding: 16, paddingBottom: 40 },

  // Banner
  banner: {
    backgroundColor: COLORS.primary, borderRadius: 18, padding: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
  },
  bannerLeft: { flex: 1 },
  greeting: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
  date: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 3, textTransform: 'capitalize' },
  fonction: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 },

  // Pointage
  pointageCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  pointageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pointageLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pointageTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  pointageBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pointageTimes: { gap: 6 },
  pointageLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointageLineLabel: { fontSize: 14, color: COLORS.textSecondary, width: 50 },
  pointageLineValue: { fontSize: 22, fontWeight: 'bold' },
  pointageDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6, marginLeft: 24 },
  statusBadge: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
  },
  statusBadgeText: { fontSize: 13, fontWeight: '700' },

  // Congés
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  requestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  requestBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  // Balances card
  balancesCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  balancesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  balancesTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  totalPill: { backgroundColor: `${COLORS.primary}12`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  totalPillText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  balanceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  balanceRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.background },
  balanceType: { flex: 1, fontSize: 13, fontWeight: '500', color: COLORS.text },
  balanceRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  balanceMini: { width: 60, height: 6, backgroundColor: COLORS.background, borderRadius: 3, overflow: 'hidden' },
  balanceMiniBar: { height: '100%', borderRadius: 3 },
  balanceDays: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary, minWidth: 28, textAlign: 'right' },

  // Notification début de mois
  notifCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#ECFDF5', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  notifTitle: { fontSize: 13, fontWeight: '700', color: '#059669' },
  notifText: { fontSize: 12, color: '#065F46', marginTop: 1 },

  // Balances card
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  totalLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 2 },
  totalValue: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary },
  totalIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: `${COLORS.primary}10`, justifyContent: 'center', alignItems: 'center',
  },
  balancesList: { borderTopWidth: 1, borderTopColor: COLORS.background, paddingTop: 4 },

  // Month leaves card
  monthLeaveCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  monthLeaveHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  monthLeaveTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'capitalize' },
  leaveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  leaveChipType: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  leaveChipDates: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  noLeaveText: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic' },

  // Modal
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  modalContent: { padding: 16, paddingBottom: 40 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  typeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, marginRight: 8, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  typeChipTextActive: { color: COLORS.white },
  input: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text },
  textarea: { height: 80, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, height: 52,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24,
  },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
});
