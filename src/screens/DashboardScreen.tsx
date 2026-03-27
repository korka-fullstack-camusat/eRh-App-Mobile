import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput,
  Alert, Animated, Dimensions,
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
import CamusatLogo from '@/components/CamusatLogo';
import {
  format, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addWeeks, subWeeks,
} from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { fr } from 'date-fns/locale';

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
  const { user } = useAuth();
  const { employee, isLoading: empLoading } = useEmployee();
  const navigation = useNavigation<any>();

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [allDays, setAllDays] = useState<EmployeePeriodDetailDay[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Weekly modal states
  const [modalWeekStart, setModalWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [modalWeekDays, setModalWeekDays] = useState<EmployeePeriodDetailDay[]>([]);
  const [modalWeekLoading, setModalWeekLoading] = useState(false);
  const [exportingWeek, setExportingWeek] = useState(false);

  // Modal states
  const [showPtModal, setShowPtModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selType, setSelType] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Animations
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-30)).current;
  const card1Fade = useRef(new Animated.Value(0)).current;
  const card1Slide = useRef(new Animated.Value(40)).current;
  const card2Fade = useRef(new Animated.Value(0)).current;
  const card2Slide = useRef(new Animated.Value(40)).current;
  const alertFade = useRef(new Animated.Value(0)).current;
  const alertSlide = useRef(new Animated.Value(40)).current;

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayLabel = format(today, 'EEEE d MMMM yyyy', { locale: fr });

  useEffect(() => {
    // Staggered entrance animations
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(headerSlide, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(card1Fade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(card1Slide, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(card2Fade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(card2Slide, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(alertFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(alertSlide, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      ]),
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
    if (att.status === 'fulfilled') setAllDays(att.value.days ?? []);
    if (reqs.status === 'fulfilled') setAllLeaves(reqs.value);
    if (types.status === 'fulfilled') setLeaveTypes(types.value);
  }, [employee]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const loadWeekData = useCallback(async (weekStart: Date) => {
    if (!employee) return;
    setModalWeekLoading(true);
    try {
      const start = format(weekStart, 'yyyy-MM-dd');
      const end = format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const result = await getMyAttendance({ employee_id: employee.id, start, end });
      setModalWeekDays(result.days ?? []);
    } catch {
      setModalWeekDays([]);
    } finally {
      setModalWeekLoading(false);
    }
  }, [employee]);

  const handleOpenPtModal = () => {
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    setModalWeekStart(currentWeekStart);
    loadWeekData(currentWeekStart);
    setShowPtModal(true);
  };

  const handleModalWeekChange = (direction: 'prev' | 'next') => {
    setModalWeekStart(prev => {
      const next = direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1);
      loadWeekData(next);
      return next;
    });
  };

  const handleExportWeekPDF = async () => {
    if (modalWeekDays.length === 0) {
      Alert.alert('Export', 'Aucune donnée à exporter.');
      return;
    }
    setExportingWeek(true);
    try {
      const employeeName = employee ? `${employee.prenom} ${employee.nom}` : 'Employé';
      const modalWeekEnd = endOfWeek(modalWeekStart, { weekStartsOn: 1 });
      const weekLabel = `${format(modalWeekStart, 'd MMM', { locale: fr })} — ${format(modalWeekEnd, 'd MMM yyyy', { locale: fr })}`;
      const statusCfgMap: Record<string, { label: string; color: string; bg: string }> = {
        ok:         { label: 'Présent',   color: '#16A34A', bg: '#DCFCE7' },
        present:    { label: 'Présent',   color: '#16A34A', bg: '#DCFCE7' },
        absent:     { label: 'Absent',    color: '#DC2626', bg: '#FEE2E2' },
        incomplete: { label: 'Incomplet', color: '#D97706', bg: '#FEF3C7' },
        anomaly:    { label: 'Anomalie',  color: '#4F46E5', bg: '#EEF2FF' },
      };
      const rows = modalWeekDays.map(d => {
        const cfg = statusCfgMap[d.status] ?? statusCfgMap.absent;
        const minToTime = (min?: number | null) => {
          if (!min && min !== 0) return '--:--';
          const h = Math.floor(Math.abs(min) / 60);
          const m = Math.abs(min) % 60;
          return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
        };
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;">${format(new Date(d.date), 'EEE', { locale: fr }).toUpperCase()}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;">${format(new Date(d.date), 'd MMM yyyy', { locale: fr })}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;"><span style="background:${cfg.bg};color:${cfg.color};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">${cfg.label}</span></td>
          <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;">${d.in_time ?? '--:--'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;">${d.out_time ?? '--:--'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;">${minToTime(d.worked_minutes)}</td>
        </tr>`;
      }).join('');
      const html = `<html><head><meta charset="utf-8"/><style>
        body{font-family:-apple-system,sans-serif;margin:0;padding:20px;color:#1A1A2E;}
        .header{background:#003C71;color:white;padding:20px;border-radius:8px;margin-bottom:20px;}
        .header h1{margin:0;font-size:20px;}.header p{margin:4px 0 0;opacity:.8;font-size:13px;}
        table{width:100%;border-collapse:collapse;font-size:12px;}
        th{background:#F5F7FA;padding:10px 12px;text-align:left;font-weight:600;color:#6C757D;text-transform:uppercase;font-size:10px;letter-spacing:.5px;}
        .footer{margin-top:20px;text-align:center;color:#6C757D;font-size:10px;border-top:1px solid #E2E8F0;padding-top:10px;}
      </style></head><body>
        <div class="header">
          <h1>Pointage hebdomadaire — CAMUSAT</h1>
          <p>${employeeName} • ${employee?.matricule ?? ''} • ${employee?.service ?? ''}</p>
          <p>Semaine : ${weekLabel}</p>
        </div>
        <table><thead><tr><th>Jour</th><th>Date</th><th>Statut</th><th>Entrée</th><th>Sortie</th><th>Durée</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="footer">Document confidentiel — CAMUSAT eRH — Généré le ${format(new Date(), 'd MMMM yyyy à HH:mm', { locale: fr })}</div>
      </body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch {
      Alert.alert('Erreur', 'Impossible de générer le PDF.');
    } finally {
      setExportingWeek(false);
    }
  };

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

  // ── Pointage ──
  const todayRecord = allDays.find(d => d.date === todayStr) ?? null;
  const getPointageStatus = () => {
    if (!todayRecord) return { label: 'Aucun pointage', color: COLORS.textSecondary, isIncomplete: false };
    const s = todayRecord.status;
    if (s === 'ok' || s === 'present') return { label: 'Complet', color: COLORS.success, isIncomplete: false };
    if (s === 'absent') return { label: 'Absent', color: COLORS.danger, isIncomplete: false };
    return { label: 'Incomplet', color: '#E8910C', isIncomplete: true };
  };
  const ptStatus = getPointageStatus();
  const entreeTime = todayRecord ? fmtTime(todayRecord.in_time) : '-- : --';
  const sortieTime = todayRecord ? fmtTime(todayRecord.out_time) : '-- : --';
  const hasEntree = entreeTime !== '-- : --';
  const hasSortie = sortieTime !== '-- : --';
  const workedDuration = todayRecord?.worked_minutes
    ? minutesToTime(todayRecord.worked_minutes)
    : (hasEntree && !hasSortie ? 'en cours...' : '--');

  // ── Semaine courante ──
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  const weekDays = allDays.filter(d => d.date >= weekStartStr && d.date <= weekEndStr);

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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════
            HEADER - Dark navy blue banner
        ══════════════════════════════════════════ */}
        <Animated.View style={[styles.header, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
          {/* Top row: Logo + Avatar */}
          <View style={styles.headerTopRow}>
            <View style={styles.logoRow}>
              <CamusatLogo size={36} showText={false} />
              <View>
                <Text style={styles.brandName}>camusat</Text>
                <Text style={styles.brandSub}>ERH</Text>
              </View>
            </View>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.onlineDot} />
            </View>
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
            POINTAGE DU JOUR
        ══════════════════════════════════════════ */}
        <Animated.View style={[styles.card, { opacity: card1Fade, transform: [{ translateY: card1Slide }] }]}>
          {/* Card header */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleRow}>
              <View style={styles.clockIconWrap}>
                <Ionicons name="time-outline" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.cardTitle}>Pointage du jour</Text>
            </View>
            <View style={[styles.statusPill, { borderColor: ptStatus.color }]}>
              <View style={[styles.statusDot, { backgroundColor: ptStatus.color }]} />
              <Text style={[styles.statusPillText, { color: ptStatus.color }]}>{ptStatus.label}</Text>
            </View>
          </View>

          {/* Entrée / Sortie boxes */}
          <View style={styles.timeBoxRow}>
            <View style={[styles.timeBox, hasEntree ? styles.timeBoxActive : styles.timeBoxInactive]}>
              <Text style={[styles.timeBoxLabel, hasEntree && { color: COLORS.success }]}>ENTRÉE</Text>
              <Text style={[styles.timeBoxValue, hasEntree ? { color: COLORS.success } : { color: COLORS.textSecondary }]}>
                {entreeTime}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={COLORS.textSecondary} style={{ marginHorizontal: 8 }} />
            <View style={[styles.timeBox, hasSortie ? styles.timeBoxActive : styles.timeBoxInactive]}>
              <Text style={[styles.timeBoxLabel, hasSortie && { color: COLORS.primary }]}>SORTIE</Text>
              <Text style={[styles.timeBoxValue, hasSortie ? { color: COLORS.primary } : { color: COLORS.textSecondary }]}>
                {sortieTime}
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.ptFooterRow}>
            <Text style={styles.ptDurationText}>Durée travaillée : {workedDuration}</Text>
            <TouchableOpacity onPress={handleOpenPtModal} style={styles.ptWeekLink}>
              <Text style={styles.ptWeekLinkText}>Voir la semaine →</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ══════════════════════════════════════════
            SOLDE DE CONGÉS
        ══════════════════════════════════════════ */}
        <Animated.View style={[styles.card, { opacity: card2Fade, transform: [{ translateY: card2Slide }] }]}>
          {/* Card header */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.clockIconWrap, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="calendar" size={18} color={COLORS.danger} />
              </View>
              <Text style={styles.cardTitle}>Solde de congés</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('LeavesTab')}>
              <Text style={styles.voirLink}>Voir →</Text>
            </TouchableOpacity>
          </View>

          {/* Balance list — same data as LeavesScreen "Mes soldes" */}
          {balances.length === 0 ? (
            <Text style={styles.noBalanceText}>Aucun solde disponible</Text>
          ) : (
            balances.map((bal, i) => {
              const remaining = bal.remaining_days ?? bal.remaining ?? 0;
              const total = bal.total_days ?? bal.acquired ?? 0;
              const used = bal.used_days ?? bal.taken ?? 0;
              const pct = total > 0 ? Math.min((remaining / total) * 100, 100) : 0;
              const isLow = pct < 20;
              return (
                <View key={i} style={[styles.miniBalanceRow, i < balances.length - 1 && styles.miniBalanceRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.miniBalanceHeader}>
                      <Text style={styles.miniBalanceName}>{bal.leave_type_name}</Text>
                      <Text style={[styles.miniBalanceRemaining, isLow && { color: COLORS.danger }]}>
                        {remaining}j restants
                      </Text>
                    </View>
                    <Text style={styles.miniBalanceSub}>{used}j pris sur {total}j acquis</Text>
                    <View style={styles.miniProgressBg}>
                      <View style={[styles.miniProgressFill, { width: `${pct}%`, backgroundColor: isLow ? COLORS.danger : COLORS.primary }]} />
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </Animated.View>

        {/* ══════════════════════════════════════════
            ALERT BANNER (when incomplete)
        ══════════════════════════════════════════ */}
        {ptStatus.isIncomplete && (
          <Animated.View style={{ opacity: alertFade, transform: [{ translateY: alertSlide }] }}>
            <TouchableOpacity style={styles.alertBanner} activeOpacity={0.8} onPress={() => setShowPtModal(true)}>
              <View style={styles.alertIconWrap}>
                <Ionicons name="notifications" size={20} color={COLORS.danger} />
              </View>
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>Pensez à pointer votre sortie</Text>
                <Text style={styles.alertSubtitle}>Votre journée est incomplète</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.danger} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      {/* ══════════════════════════════════════════
          MODAL POINTAGE HEBDOMADAIRE
      ══════════════════════════════════════════ */}
      <Modal visible={showPtModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          {/* Header: title + close */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pointage de la semaine</Text>
            <TouchableOpacity onPress={() => setShowPtModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Week navigation row */}
          <View style={styles.weekNavRow}>
            <TouchableOpacity style={styles.weekNavBtn} onPress={() => handleModalWeekChange('prev')}>
              <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.weekNavLabel}>
              {format(modalWeekStart, 'd MMM', { locale: fr })} — {format(endOfWeek(modalWeekStart, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: fr })}
            </Text>
            <TouchableOpacity
              style={styles.weekNavBtn}
              onPress={() => handleModalWeekChange('next')}
              disabled={format(modalWeekStart, 'yyyy-MM-dd') >= format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')}
            >
              <Ionicons
                name="chevron-forward" size={20}
                color={format(modalWeekStart, 'yyyy-MM-dd') >= format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd') ? COLORS.border : COLORS.primary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {modalWeekLoading ? (
              <ActivityIndicator style={{ paddingTop: 40 }} color={COLORS.primary} />
            ) : modalWeekDays.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="time-outline" size={48} color={COLORS.border} />
                <Text style={styles.emptyText}>Aucune donnée cette semaine</Text>
              </View>
            ) : (
              modalWeekDays.map((day, i) => {
                const statusCfg: Record<string, { label: string; color: string; bg: string }> = {
                  ok: { label: 'Présent', color: COLORS.success, bg: '#DCFCE7' },
                  present: { label: 'Présent', color: COLORS.success, bg: '#DCFCE7' },
                  absent: { label: 'Absent', color: COLORS.danger, bg: '#FEE2E2' },
                  incomplete: { label: 'Incomplet', color: '#E8910C', bg: '#FEF3C7' },
                  anomaly: { label: 'Anomalie', color: '#6366F1', bg: '#EEF2FF' },
                };
                const cfg = statusCfg[day.status] ?? statusCfg.absent;
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

          {/* PDF export button — fixed at bottom */}
          <TouchableOpacity style={styles.weekExportBtn} onPress={handleExportWeekPDF} disabled={exportingWeek}>
            {exportingWeek ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="download-outline" size={15} color={COLORS.white} />
                <Text style={styles.weekExportBtnText}>Télécharger en PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════
          MODAL DEMANDE DE CONGÉ
      ══════════════════════════════════════════ */}
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
            <TextInput style={styles.input} value={startDate} onChangeText={setStartDate}
              placeholder="2026-04-01" placeholderTextColor={COLORS.textSecondary} keyboardType="numbers-and-punctuation" />

            <Text style={styles.fieldLabel}>Date de fin * (AAAA-MM-JJ)</Text>
            <TextInput style={styles.input} value={endDate} onChangeText={setEndDate}
              placeholder="2026-04-10" placeholderTextColor={COLORS.textSecondary} keyboardType="numbers-and-punctuation" />

            <Text style={styles.fieldLabel}>Motif</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={reason} onChangeText={setReason}
              placeholder="Raison de votre demande..." placeholderTextColor={COLORS.textSecondary}
              multiline numberOfLines={3} />

            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit} disabled={submitting}>
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 30 },

  // ── Header ──
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
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
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 18,
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
    marginBottom: 16,
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
  noBalanceText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  miniBalanceRow: {
    paddingVertical: 10,
  },
  miniBalanceRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  miniBalanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  miniBalanceName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  miniBalanceRemaining: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  miniBalanceSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  miniProgressBg: {
    height: 5,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: 5,
    borderRadius: 3,
  },

  // ── Alert banner ──
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  alertIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
  },
  alertSubtitle: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 2,
  },

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
