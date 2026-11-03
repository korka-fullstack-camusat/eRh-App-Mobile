import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Animated, Modal,
  useWindowDimensions, TextInput, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployee } from '@/contexts/EmployeeContext';
import { getMyLeaveBalances, getManagerLeaves, getManagerExitAuthorizations } from '@/services/leaveService';
import type { LeaveRequest, ExitAuthorization } from '@/types/leave';
import { getMyAttendance } from '@/services/attendanceService';
import { getAvailableBulletins, requestPayslipAccess } from '@/services/employeeService';
import type { LeaveBalance } from '@/types/leave';
import type { EmployeePeriodDetailDay } from '@/types/attendance';
import { COLORS } from '@/theme';
import AppHeader from '@/components/AppHeader';
import {
  format, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, addWeeks,
} from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(val?: string | null): string {
  if (!val) return '--:--';
  const iso = val.match(/T(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const hms = val.match(/^(\d{2}):(\d{2})/);
  if (hms) return `${hms[1]}:${hms[2]}`;
  return val;
}

function minutesToHM(min?: number | null): string {
  if (min == null) return '--';
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`;
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = (firstName || '').charAt(0).toUpperCase();
  const l = (lastName || '').charAt(0).toUpperCase();
  return `${f}${l}` || '??';
}

function statusColor(status?: string): string {
  switch (status) {
    case 'ok':
    case 'present':    return COLORS.success;
    case 'absent':     return COLORS.danger;
    case 'incomplete': return '#F59E0B';
    case 'anomaly':    return '#8B5CF6';
    default:           return COLORS.border;
  }
}
function statusLabel(status?: string): string {
  switch (status) {
    case 'ok':
    case 'present':    return 'Présent';
    case 'absent':     return 'Absent';
    case 'incomplete': return 'Incomplet';
    case 'anomaly':    return 'Anomalie';
    default:           return 'Pas de service';
  }
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const insets    = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  // Facteur d'échelle : 1.0 pour 750dp de haut (iPhone 11), réduit sur petits écrans
  const vs = Math.min(1, screenH / 750);   // vertical scale
  const { user }  = useAuth();
  const { employee, isLoading: empLoading } = useEmployee();
  const navigation = useNavigation<any>();

  const [balances,       setBalances]      = useState<LeaveBalance[]>([]);
  const [allDays,        setAllDays]       = useState<EmployeePeriodDetailDay[]>([]);
  const [refreshing,     setRefreshing]    = useState(false);
  const [bulletinsCount, setBulletinsCount] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [pendingExits,  setPendingExits]  = useState<ExitAuthorization[]>([]);

  // Modal demande bulletins antérieurs
  const [requestModal,   setRequestModal]   = useState(false);
  const [reqSelected,    setReqSelected]    = useState<{ year: number; month: number }[]>([]);
  const [reqMessage,     setReqMessage]     = useState('');
  const [reqSending,     setReqSending]     = useState(false);
  const [reqSent,        setReqSent]        = useState(false);

  // Modal semaine
  const [weekModal,   setWeekModal]   = useState(false);
  const [weekOffset,  setWeekOffset]  = useState(0);          // 0 = semaine courante
  const [weekDays,    setWeekDays]    = useState<EmployeePeriodDetailDay[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);

  // Animations
  const headerFade  = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-30)).current;
  const card2Fade   = useRef(new Animated.Value(0)).current;
  const card2Slide  = useRef(new Animated.Value(40)).current;
  const card3Fade   = useRef(new Animated.Value(0)).current;
  const card3Slide  = useRef(new Animated.Value(40)).current;

  const today    = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayLabel = format(today, 'EEEE d MMMM yyyy', { locale: fr });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.timing(card2Fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(card2Slide,  { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.timing(card3Fade,   { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(card3Slide,  { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  // Chargement données du mois (pour la carte journalière)
  const loadData = useCallback(async () => {
    if (!employee) return;
    const start = format(startOfMonth(today), 'yyyy-MM-dd');
    const end   = format(endOfMonth(today),   'yyyy-MM-dd');
    const isTech = (employee.fonction || '').toUpperCase() === 'TECHNICIEN';
    const promises: Promise<any>[] = [
      getMyLeaveBalances(employee.id),
      getMyAttendance({ employee_id: employee.id, start, end }),
    ];
    if (!isTech && employee.matricule) {
      promises.push(getAvailableBulletins(employee.matricule));
    }
    const managerId = user?.employee_id ?? null;
    const isMgr = !!managerId && !!user?.roles && (user.roles.includes('manager1') || user.roles.includes('manager2') || user.roles.includes('rh'));
    if (isMgr && managerId) {
      Promise.allSettled([
        getManagerLeaves(managerId, ['PENDING', 'PENDING_SECOND', 'PENDING_RH']),
        getManagerExitAuthorizations(managerId, ['PENDING']),
      ]).then(([l, e]) => {
        setPendingLeaves(l.status === 'fulfilled' ? l.value : []);
        setPendingExits(e.status === 'fulfilled' ? e.value : []);
      });
    }
    const [bal, att, bul] = await Promise.allSettled(promises);
    if (bal.status === 'fulfilled') setBalances(bal.value);
    if (att.status === 'fulfilled') setAllDays(att.value.days ?? []);
    if (bul && bul.status === 'fulfilled') {
      setBulletinsCount(Array.isArray(bul.value) ? bul.value.length : 0);
    }
  }, [employee, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Chargement données d'une semaine (modal)
  const loadWeekData = useCallback(async (offset: number) => {
    if (!employee) return;
    setWeekLoading(true);
    const ref   = addWeeks(today, offset);
    const start = format(startOfWeek(ref, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const end   = format(endOfWeek(ref,   { weekStartsOn: 1 }), 'yyyy-MM-dd');
    try {
      const res = await getMyAttendance({ employee_id: employee.id, start, end });
      setWeekDays(res.days ?? []);
    } catch {
      setWeekDays([]);
    } finally {
      setWeekLoading(false);
    }
  }, [employee]);

  // Recharge quand le modal s'ouvre ou quand on change de semaine
  useEffect(() => {
    if (weekModal) loadWeekData(weekOffset);
  }, [weekModal, weekOffset, loadWeekData]);

  // Ouvrir le modal (réinitialise à la semaine courante)
  const openWeekModal = () => {
    setWeekOffset(0);
    setWeekModal(true);
  };

  // ── Infos employé ──
  const fullName  = employee ? `${employee.prenom} ${employee.nom}` : (user?.employee_name || user?.username || 'Employé');
  const firstName = employee?.prenom || user?.first_name || fullName.split(' ')[0];
  const lastName  = employee?.nom    || user?.last_name  || fullName.split(' ').slice(1).join(' ');
  const initials  = getInitials(firstName, lastName);
  const fonction  = employee?.fonction || '';
  const matricule = employee?.matricule || user?.employee_matricule || '';

  const isTechnicien = fonction.toUpperCase() === 'TECHNICIEN';

  // ── Pointage du jour ──
  const todayRecord = allDays.find(d => d.date === todayStr) ?? null;
  const entreeTime  = todayRecord ? fmtTime(todayRecord.in_time)  : '--:--';
  const sortieTime  = todayRecord ? fmtTime(todayRecord.out_time) : '--:--';
  const workedMin   = todayRecord?.worked_minutes ?? null;
  const todayStatus = todayRecord?.status;

  // ── Semaine affichée dans le modal ──
  const viewedWeekRef   = addWeeks(today, weekOffset);
  const viewedWeekStart = startOfWeek(viewedWeekRef, { weekStartsOn: 1 });
  const viewedWeekEnd   = endOfWeek(viewedWeekRef,   { weekStartsOn: 1 });
  const viewedDays      = eachDayOfInterval({ start: viewedWeekStart, end: viewedWeekEnd });

  // Stats résumé semaine
  const presentDays = weekDays.filter(d => d.status === 'ok' || d.status === 'present').length;
  const absentDays  = weekDays.filter(d => d.status === 'absent').length;
  const totalWorkedMin = weekDays.reduce((acc, d) => acc + (d.worked_minutes ?? 0), 0);

  // ── Solde congé annuel ──
  const annualBalance = balances.find(b =>
    (b.leave_type_code || '').toUpperCase() === 'CA' ||
    (b.leave_type_code || '').toUpperCase() === 'CP' ||
    (b.leave_type_name || '').toLowerCase().includes('annuel') ||
    (b.leave_type_name || '').toLowerCase().includes('congés payés')
  ) ?? balances[0] ?? null;
  const remainingDays = annualBalance ? (annualBalance.remaining_days ?? annualBalance.remaining ?? 0) : 0;

  // Options mois antérieurs (4 à 27 mois en arrière)
  const reqOptions = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (i + 4), 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Juin','Jul','Aoû','Sep','Oct','Nov','Déc'];

  const toggleReqMonth = (entry: { year: number; month: number }) => {
    setReqSelected(prev => {
      const exists = prev.some(e => e.year === entry.year && e.month === entry.month);
      return exists
        ? prev.filter(e => !(e.year === entry.year && e.month === entry.month))
        : [...prev, entry];
    });
  };

  const submitRequest = async () => {
    if (reqSelected.length === 0) {
      Alert.alert('Sélection requise', 'Veuillez sélectionner au moins un mois.');
      return;
    }
    setReqSending(true);
    try {
      await requestPayslipAccess({ months: reqSelected, message: reqMessage });
      setReqSent(true);
    } catch {
      Alert.alert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setReqSending(false);
    }
  };

  const closeRequestModal = () => {
    setRequestModal(false);
    setReqSelected([]);
    setReqMessage('');
    setReqSent(false);
  };

  // ── Notifications : demandes reçues par un manager ──
  // (déclaré avant pour savoir si l'accueil a de la place à remplir)
  const isManagerUser = !!user?.roles && (user.roles.includes('manager1') || user.roles.includes('manager2') || user.roles.includes('rh'));
  type Notif = { key: string; kind: 'leave' | 'exit'; title: string; sub: string; at: number };
  const dFr = (iso: string) => { try { return format(new Date(iso), 'd MMM yyyy', { locale: fr }); } catch { return iso; } };
  const notifs: Notif[] = [
    ...pendingLeaves.map(l => ({
      key: `l${l.id}`, kind: 'leave' as const,
      title: `Congé · ${l.employee?.full_name || l.employee_name || 'Employé'}`,
      sub: `${l.leave_type_name ? `${l.leave_type_name} · ` : ''}du ${dFr(l.start_date)} au ${dFr(l.end_date)}`,
      at: new Date(l.created_at).getTime() || 0,
    })),
    ...pendingExits.map(x => ({
      key: `e${x.id}`, kind: 'exit' as const,
      title: `Sortie · ${x.employee_name || 'Employé'}`,
      sub: `${x.motif} · ${dFr(x.datetime_exit)}`,
      at: new Date(x.created_at).getTime() || 0,
    })),
  ].sort((a, b) => b.at - a.at);

  const fill = !(isManagerUser && notifs.length > 0);   // pas de notification : les deux cartes occupent toute la page

  if (empLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>

      {/* ══ HEADER ══ */}
      <AppHeader
        onProfile={() => navigation.navigate('ProfileTab')}
        onChangePassword={() => navigation.navigate('ProfileTab', { screen: 'ChangePassword' })}
      />
      <Animated.View style={[styles.greetBlock, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
        <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header">
          Bonjour <Text style={styles.greetName}>{firstName}</Text> 👋
        </Text>
        <Text style={styles.dateText}>{todayLabel}</Text>
        {(fonction || matricule) && (
          <View style={styles.fonctionBadge}>
            <Text style={styles.fonctionText}>
              {fonction}{fonction && matricule ? ' · ' : ''}{matricule}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* ══ CONTENU SCROLLABLE ══ */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scroll, fill && { flexGrow: 1 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ════════════ SOLDE DE CONGÉS ════════════ */}
        <TouchableOpacity
          style={[styles.soldeCard, fill && styles.fillCard]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Solde de congés : ${Math.round(remainingDays)} jours disponibles`}
          onPress={() => navigation.navigate('LeavesTab', { mode: 'leave', ts: Date.now() })}
        >
          <View style={[styles.soldeIcon, fill && { width: 68, height: 68, borderRadius: 20 }]}><Ionicons name="sunny-outline" size={fill ? 36 : 26} color={COLORS.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.soldeLabel, fill && { fontSize: 14 }]}>Solde de congés</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
              <Text style={[styles.soldeNum, fill && { fontSize: 80, lineHeight: 88 }]}>{Math.round(remainingDays)}</Text>
              <Text style={[styles.soldeUnit, fill && { fontSize: 16, marginBottom: 14 }]}>jour(s) disponible(s)</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* ════════════ POINTAGE JOURNALIER ════════════ */}
        {!isTechnicien && (
          <View style={[styles.ptCard, fill && styles.fillCard, fill && { flex: 1.5, justifyContent: 'center' }]}>
            <View style={styles.ptCardHeader}>
              <Text style={[styles.ptCardTitle, fill && { fontSize: 18 }]}>Pointage du jour</Text>
              {todayRecord && (
                <View style={[styles.statusPill, { borderColor: statusColor(todayStatus) }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor(todayStatus) }]} />
                  <Text style={[styles.statusPillText, { color: statusColor(todayStatus) }]}>{statusLabel(todayStatus)}</Text>
                </View>
              )}
            </View>
            <View style={styles.timeBoxRow}>
              <View style={[styles.timeBox, entreeTime !== '--:--' ? styles.timeBoxActive : styles.timeBoxInactive]}>
                <Text style={styles.timeBoxLabel}>ENTRÉE</Text>
                <Text style={[styles.timeBoxValue, fill && { fontSize: 38 }, { color: entreeTime !== '--:--' ? COLORS.success : COLORS.textSecondary }]}>{entreeTime}</Text>
              </View>
              <View style={styles.timeSeparator}><Ionicons name="arrow-forward" size={18} color={COLORS.textSecondary} /></View>
              <View style={[styles.timeBox, sortieTime !== '--:--' ? styles.timeBoxActive : styles.timeBoxInactive]}>
                <Text style={styles.timeBoxLabel}>SORTIE</Text>
                <Text style={[styles.timeBoxValue, fill && { fontSize: 38 }, { color: sortieTime !== '--:--' ? COLORS.success : COLORS.textSecondary }]}>{sortieTime}</Text>
              </View>
            </View>
            <View style={styles.ptFooterRow}>
              <Text style={[styles.ptDurationText, fill && { fontSize: 15, fontWeight: '700' }]}>
                {workedMin != null ? `Travaillé : ${minutesToHM(workedMin)}` : "Aucune donnée pour aujourd'hui"}
              </Text>
            </View>
          </View>
        )}

        {/* ════════════ NOTIFICATIONS (managers) ════════════ */}
        {isManagerUser && notifs.length > 0 && (
          <>
            <View style={styles.secHead}>
              <Ionicons name="notifications-outline" size={18} color={COLORS.primary} />
              <Text style={styles.secTitle}>Notifications</Text>
              {notifs.length > 0 && (
                <View style={styles.countBadge}><Text style={styles.countBadgeText}>{notifs.length}</Text></View>
              )}
            </View>
                {notifs.slice(0, 5).map(n => (
                  <TouchableOpacity key={n.key} style={styles.row} activeOpacity={0.85} accessibilityRole="button"
                    accessibilityLabel={`${n.title}. ${n.sub}`}
                    onPress={() => navigation.navigate('ApprobationTab', { mode: n.kind, ts: Date.now() })}>
                    <View style={[styles.rowIcon, { backgroundColor: n.kind === 'leave' ? COLORS.blue100 : '#FEF3C7' }]}>
                      <Ionicons name={n.kind === 'leave' ? 'calendar-outline' : 'log-out-outline'} size={20} color={n.kind === 'leave' ? COLORS.primary : '#B45309'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{n.title}</Text>
                      <Text style={styles.rowSub} numberOfLines={2}>{n.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                ))}
                {notifs.length > 5 && (
                  <TouchableOpacity onPress={() => navigation.navigate('ApprobationTab')} style={styles.moreBtn} accessibilityRole="button">
                    <Text style={styles.moreText}>Voir les {notifs.length} demandes</Text>
                  </TouchableOpacity>
                )}
          </>
        )}
      </ScrollView>

      {/* ══ MODAL VUE HEBDOMADAIRE ══ */}
      <Modal
        visible={weekModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setWeekModal(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>

          {/* Barre de navigation semaine */}
          <View style={styles.weekNavBar}>
            <TouchableOpacity
              style={styles.weekNavArrow}
              onPress={() => setWeekOffset(o => o - 1)}
            >
              <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
            </TouchableOpacity>

            <Text style={styles.weekNavTitle}>
              {format(viewedWeekStart, 'd MMM', { locale: fr })} — {format(viewedWeekEnd, 'd MMM yyyy', { locale: fr })}
            </Text>

            <TouchableOpacity
              style={[styles.weekNavArrow, weekOffset >= 0 && styles.weekNavArrowDisabled]}
              onPress={() => { if (weekOffset < 0) setWeekOffset(o => o + 1); }}
              disabled={weekOffset >= 0}
            >
              <Ionicons name="chevron-forward" size={22} color={weekOffset >= 0 ? COLORS.border : COLORS.primary} />
            </TouchableOpacity>
          </View>

          {weekLoading ? (
            <View style={styles.weekLoadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* ── Cartes résumé ── */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.success} />
                  <Text style={styles.statValue}>{presentDays} / {viewedDays.filter(d => {
                    const ds = format(d, 'yyyy-MM-dd');
                    return ds <= format(viewedWeekEnd, 'yyyy-MM-dd') && d.getDay() !== 0 && d.getDay() !== 6;
                  }).length}</Text>
                  <Text style={styles.statLabel}>Jours présents</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="time-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.statValue}>{minutesToHM(totalWorkedMin)}</Text>
                  <Text style={styles.statLabel}>Heures travaillées</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="close-circle-outline" size={22} color={COLORS.danger} />
                  <Text style={styles.statValue}>{absentDays}</Text>
                  <Text style={styles.statLabel}>Absences</Text>
                </View>
              </View>

              {/* ── Tableau en-tête ── */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Jour</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Statut</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'center' }]}>Arrivée</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'center' }]}>Départ</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Durée</Text>
              </View>

              {/* ── Lignes jours ── */}
              {viewedDays.map(date => {
                const ds       = format(date, 'yyyy-MM-dd');
                const rec      = weekDays.find(r => r.date === ds) ?? null;
                const isToday  = ds === todayStr;
                const isFuture = date > today;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const st       = rec?.status;
                const color    = isFuture || isWeekend ? COLORS.textSecondary : statusColor(st);
                const noService = isFuture || isWeekend;

                return (
                  <View key={ds} style={[styles.tableRow, isToday && styles.tableRowToday]}>
                    {/* Indicateur couleur */}
                    <View style={[styles.tableRowStrip, { backgroundColor: noService ? 'transparent' : color }]} />

                    {/* Jour */}
                    <View style={{ flex: 2, paddingVertical: 14, paddingLeft: 6 }}>
                      <Text style={[styles.tableDayName, isToday && { color: COLORS.primary, fontWeight: '700' }]}>
                        {format(date, 'EEE d MMM', { locale: fr })}
                      </Text>
                    </View>

                    {/* Statut */}
                    <View style={{ flex: 2, justifyContent: 'center' }}>
                      {noService ? (
                        <View style={styles.noServiceBadge}>
                          <Text style={styles.noServiceText}>— Pas de service</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusBadge, { backgroundColor: color + '18' }]}>
                          <Ionicons
                            name={st === 'absent' ? 'close-circle' : st === 'incomplete' ? 'alert-circle' : 'checkmark-circle'}
                            size={13}
                            color={color}
                          />
                          <Text style={[styles.statusBadgeText, { color }]}>{statusLabel(st)}</Text>
                        </View>
                      )}
                    </View>

                    {/* Arrivée */}
                    <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'center' }]}>
                      {noService ? '' : fmtTime(rec?.in_time)}
                    </Text>

                    {/* Départ */}
                    <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'center' }]}>
                      {noService ? '' : fmtTime(rec?.out_time)}
                    </Text>

                    {/* Durée */}
                    <Text style={[styles.tableDuration, { flex: 1.5 }]}>
                      {noService ? '' : rec?.worked_minutes != null ? minutesToHM(rec.worked_minutes) : '--'}
                    </Text>
                  </View>
                );
              })}

              <View style={{ height: 24 }} />
            </ScrollView>
          )}

          {/* Bouton fermer */}
          <TouchableOpacity style={styles.modalCloseRow} onPress={() => setWeekModal(false)}>
            <Ionicons name="close" size={18} color={COLORS.white} />
            <Text style={styles.modalCloseText}>Fermer</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles (responsive — base 750 dp height / 390 dp width) ─────────────────

