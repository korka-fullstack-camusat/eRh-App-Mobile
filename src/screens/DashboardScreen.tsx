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
import {
  format, startOfMonth, endOfMonth, subMonths,
  getDate, startOfWeek, endOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import CamusatLogo from '@/components/CamusatLogo';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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
  ok:         { label: 'Présent',   color: COLORS.success,       bg: '#DCFCE7' },
  present:    { label: 'Présent',   color: COLORS.success,       bg: '#DCFCE7' },
  absent:     { label: 'Absent',    color: COLORS.danger,        bg: '#FEE2E2' },
  incomplete: { label: 'Incomplet', color: COLORS.warning,       bg: '#FEF3C7' },
  anomaly:    { label: 'Anomalie',  color: '#6366F1',            bg: '#EEF2FF' },
};

// Couleurs distinctes par type de congé
const TYPE_COLORS = [COLORS.primary, '#059669', '#7C3AED', '#EA580C', '#0891B2', '#BE185D'];

export default function DashboardScreen() {
  const { user } = useAuth();
  const { employee, isLoading: empLoading } = useEmployee();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();

  const [balances, setBalances]     = useState<LeaveBalance[]>([]);
  const [allDays, setAllDays]       = useState<EmployeePeriodDetailDay[]>([]);
  const [allLeaves, setAllLeaves]   = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Modal pointage hebdo
  const [showPtModal, setShowPtModal]   = useState(false);
  const [ptExporting, setPtExporting]   = useState(false);

  // Modal congé
  const [showModal, setShowModal]   = useState(false);
  const [selType, setSelType]       = useState<number | null>(null);
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [reason, setReason]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  const today    = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayLabel = format(today, 'EEEE d MMMM yyyy', { locale: fr });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadData = useCallback(async () => {
    if (!employee) return;
    const start = format(startOfMonth(today), 'yyyy-MM-dd');
    const end   = format(endOfMonth(today),   'yyyy-MM-dd');

    const [bal, att, reqs, types] = await Promise.allSettled([
      getMyLeaveBalances(employee.id),
      getMyAttendance({ employee_id: employee.id, start, end }),
      getMyLeaveRequests(employee.id),
      getLeaveTypes(),
    ]);

    if (bal.status   === 'fulfilled') setBalances(bal.value);
    if (att.status   === 'fulfilled') setAllDays(att.value.days ?? []);
    if (reqs.status  === 'fulfilled') setAllLeaves(reqs.value);
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

  // ── Pointage ──────────────────────────────────────────────────────────────
  const todayRecord = allDays.find(d => d.date === todayStr) ?? null;
  const getPt = () => {
    if (!todayRecord) return { label: 'Aucun pointage', color: COLORS.textSecondary, icon: 'remove-circle-outline' as const, entree: '--:--', sortie: '--:--' };
    const s = todayRecord.status;
    const entree = fmtTime(todayRecord.in_time);
    const sortie = fmtTime(todayRecord.out_time);
    if (s === 'ok' || s === 'present') return { label: 'Présent', color: COLORS.success, icon: 'checkmark-circle' as const, entree, sortie };
    if (s === 'absent')                return { label: 'Absent',  color: COLORS.danger,  icon: 'close-circle' as const,    entree, sortie };
    return { label: 'Incomplet', color: COLORS.warning, icon: 'alert-circle' as const, entree, sortie };
  };
  const pt = getPt();

  // ── Semaine courante ──────────────────────────────────────────────────────
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // lundi
  const weekEnd   = endOfWeek(today,   { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr   = format(weekEnd,   'yyyy-MM-dd');
  const weekDays = allDays.filter(d => d.date >= weekStartStr && d.date <= weekEndStr);

  // ── Soldes ────────────────────────────────────────────────────────────────
  const totalRemaining = balances.reduce((s, b) => s + (b.remaining_days ?? b.remaining ?? 0), 0);

  // Jours pris sur 3 derniers mois
  const threeMonthsAgo = format(startOfMonth(subMonths(today, 2)), 'yyyy-MM-dd');
  const monthEndStr    = format(endOfMonth(today), 'yyyy-MM-dd');
  const takenLast3 = allLeaves
    .filter(l => (l.status === 'APPROVED' || l.status === 'approved') && l.start_date <= monthEndStr && l.end_date >= threeMonthsAgo)
    .reduce((sum, l) => sum + (l.duration_days ?? 0), 0);

  const isStartOfMonth = getDate(today) <= 7;
  const fullName  = employee ? `${employee.prenom} ${employee.nom}` : user?.username || 'Employé';
  const firstName = fullName.split(' ')[0];

  // ── Export PDF pointage semaine ──────────────────────────────────────────
  const handleExportWeekPDF = async () => {
    if (weekDays.length === 0) { Alert.alert('Export', 'Aucune donnée cette semaine.'); return; }
    setPtExporting(true);
    try {
      const employeeName = employee ? `${employee.prenom} ${employee.nom}` : '';
      const rows = weekDays.map(d => {
        const cfg = STATUS_CFG[d.status] ?? STATUS_CFG.absent;
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${format(new Date(d.date), 'EEE d MMM', { locale: fr })}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;"><span style="background:${cfg.bg};color:${cfg.color};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">${cfg.label}</span></td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${fmtTime(d.in_time)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${fmtTime(d.out_time)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${minutesToTime(d.worked_minutes)}</td>
        </tr>`;
      }).join('');

      const html = `<html><head><meta charset="utf-8"/><style>
        body{font-family:-apple-system,sans-serif;margin:0;padding:20px;color:#1A1A2E;}
        .header{background:#003C71;color:white;padding:18px 20px;border-radius:8px;margin-bottom:20px;}
        .header h1{margin:0;font-size:18px;} .header p{margin:4px 0 0;opacity:.8;font-size:12px;}
        table{width:100%;border-collapse:collapse;font-size:13px;}
        th{background:#F5F7FA;padding:10px 12px;text-align:left;font-weight:600;color:#6C757D;font-size:11px;text-transform:uppercase;letter-spacing:.4px;}
        .footer{margin-top:18px;text-align:center;color:#999;font-size:10px;border-top:1px solid #eee;padding-top:10px;}
      </style></head><body>
        <div class="header">
          <h1>Pointage hebdomadaire — CAMUSAT</h1>
          <p>${employeeName} • ${employee?.matricule ?? ''} • Semaine du ${format(weekStart, 'd MMM', { locale: fr })} au ${format(weekEnd, 'd MMM yyyy', { locale: fr })}</p>
        </div>
        <table><thead><tr><th>Jour</th><th>Statut</th><th>Entrée</th><th>Sortie</th><th>Durée</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="footer">Document confidentiel — CAMUSAT eRH — ${format(new Date(), 'd MMMM yyyy', { locale: fr })}</div>
      </body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch {
      Alert.alert('Erreur', 'Impossible de générer le PDF.');
    } finally {
      setPtExporting(false);
    }
  };

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
        {/* ── Bannière pleine largeur ── */}
        <Animated.View style={[styles.banner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.bannerLeft}>
            <Text style={styles.greeting}>Bonjour, {firstName} !</Text>
            <Text style={styles.date}>{todayLabel}</Text>
            {employee && <Text style={styles.fonction}>{employee.fonction} • {employee.matricule}</Text>}
          </View>
          <CamusatLogo size={38} showText={false} />
        </Animated.View>

        {/* ── Pointage du jour → ouvre modal hebdo ── */}
        <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => setShowPtModal(true)}>
          <View style={styles.cardHeader}>
            <View style={styles.row}>
              <Ionicons name="finger-print-outline" size={17} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Pointage du jour</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${pt.color}15` }]}>
              <Ionicons name={pt.icon} size={13} color={pt.color} />
              <Text style={[styles.statusText, { color: pt.color }]}>{pt.label}</Text>
            </View>
          </View>
          <View style={styles.ptTimes}>
            <View style={styles.ptTime}>
              <Ionicons name="log-in-outline" size={15} color={COLORS.success} />
              <Text style={styles.ptLabel}>Entrée</Text>
              <Text style={[styles.ptValue, { color: pt.entree !== '--:--' ? COLORS.success : COLORS.textSecondary }]}>{pt.entree}</Text>
            </View>
            <View style={styles.ptSep} />
            <View style={styles.ptTime}>
              <Ionicons name="log-out-outline" size={15} color={COLORS.primary} />
              <Text style={styles.ptLabel}>Sortie</Text>
              <Text style={[styles.ptValue, { color: pt.sortie !== '--:--' ? COLORS.primary : COLORS.textSecondary }]}>{pt.sortie}</Text>
            </View>
            <View style={styles.ptHint}>
              <Text style={styles.ptHintText}>Voir la semaine</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textSecondary} />
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

        {/* Notif début de mois */}
        {isStartOfMonth && (
          <View style={styles.notifCard}>
            <Ionicons name="gift-outline" size={18} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>Solde mis à jour</Text>
              <Text style={styles.notifSub}>+2 jours de congé crédités ce mois</Text>
            </View>
          </View>
        )}

        {/* ── Soldes : 2 blocs côte à côte ── */}
        <View style={styles.soldesRow}>
          {/* Solde actuel — cliquable → Congés */}
          <TouchableOpacity
            style={[styles.soldeCard, styles.soldePrimary, { flex: 1 }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('LeavesTab')}
          >
            <Text style={styles.soldeLabelLight}>Solde actuel</Text>
            <Text style={styles.soldeValueBig}>{totalRemaining}</Text>
            <Text style={styles.soldeLabelLight}>jours restants</Text>
            <View style={styles.soldeLinkRow}>
              <Text style={styles.soldeLink}>Voir le détail</Text>
              <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.7)" />
            </View>
          </TouchableOpacity>

          {/* Pris sur 3 mois */}
          <View style={[styles.soldeCard, styles.soldeSecondary, { flex: 1 }]}>
            <Text style={styles.soldeLabelDark}>Pris (3 mois)</Text>
            <Text style={[styles.soldeValueBig, { color: COLORS.text }]}>{takenLast3}</Text>
            <Text style={styles.soldeLabelDark}>jours utilisés</Text>
          </View>
        </View>

        {/* ── Détail par type — cartes colorées ── */}
        {balances.length > 0 && (
          <>
            <Text style={styles.subTitle}>Détail par type de congé</Text>
            <View style={styles.typeGrid}>
              {balances.map((b, i) => {
                const rem   = b.remaining_days ?? b.remaining ?? 0;
                const total = b.total_days ?? b.acquired ?? 0;
                const used  = b.used_days ?? b.taken ?? 0;
                const color = TYPE_COLORS[i % TYPE_COLORS.length];
                return (
                  <View key={i} style={[styles.typeCard, { borderTopColor: color, width: (width - 40) / 2 }]}>
                    <Text style={[styles.typeCardDays, { color }]}>{rem}j</Text>
                    <Text style={styles.typeCardName} numberOfLines={2}>{b.leave_type_name}</Text>
                    <Text style={styles.typeCardSub}>{used}j pris / {total}j acquis</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* ════════════════════════════════════════════════════════════════
          MODAL POINTAGE HEBDOMADAIRE
      ════════════════════════════════════════════════════════════════ */}
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
                      <Text style={styles.dayTimeText}>
                        {fmtTime(day.in_time)} → {fmtTime(day.out_time)}
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
              })
            )}
          </ScrollView>

          {/* Bouton export PDF */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportWeekPDF} disabled={ptExporting}>
              {ptExporting
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <><Ionicons name="download-outline" size={16} color={COLORS.white} /><Text style={styles.exportBtnText}>Télécharger en PDF</Text></>
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════
          MODAL DEMANDE DE CONGÉ
      ════════════════════════════════════════════════════════════════ */}
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

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scroll:     { paddingBottom: 40 },   // ← pas de paddingHorizontal → pleine largeur

  // Banner
  banner: {
    backgroundColor: COLORS.primary, padding: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 8, elevation: 5,
  },
  bannerLeft:  { flex: 1, paddingRight: 10 },
  greeting:   { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
  date:       { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 3, textTransform: 'capitalize' },
  fonction:   { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 },

  // Cartes pleine largeur (padding interne uniquement)
  card: {
    backgroundColor: COLORS.white, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle:  { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Pointage
  ptTimes:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ptTime:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ptLabel:   { fontSize: 13, color: COLORS.textSecondary, width: 44 },
  ptValue:   { fontSize: 22, fontWeight: 'bold' },
  ptSep:     { width: 1, height: 32, backgroundColor: COLORS.border, marginHorizontal: 4 },
  ptHint:    { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' as any, gap: 2 },
  ptHintText: { fontSize: 11, color: COLORS.textSecondary },

  // Section header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.text },
  requestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
  },
  requestBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  // Notif
  notifCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ECFDF5', padding: 12, marginHorizontal: 16, marginBottom: 10,
    borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0',
  },
  notifTitle: { fontSize: 13, fontWeight: '700', color: '#059669' },
  notifSub:   { fontSize: 12, color: '#065F46', marginTop: 1 },

  // Soldes
  soldesRow:     { flexDirection: 'row', gap: 0, marginBottom: 12 },
  soldeCard:     { padding: 18, alignItems: 'center', justifyContent: 'center' },
  soldePrimary:  { backgroundColor: COLORS.primary },
  soldeSecondary: { backgroundColor: COLORS.white, borderLeftWidth: 1, borderLeftColor: COLORS.border },
  soldeLabelLight: { fontSize: 11, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  soldeLabelDark:  { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },
  soldeValueBig:   { fontSize: 36, fontWeight: 'bold', color: COLORS.white, marginVertical: 4 },
  soldeLinkRow:    { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 },
  soldeLink:       { fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  // Détail par type — grille
  subTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, paddingHorizontal: 16, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  typeCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    borderTopWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  typeCardDays: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  typeCardName: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  typeCardSub:  { fontSize: 11, color: COLORS.textSecondary },

  // Modal
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  modalSub:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  modalContent: { padding: 16, paddingBottom: 24 },
  modalFooter:  { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white },

  // Pointage modal rows
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
  dayWorked:   { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  dayBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 10 },
  dayBadgeText: { fontSize: 10, fontWeight: '600' },

  empty:     { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },

  exportBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, height: 50,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  exportBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },

  // Modal congé
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
