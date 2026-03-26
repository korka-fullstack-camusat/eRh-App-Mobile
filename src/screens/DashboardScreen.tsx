import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert,
  Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployee } from '@/contexts/EmployeeContext';
import { getMyLeaveBalances, getMyLeaveRequests, getLeaveTypes, createLeaveRequest } from '@/services/leaveService';
import { getMyAttendance } from '@/services/attendanceService';
import type { LeaveBalance, LeaveRequest, LeaveType } from '@/types/leave';
import type { EmployeePeriodDetailDay } from '@/types/attendance';
import { COLORS } from '@/theme';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import CamusatLogo from '@/components/CamusatLogo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DashboardScreen() {
  const { user } = useAuth();
  const { employee, isLoading: empLoading } = useEmployee();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [todayRecord, setTodayRecord] = useState<EmployeePeriodDetailDay | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [monthStats, setMonthStats] = useState({ present: 0, absent: 0, total: 0 });
  const [refreshing, setRefreshing] = useState(false);

  // Leave request modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayLabel = format(today, 'EEEE d MMMM yyyy', { locale: fr });

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }),
    ]).start();

    // Pulse animation for pointage
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
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
      const todayRec = days.find(d => d.date === todayStr) || null;
      setTodayRecord(todayRec);
      const present = days.filter(d => d.status === 'ok' || d.status === 'present').length;
      const absent = days.filter(d => d.status === 'absent').length;
      setMonthStats({ present, absent, total: days.length });
    }
    if (reqs.status === 'fulfilled') {
      const pending = reqs.value.filter((r: LeaveRequest) =>
        ['PENDING', 'PENDING_SECOND', 'PENDING_RH', 'pending'].includes(r.status)
      ).length;
      setPendingLeaves(pending);
    }
    if (types.status === 'fulfilled') setLeaveTypes(types.value);
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
  const firstName = fullName.split(' ')[0];

  // Pointage status
  const getPointageInfo = () => {
    if (!todayRecord) return { label: 'Aucun pointage', color: COLORS.textSecondary, icon: 'remove-circle-outline' as const, detail: 'Pas encore de données aujourd\'hui' };
    const s = todayRecord.status;
    if (s === 'ok' || s === 'present') return {
      label: 'Présent', color: COLORS.success, icon: 'checkmark-circle' as const,
      detail: `${todayRecord.in_time ?? '--:--'} → ${todayRecord.out_time ?? '--:--'}`,
    };
    if (s === 'absent') return { label: 'Absent', color: COLORS.danger, icon: 'close-circle' as const, detail: 'Aucun pointage enregistré' };
    return { label: 'Incomplet', color: COLORS.warning, icon: 'alert-circle' as const, detail: `Entrée: ${todayRecord.in_time ?? '--:--'}` };
  };
  const pointage = getPointageInfo();

  const handleSubmitLeave = async () => {
    if (!employee || !selectedType || !startDate || !endDate) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      Alert.alert('Erreur', 'Format de date invalide. Utilisez AAAA-MM-JJ.');
      return;
    }
    setSubmitting(true);
    try {
      await createLeaveRequest({
        employee: employee.id,
        leave_type: selectedType,
        start_date: startDate,
        end_date: endDate,
        reason,
      });
      setShowLeaveModal(false);
      resetForm();
      await loadData();
      Alert.alert('Succès', 'Votre demande de congé a été soumise.');
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.non_field_errors?.[0] || 'Erreur lors de la soumission.';
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedType(null);
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  if (empLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  const totalRemaining = balances.reduce((s, b) => s + (b.remaining_days ?? b.remaining ?? 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Animated Banner */}
        <Animated.View style={[styles.banner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.bannerTop}>
            <View style={styles.bannerLeft}>
              <Text style={styles.greeting}>Bonjour, {firstName} !</Text>
              <Text style={styles.date}>{todayLabel}</Text>
              {employee && (
                <Text style={styles.fonction}>{employee.fonction} • {employee.matricule}</Text>
              )}
            </View>
            <Animated.View style={{ transform: [{ scale: logoScale }] }}>
              <CamusatLogo size={42} showText={false} />
            </Animated.View>
          </View>
        </Animated.View>

        {/* Pointage du jour */}
        <Animated.View style={[styles.pointageCard, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.pointageHeader}>
            <Ionicons name="finger-print-outline" size={20} color={COLORS.primary} />
            <Text style={styles.pointageTitle}>Pointage du jour</Text>
          </View>
          <View style={styles.pointageBody}>
            <View style={[styles.pointageIndicator, { backgroundColor: `${pointage.color}15` }]}>
              <Ionicons name={pointage.icon} size={32} color={pointage.color} />
            </View>
            <View style={styles.pointageInfo}>
              <Text style={[styles.pointageStatus, { color: pointage.color }]}>{pointage.label}</Text>
              <Text style={styles.pointageDetail}>{pointage.detail}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Quick Stats Row */}
        <View style={styles.quickStats}>
          <View style={[styles.quickCard, { borderLeftColor: COLORS.success }]}>
            <Text style={[styles.quickValue, { color: COLORS.success }]}>{monthStats.present}</Text>
            <Text style={styles.quickLabel}>Présents</Text>
          </View>
          <View style={[styles.quickCard, { borderLeftColor: COLORS.danger }]}>
            <Text style={[styles.quickValue, { color: COLORS.danger }]}>{monthStats.absent}</Text>
            <Text style={styles.quickLabel}>Absents</Text>
          </View>
          <View style={[styles.quickCard, { borderLeftColor: COLORS.warning }]}>
            <Text style={[styles.quickValue, { color: COLORS.warning }]}>{pendingLeaves}</Text>
            <Text style={styles.quickLabel}>En attente</Text>
          </View>
        </View>

        {/* Soldes de Congés + Bouton Demande */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes soldes de congés</Text>
          <TouchableOpacity
            style={styles.requestBtn}
            onPress={() => setShowLeaveModal(true)}
          >
            <Ionicons name="add-circle" size={18} color={COLORS.white} />
            <Text style={styles.requestBtnText}>Demander</Text>
          </TouchableOpacity>
        </View>

        {/* Total remaining pill */}
        <View style={styles.totalPill}>
          <Ionicons name="leaf" size={16} color={COLORS.primary} />
          <Text style={styles.totalPillText}>{totalRemaining} jours restants au total</Text>
        </View>

        {balances.length > 0 ? (
          balances.map((b, i) => {
            const remaining = b.remaining_days ?? b.remaining ?? 0;
            const total = b.total_days ?? b.acquired ?? 0;
            const pct = total > 0 ? Math.min((remaining / total) * 100, 100) : 0;
            return (
              <View key={i} style={styles.balanceCard}>
                <View style={styles.balanceTop}>
                  <Text style={styles.balanceName}>{b.leave_type_name}</Text>
                  <View style={[styles.balancePill, pct < 20 && { backgroundColor: `${COLORS.danger}15` }]}>
                    <Text style={[styles.balancePillText, pct < 20 && { color: COLORS.danger }]}>
                      {remaining}j
                    </Text>
                  </View>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.balanceDetail}>
                  {b.used_days ?? b.taken ?? 0}j pris sur {total}j acquis
                </Text>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyBalances}>
            <Text style={styles.emptyText}>Aucun solde de congé disponible</Text>
          </View>
        )}
      </ScrollView>

      {/* Modal Demande de Congé */}
      <Modal visible={showLeaveModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouvelle demande de congé</Text>
            <TouchableOpacity onPress={() => { setShowLeaveModal(false); resetForm(); }}>
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
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-04-01"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>Date de fin * (AAAA-MM-JJ)</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2026-04-10"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>Motif</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={reason}
              onChangeText={setReason}
              placeholder="Raison de votre demande..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmitLeave}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={COLORS.white} />
                : <><Ionicons name="send" size={18} color={COLORS.white} /><Text style={styles.submitBtnText}>Soumettre la demande</Text></>
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
  scroll: { padding: 16, paddingBottom: 32 },

  // Banner
  banner: {
    backgroundColor: COLORS.primary, borderRadius: 20, padding: 20, marginBottom: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerLeft: { flex: 1 },
  greeting: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
  date: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 3, textTransform: 'capitalize' },
  fonction: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 4 },

  // Pointage
  pointageCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  pointageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  pointageTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  pointageBody: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pointageIndicator: {
    width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center',
  },
  pointageInfo: { flex: 1 },
  pointageStatus: { fontSize: 18, fontWeight: 'bold' },
  pointageDetail: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },

  // Quick Stats
  quickStats: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  quickCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 12,
    borderLeftWidth: 4, alignItems: 'center',
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  quickValue: { fontSize: 24, fontWeight: 'bold' },
  quickLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },

  // Soldes
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  requestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  requestBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  totalPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${COLORS.primary}10`, borderRadius: 12, padding: 12, marginBottom: 12,
  },
  totalPillText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  balanceCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  balanceName: { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1 },
  balancePill: {
    backgroundColor: `${COLORS.primary}12`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  balancePillText: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  progressBar: {
    height: 6, backgroundColor: COLORS.background, borderRadius: 3, overflow: 'hidden', marginBottom: 6,
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  balanceDetail: { fontSize: 12, color: COLORS.textSecondary },
  emptyBalances: { alignItems: 'center', padding: 20 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14 },

  // Modal
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  modalContent: { padding: 16, paddingBottom: 40 },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  typeChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, marginRight: 8,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  typeChipTextActive: { color: COLORS.white },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, height: 52,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24,
  },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
});