const styles = StyleSheet.create({
  fillCard: { flex: 1, justifyContent: 'center' },
  countBadge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' },
  countBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  moreBtn: { alignSelf: 'center', marginTop: 10, paddingVertical: 8, paddingHorizontal: 14 },
  moreText: { color: COLORS.primary, fontWeight: '800', fontSize: 14 },
  soldeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginHorizontal: 16, marginTop: 14,
    borderWidth: 4, borderColor: COLORS.primary, borderRadius: 18, backgroundColor: COLORS.white,
  },
  soldeIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.blue50, alignItems: 'center', justifyContent: 'center' },
  soldeLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  soldeNum: { fontSize: 36, fontWeight: '900', color: COLORS.primary, lineHeight: 42 },
  soldeUnit: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6 },
  secHead:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 2, marginHorizontal: 16 },
  secTitle: { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 16, marginTop: 10 },
  tile: {
    width: '48%', flexGrow: 1, minHeight: 124, padding: 12, gap: 8,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, backgroundColor: COLORS.blue50,
  },
  tileIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 14, fontWeight: '900', color: COLORS.primary, textAlign: 'center' },
  tileBadge: {
    position: 'absolute', top: 0, right: '22%', minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center',
  },
  tileBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginHorizontal: 16, marginTop: 10,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, backgroundColor: '#fff',
  },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  rowSub: { fontSize: 13, color: COLORS.text, opacity: 0.75, marginTop: 2, fontWeight: '600' },
  container:  { flex: 1, backgroundColor: COLORS.background },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1, backgroundColor: COLORS.background },
  scroll:     { flexGrow: 1, paddingTop: 4, paddingBottom: 16 },

  // ── Header ──
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  logoRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { color: COLORS.white, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  brandSub:  { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '500', letterSpacing: 1, marginTop: -2 },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.danger,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText:  { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.success,
    borderWidth: 2, borderColor: COLORS.primary,
  },
  greetBlock:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  greeting:     { color: COLORS.primary, fontSize: 24, fontWeight: '700' },
  greetName:    { fontWeight: '900' },
  dateText:     { color: COLORS.textSecondary, fontSize: 12, marginTop: 3, textTransform: 'capitalize', fontWeight: '600' },
  fonctionBadge: {
    marginTop: 10, alignSelf: 'flex-start',
    backgroundColor: COLORS.blue100,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  fonctionText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },

  // ── Labels de section ──
  sectionLabel:     { flexDirection: 'row', alignItems: 'center' },
  sectionLabelText: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1,
    marginHorizontal: 6, marginTop: 14, marginBottom: 6,
  },

  // ── Bandeau solde ──
  soldeBanner: {
    marginHorizontal: 4, marginTop: 12,
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 24, paddingHorizontal: 20,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  soldeBannerLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 8,
  },
  soldeBannerRow:  { flexDirection: 'row', alignItems: 'flex-end' },
  soldeBannerNum:  { fontSize: 52, fontWeight: '800', color: COLORS.white, lineHeight: 58 },
  soldeBannerUnit: { fontSize: 20, fontWeight: '500', color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  soldeBannerVoir: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 22, paddingVertical: 8, borderRadius: 20,
  },
  soldeBannerVoirText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  // ── Carte pointage du jour ──
  ptCard: {
    marginHorizontal: 16, marginTop: 12, borderWidth: 4, borderColor: COLORS.primary,
    backgroundColor: COLORS.white, borderRadius: 18, padding: 16,
  },
  ptCardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  ptCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ptIconWrap: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  ptCardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  timeBoxRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  timeBox: {
    flex: 1, alignItems: 'center',
    paddingVertical: 14, borderRadius: 12, borderWidth: 1.5,
  },
  timeBoxActive:   { borderColor: COLORS.success, backgroundColor: '#F0FFF4' },
  timeBoxInactive: { borderColor: COLORS.border,  backgroundColor: '#FAFAFA' },
  timeBoxLabel:    { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: COLORS.textSecondary, marginBottom: 5 },
  timeBoxValue:    { fontSize: 28, fontWeight: 'bold', letterSpacing: 0.5 },
  timeSeparator:   { paddingHorizontal: 2 },
  ptFooterRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12,
  },
  ptDurationText: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  ptWeekBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ptWeekLinkText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  // ── Statut pill ──
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
  },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: '600' },

  // ── Carte bulletins ──
  bulletinCard: {
    marginHorizontal: 4, marginTop: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5, borderColor: '#F59E0B',
    borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  bulletinCardEmpty: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border },
  bulletinIconWrap: {
    width: 42, height: 42, borderRadius: 11,
    backgroundColor: '#F59E0B',
    justifyContent: 'center', alignItems: 'center',
  },
  bulletinIconWrapEmpty: { backgroundColor: COLORS.textSecondary },
  bulletinTitle:      { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 3 },
  bulletinSub:        { fontSize: 12, color: '#B45309' },
  bulletinTitleEmpty: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 3 },
  bulletinSubEmpty:   { fontSize: 12, color: COLORS.textSecondary },
  bulletinBadge: {
    minWidth: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F59E0B',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6,
  },
  bulletinBadgeText: { color: COLORS.white, fontSize: 13, fontWeight: '800' },

  // ── Bouton demande ──
  reqBtn: {
    marginHorizontal: 4, marginTop: 8,
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 12, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border },
  reqBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },

  // ── Modal demande ──
  reqModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  reqModalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  reqModalIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center', alignItems: 'center',
  },
  reqModalTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary, flex: 1 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  reqContent:  { padding: 16, paddingBottom: 32 },
  reqHint:     { fontSize: 12, color: COLORS.textSecondary, marginBottom: 14, lineHeight: 18 },
  reqGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  reqChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  reqChipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  reqChipText:       { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  reqChipTextActive: { color: COLORS.white, fontWeight: '600' },
  reqSelectedCount:  { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 14 },
  reqFieldLabel:     { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  reqTextArea: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    padding: 12, fontSize: 14, color: COLORS.text,
    backgroundColor: COLORS.white, minHeight: 80, textAlignVertical: 'top',
    marginBottom: 20,
  },
  reqActions:    { flexDirection: 'row', gap: 10 },
  reqCancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  reqCancelText:  { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  reqSubmitBtn: {
    flex: 2, backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 13, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  reqSubmitText:  { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  reqSuccessBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  reqSuccessIcon: { marginBottom: 16 },
  reqSuccessTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  reqSuccessSub:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  reqCloseBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 13,
  },
  reqCloseBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },

  // ── Notifications (techniciens) ──
  notifSection: { marginHorizontal: 12, marginTop: 14 },
  notifSectionTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  notifEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  notifEmptyText: { fontSize: 13, color: COLORS.textSecondary },

  // ── Modal semaine ──
  modalSafe:      { flex: 1, backgroundColor: '#F8FAFC' },
  weekLoadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Barre nav semaine
  weekNavBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  weekNavArrow: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  weekNavArrowDisabled: { backgroundColor: '#F3F4F6' },
  weekNavTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary },

  // Cartes stats résumé
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 12, marginTop: 14, marginBottom: 10 },
  statCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 14,
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderWidth: 1, borderColor: COLORS.border },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 6, marginBottom: 2 },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center', fontWeight: '500' },

  // Tableau
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10, paddingHorizontal: 12,
    marginHorizontal: 12, borderRadius: 10,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 12, marginBottom: 3, borderRadius: 10,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  tableRowToday:  { backgroundColor: '#EFF6FF' },
  tableRowStrip:  { width: 4, alignSelf: 'stretch' },
  tableDayName:   { fontSize: 13, fontWeight: '500', color: COLORS.text },
  tableCell:      { fontSize: 13, color: COLORS.text, paddingVertical: 14 },
  tableDuration:  { fontSize: 13, fontWeight: '700', color: COLORS.text, textAlign: 'right', paddingRight: 12, paddingVertical: 14 },

  // Badges statut
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  noServiceBadge:  { paddingHorizontal: 6, paddingVertical: 3 },
  noServiceText:   { fontSize: 11, color: COLORS.textSecondary, fontStyle: 'italic' },

  // Bouton fermer modal
  modalCloseRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, marginHorizontal: 16, marginBottom: 10,
    borderRadius: 12, paddingVertical: 14,
  },
  modalCloseText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
});
