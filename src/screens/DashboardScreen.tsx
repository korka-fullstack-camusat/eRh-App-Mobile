import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployee } from '@/contexts/EmployeeContext';
import {
  getMyLeaveBalances, getMyLeaveRequests,
  getLeaveTypes, createLeaveRequest,
} from '@/services/leaveService';
import { getMyAttendance } from '@/services/attendanceService';
import type { LeaveBalance } from '@/types/leave';
import type { EmployeePeriodDetailDay } from '@/types/attendance';
import { COLORS } from '@/theme';
import CamusatLogo from '@/components/CamusatLogo';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import Svg, { Circle as SvgCircle } from 'react-native-svg';

const AnimatedSvgCircle = Animated.createAnimatedComponent(SvgCircle);

function fmtTime(val?: string | null): string {
  if (!val) return '-- : --';
  const iso = val.match(/T(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const hms = val.match(/^(\d{2}):(\d{2})/);
  if (hms) return `${hms[1]}:${hms[2]}`;
  return val;
}

function minutesToTime(min?: number | null): string {
  if (!min && min !== 0) return 'en cours...';
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`;
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = (firstName || '').charAt(0).toUpperCase();
  const l = (lastName || '').charAt(0).toUpperCase();
  return `${f}${l}` || '??';
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { employee, isLoading: empLoading, bulletinsCount } = useEmployee();
  const navigation = useNavigation<any>();

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [allDays, setAllDays] = useState<EmployeePeriodDetailDay[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-30)).current;
  const card2Fade = useRef(new Animated.Value(0)).current;
  const card2Slide = useRef(new Animated.Value(40)).current;
  const card3Fade = useRef(new Animated.Value(0)).current;
  const card3Slide = useRef(new Animated.Value(40)).current;
  const circleProgress = useRef(new Animated.Value(0)).current;

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayLabel = format(today, 'EEEE d MMMM yyyy', { locale: fr });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.timing(card2Fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(card2Slide, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.timing(card3Fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(card3Slide, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

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


  // Animate circle when balances change
  useEffect(() => {
    Animated.timing(circleProgress, { toValue: 1, duration: 1000, useNativeDriver: false }).start();
  }, [balances]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ── Pointage du jour ──
  const todayRecord = allDays.find(d => d.date === todayStr) ?? null;
  const entreeTime = todayRecord ? fmtTime(todayRecord.in_time) : null;
  const sortieTime = todayRecord ? fmtTime(todayRecord.out_time) : null;
  // Alerte : l'employé a pointé son entrée mais pas sa sortie
  const showPointageAlert = !!entreeTime && !sortieTime;

  // ── Solde congé annuel ──
  const annualBalance = balances.find(b =>
    (b.leave_type_code || '').toUpperCase() === 'CA' ||
    (b.leave_type_code || '').toUpperCase() === 'CP' ||
    (b.leave_type_name || '').toLowerCase().includes('annuel') ||
    (b.leave_type_name || '').toLowerCase().includes('congés payés')
  ) ?? balances[0] ?? null;

  const remainingDays = annualBalance ? (annualBalance.remaining_days ?? annualBalance.remaining ?? 0) : 0;
  const usedDays = annualBalance ? (annualBalance.used_days ?? annualBalance.taken ?? 0) : 0;
  const totalDays = annualBalance ? (annualBalance.total_days ?? annualBalance.acquired ?? 0) : 0;
  const progressPct = totalDays > 0 ? remainingDays / totalDays : 0;

  // ── Circular progress SVG ──
  const circleSize = 70;
  const strokeWidth = 7;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, circumference * (1 - progressPct)],
  });

  const fullName = employee ? `${employee.prenom} ${employee.nom}` : (user?.employee_name || user?.username || 'Employé');
  const firstName = employee?.prenom || user?.first_name || fullName.split(' ')[0];
  const lastName = employee?.nom || user?.last_name || fullName.split(' ').slice(1).join(' ');
  const initials = getInitials(firstName, lastName);
  const fonction = employee?.fonction || '';
  const matricule = employee?.matricule || user?.employee_matricule || '';

  if (empLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* ══════════════════════════════════════════
          HEADER — fixe, couvre la status bar
      ══════════════════════════════════════════ */}
      <Animated.View style={[styles.header, { paddingTop: insets.top + 14, opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
          {/* Top row: Logo + Avatar */}
          <View style={styles.headerTopRow}>
            <View style={styles.logoRow}>
              <CamusatLogo size={36} showText={false} />
              <View>
                <Text style={styles.brandName}>camusat</Text>
                <Text style={styles.brandSub}>ERH</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.avatarContainer} onPress={() => navigation.navigate('ProfileTab')} activeOpacity={0.8}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.onlineDot} />
            </TouchableOpacity>
          </View>

          {/* Greeting */}
          <Text style={styles.greeting}>Bonjour, {firstName} 👋</Text>
          <Text style={styles.dateText}>{todayLabel}</Text>

          {/* Badge fonction + matricule */}
          {(fonction || matricule) && (
            <View style={styles.fonctionBadge}>
              <Text style={styles.fonctionText}>
                {fonction}{fonction && matricule ? ' · ' : ''}{matricule}
              </Text>
            </View>
          )}
      </Animated.View>

      {/* ══════════════════════════════════════════
          CONTENU SCROLLABLE
      ══════════════════════════════════════════ */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── SOLDE DE CONGÉS — grand bandeau ── */}
        <Animated.View style={[styles.soldeBanner, { opacity: card2Fade, transform: [{ translateY: card2Slide }] }]}>
          <Text style={styles.soldeBannerLabel}>SOLDE DISPONIBLE</Text>
          <View style={styles.soldeBannerRow}>
            <Text style={styles.soldeBannerNum}>{Math.round(remainingDays)}</Text>
            <Text style={styles.soldeBannerUnit}> jours</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('LeavesTab')} style={styles.soldeBannerVoir}>
            <Text style={styles.soldeBannerVoirText}>Voir mes congés →</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── ZONE NOTIFICATIONS ── */}
        <View style={styles.notifSection}>
          <Text style={styles.notifSectionTitle}>Notifications</Text>

          {showPointageAlert ? (
            <View style={styles.ptAlert}>
              <View style={styles.ptAlertIcon}>
                <Ionicons name="time-outline" size={22} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ptAlertTitle}>Pensez à pointer votre sortie</Text>
                <Text style={styles.ptAlertSub}>
                  Entrée enregistrée à {entreeTime} — sortie non encore saisie
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.notifEmpty}>
              <Ionicons name="checkmark-circle-outline" size={32} color={COLORS.success} />
              <Text style={styles.notifEmptyText}>Aucune notification pour le moment</Text>
            </View>
          )}
        </View>
      </ScrollView>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingBottom: 32 },

  // ── Grand bandeau solde ──
  soldeBanner: {
    marginHorizontal: 4, marginTop: 12, marginBottom: 6,
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 22, paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  soldeBannerLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8,
  },
  soldeBannerRow: { flexDirection: 'row', alignItems: 'flex-end' },
  soldeBannerNum:  { fontSize: 52, fontWeight: '800', color: COLORS.white, lineHeight: 56 },
  soldeBannerUnit: { fontSize: 20, fontWeight: '500', color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  soldeBannerVoir: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
  },
  soldeBannerVoirText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  // ── Zone notifications ──
  notifSection: { marginHorizontal: 12, marginTop: 16 },
  notifSectionTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  notifEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  notifEmptyText: { fontSize: 13, color: COLORS.textSecondary },

  // ── Alerte pointage ──
  ptAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#FDE68A',
    borderRadius: 14, padding: 16,
  },
  ptAlertIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center',
  },
  ptAlertTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 3 },
  ptAlertSub:   { fontSize: 12, color: '#B45309' },

  // ── Header ──
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
    marginTop: -2,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: COLORS.success,
    borderWidth: 2.5,
    borderColor: COLORS.primary,
  },
  greeting: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: 'bold',
  },
  dateText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  fonctionBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  fonctionText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Cards ──
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clockIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  voirLink: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // ── Time boxes ──
  timeBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  timeBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  timeBoxActive: {
    borderColor: COLORS.success,
    backgroundColor: '#F0FFF4',
  },
  timeBoxInactive: {
    borderColor: COLORS.border,
    backgroundColor: '#FAFAFA',
  },
  timeBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  timeBoxValue: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // ── Pointage footer ──
  ptFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  ptDurationText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  ptWeekLink: {},
  ptWeekLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // ── Congés section ──
  congesRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  circleContainer: {
    position: 'relative', width: 70, height: 70,
    justifyContent: 'center', alignItems: 'center',
  },
  circleTextWrap: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  circleValue: { fontSize: 22, fontWeight: 'bold', color: COLORS.success },
  congesInfo: { flex: 1 },
  congesLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  congesDetail: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  congesTypeName: { fontSize: 11, color: COLORS.textSecondary, fontStyle: 'italic', marginBottom: 6 },
  progressBarBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: COLORS.success, borderRadius: 3 },

  // ── Toast glissant ──
  toast: {
    position: 'absolute', left: 16, right: 16, zIndex: 999,
  },
  toastInner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.danger, borderRadius: 14, padding: 14,
    shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  toastIconWrap: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  toastTitle: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  toastSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  // ── Modal ──
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  modalSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  modalContent: { padding: 16, paddingBottom: 24 },

  // ── Week navigation ──
  weekNavRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 10,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  weekNavBtn: { padding: 8 },
  weekNavLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  weekExportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, marginHorizontal: 16, marginVertical: 10,
    borderRadius: 10, paddingVertical: 10,
  },
  weekExportBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  // ── Week modal rows ──
  dayRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12, marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  dayStrip: { width: 4, alignSelf: 'stretch' },
  dayDateCol: { width: 56, padding: 12, alignItems: 'center' },
  dayWeekday: { fontSize: 10, color: COLORS.textSecondary },
  dayNum: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  dayTimesCol: { flex: 1, paddingVertical: 12 },
  dayTimeText: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  dayWorked: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  dayBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 10 },
  dayBadgeText: { fontSize: 10, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },

  // ── Formulaire congé ──
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, marginRight: 8, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  input: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, height: 52,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24,
  },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },

});
