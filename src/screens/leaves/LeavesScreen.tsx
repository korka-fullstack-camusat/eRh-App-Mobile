import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEmployee } from '@/contexts/EmployeeContext';
import {
  getMyLeaveRequests, getMyLeaveBalances, getLeaveTypes,
  createLeaveRequest, cancelLeaveRequest,
  checkHolidayDays,
} from '@/services/leaveService';
import type { LeaveRequest, LeaveBalance, LeaveType } from '@/types/leave';
import { COLORS } from '@/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as DocumentPicker from 'expo-document-picker';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'd MMM yyyy', { locale: fr }); } catch { return d; }
}
function fmtDateTime(d?: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'd MMM yyyy à HH:mm', { locale: fr }); } catch { return d; }
}
function fmtShort(d?: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy', { locale: fr }); } catch { return d; }
}

// Le backend retourne leave_type comme objet imbriqué {id, code, label}
function getLeaveTypeName(item: LeaveRequest): string {
  const lt = item.leave_type as any;
  if (lt && typeof lt === 'object') return lt.label ?? lt.name ?? '';
  return item.leave_type_name ?? '';
}
function getLeaveTypeObj(item: LeaveRequest): any {
  const lt = item.leave_type as any;
  return lt && typeof lt === 'object' ? lt : null;
}
function getBalanceLtId(b: LeaveBalance): number {
  const lt = b.leave_type as any;
  if (lt && typeof lt === 'object') return lt.id;
  return lt;
}

// Traduction erreurs backend → français lisible (identique au web)
function parseLeaveError(err: any): string {
  const data = err?.response?.data;
  const status = err?.response?.status;
  if (!data && !status) return 'Impossible de contacter le serveur. Vérifiez votre connexion.';
  const fieldMsg =
    data?.non_field_errors?.[0] ||
    data?.start_date?.[0] ||
    data?.end_date?.[0] ||
    data?.days?.[0] ||
    data?.leave_type_id?.[0] ||
    data?.employee_id?.[0] ||
    data?.detail ||
    (typeof data === 'string' ? data : null);
  if (fieldMsg) {
    if (fieldMsg.includes('existe déjà sur cette période') || fieldMsg.includes('overlap'))
      return 'Vous avez déjà une demande de congé sur cette période. Choisissez d\'autres dates.';
    if (fieldMsg.includes('jour ouvrable') || fieldMsg.includes('jours fériés'))
      return 'La période sélectionnée ne contient que des jours fériés. Veuillez choisir d\'autres dates.';
    if (fieldMsg.includes('date de fin') || fieldMsg.includes('end_date'))
      return 'La date de fin doit être égale ou postérieure à la date de début.';
    if (fieldMsg.includes('solde') || fieldMsg.includes('balance') || fieldMsg.includes('insuffisant'))
      return 'Votre solde de congés est insuffisant pour cette période.';
    if (fieldMsg.includes('préavis') || fieldMsg.includes('notice'))
      return fieldMsg;
    if (fieldMsg.includes('Authentication') || fieldMsg.includes('token') || fieldMsg.includes('credentials'))
      return 'Votre session a expiré. Veuillez vous reconnecter.';
    return fieldMsg;
  }
  if (status === 400) return 'La demande est invalide. Vérifiez les dates et le type de congé sélectionné.';
  if (status === 401 || status === 403) return 'Accès refusé. Votre session a peut-être expiré.';
  if (status === 500) return 'Une erreur serveur s\'est produite. Veuillez réessayer ou contacter l\'administrateur.';
  return 'Une erreur inattendue s\'est produite. Veuillez réessayer.';
}

// ── Status configs ────────────────────────────────────────────────────────────

const LEAVE_STATUS: Record<string, { label: string; color: string; icon: string }> = {
  PENDING:        { label: 'En attente N+1', color: '#d97706', icon: 'time-outline' },
  PENDING_SECOND: { label: '2ème validation', color: '#ea580c', icon: 'time-outline' },
  PENDING_RH:     { label: 'En attente RH',  color: '#3B82F6', icon: 'hourglass-outline' },
  APPROVED:       { label: 'Approuvé',        color: '#059669', icon: 'checkmark-circle' },
  REJECTED:       { label: 'Rejeté',          color: '#dc2626', icon: 'close-circle' },
  CANCELLED:      { label: 'Annulé',          color: '#64748b', icon: 'ban-outline' },
  REVOKED:        { label: 'Révoqué',         color: '#7c3aed', icon: 'warning-outline' },
};

function getLeaveStatus(status: string) {
  return LEAVE_STATUS[status] ?? { label: status, color: COLORS.textSecondary, icon: 'ellipse' };
}


// ── Composant Bannière erreur inline ─────────────────────────────────────────
function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-triangle" size={16} color="#dc2626" style={{ marginTop: 1 }} />
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  );
}

// ── Composant Bannière info ───────────────────────────────────────────────────
function InfoBanner({ message, color, iconName }: { message: string; color: string; iconName: string }) {
  return (
    <View style={[styles.infoBanner, { backgroundColor: `${color}12`, borderColor: `${color}30` }]}>
      <Ionicons name={iconName as any} size={15} color={color} style={{ marginTop: 1 }} />
      <Text style={[styles.infoBannerText, { color }]}>{message}</Text>
    </View>
  );
}

// ── Screen principal ──────────────────────────────────────────────────────────
export default function LeavesScreen() {
  const { employee } = useEmployee();

  // ── State congés ──
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // ── State formulaire congé ──
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [startDay, setStartDay] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endDay, setEndDay] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [endYear, setEndYear] = useState('');
  const [halfDayStart, setHalfDayStart] = useState(false);
  const [halfDayEnd, setHalfDayEnd] = useState(false);
  const [motif, setMotif] = useState('');
  const [justificationFile, setJustificationFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [calcDays, setCalcDays] = useState<number | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [holidays, setHolidays] = useState<{ name: string; date: string }[]>([]);
  const [typeBalance, setTypeBalance] = useState<LeaveBalance | null>(null);

  const startMonthRef = useRef<TextInput>(null);
  const startYearRef = useRef<TextInput>(null);
  const endDayRef = useRef<TextInput>(null);
  const endMonthRef = useRef<TextInput>(null);
  const endYearRef = useRef<TextInput>(null);


  // ── Chargement ───────────────────────────────────────────────────────────────
  const loadLeaves = useCallback(async () => {
    if (!employee) return;
    const [reqs, bals, types] = await Promise.all([
      getMyLeaveRequests(employee.id),
      getMyLeaveBalances(employee.id),
      getLeaveTypes(),
    ]);
    setRequests(reqs.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setBalances(bals);
    setLeaveTypes(types);
  }, [employee]);

  useEffect(() => {
    setLoading(true);
    loadLeaves().finally(() => setLoading(false));
  }, [loadLeaves]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeaves();
    setRefreshing(false);
  }, [loadLeaves]);

  // ── Helpers dates ─────────────────────────────────────────────────────────────
  const buildDate = (d: string, m: string, y: string) =>
    y.length === 4 && m && d ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : '';


  // ── Chargement solde quand le type change ─────────────────────────────────────
  useEffect(() => {
    setTypeBalance(null);
    if (!selectedType || !employee) return;
    const year = startYear.length === 4 ? parseInt(startYear) : new Date().getFullYear();
    getMyLeaveBalances(employee.id).then(bals => {
      const b = bals.find(bl => getBalanceLtId(bl) === selectedType);
      setTypeBalance(b ?? null);
    }).catch(() => setTypeBalance(null));
  }, [selectedType, employee, startYear]);

  // ── Durée fixe : auto-calcul date de fin ──────────────────────────────────────
  const selectedTypeObj = leaveTypes.find(lt => lt.id === selectedType) ?? null;
  const isFixedDuration = (selectedTypeObj?.min_days_per_request ?? 0) > 0 &&
    selectedTypeObj?.min_days_per_request === selectedTypeObj?.max_days_per_request;
  const fixedDays = isFixedDuration ? selectedTypeObj!.min_days_per_request! : null;

  useEffect(() => {
    if (!isFixedDuration || !fixedDays) return;
    const startDate = buildDate(startDay, startMonth, startYear);
    if (!startDate) return;
    const [y, m, d] = startDate.split('-').map(Number);
    const end = new Date(y, m - 1, d + fixedDays - 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    const endStr = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}`;
    const [ey, em, ed] = endStr.split('-');
    setEndYear(ey); setEndMonth(em); setEndDay(ed);
  }, [isFixedDuration, fixedDays, startDay, startMonth, startYear]);

  // ── Calcul jours via API holidays ────────────────────────────────────────────
  useEffect(() => {
    const startDate = buildDate(startDay, startMonth, startYear);
    const endDate   = buildDate(endDay, endMonth, endYear);
    setFormError(null);
    if (!startDate || !endDate || endDate < startDate) {
      setCalcDays(null); setHolidays([]); return;
    }
    setCalcLoading(true);
    checkHolidayDays(startDate, endDate, selectedType ?? undefined)
      .then(res => {
        // Pour les types à durée fixe, conserver la durée légale
        const days = isFixedDuration && fixedDays ? fixedDays : res.effective_days;
        setCalcDays(days);
        setHolidays(res.holidays ?? []);
      })
      .catch(() => {
        const diff = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
        setCalcDays(Math.max(1, diff));
        setHolidays([]);
      })
      .finally(() => setCalcLoading(false));
  }, [startDay, startMonth, startYear, endDay, endMonth, endYear, selectedType]);

  // ── Données dérivées (congés) ────────────────────────────────────────────────
  const availableDays = typeBalance
    ? parseFloat(String(typeBalance.remaining ?? typeBalance.remaining_days ?? 0))
    : null;
  const noticeDays = selectedTypeObj?.notice_days_required ?? 0;
  const noticeViolated = noticeDays > 0 && (() => {
    const startDate = buildDate(startDay, startMonth, startYear);
    if (!startDate) return false;
    const minStart = new Date();
    minStart.setDate(minStart.getDate() + noticeDays);
    minStart.setHours(0,0,0,0);
    return new Date(startDate) < minStart;
  })();
  const needsDocNow   = (selectedTypeObj?.requires_justification ?? false) && !(selectedTypeObj?.justification_after_leave ?? false);
  const needsDocLater = (selectedTypeObj?.requires_justification ?? false) && (selectedTypeObj?.justification_after_leave ?? false);
  const balanceShortfall = (selectedTypeObj?.deducts_from_balance !== false)
    && calcDays !== null && calcDays > 0
    && availableDays !== null
    && calcDays > availableDays;
  const maxExceeded = (selectedTypeObj?.max_days_per_request ?? 0) > 0
    && calcDays !== null && calcDays > selectedTypeObj!.max_days_per_request!;
  const minNotReached = (selectedTypeObj?.min_days_per_request ?? 0) > 0 && !isFixedDuration
    && calcDays !== null && calcDays < selectedTypeObj!.min_days_per_request!;

  const filteredRequests = requests; // on affiche les 3 dernières directement

  const annualBalance =
    balances.find(b =>
      (b.leave_type_code || '').toUpperCase() === 'CA' ||
      (b.leave_type_code || '').toUpperCase() === 'CP' ||
      (b.leave_type_name || '').toLowerCase().includes('annuel') ||
      (b.leave_type_name || '').toLowerCase().includes('congés payés')
    ) ?? balances[0];

  const leaveStats = [
    { label: 'En attente',  status: 'PENDING',  count: requests.filter(r => r.status.startsWith('PENDING')).length,  color: '#d97706' },
    { label: 'Approuvées',  status: 'APPROVED', count: requests.filter(r => r.status === 'APPROVED').length,         color: '#059669' },
    { label: 'Rejetées',    status: 'REJECTED', count: requests.filter(r => r.status === 'REJECTED').length,         color: '#dc2626' },
  ];

  // ── Reset form ───────────────────────────────────────────────────────────────
  const resetLeaveForm = () => {
    setSelectedType(null); setShowTypeDropdown(false);
    setStartDay(''); setStartMonth(''); setStartYear('');
    setEndDay(''); setEndMonth(''); setEndYear('');
    setHalfDayStart(false); setHalfDayEnd(false);
    setMotif(''); setJustificationFile(null);
    setFormError(null); setCalcDays(null); setHolidays([]);
    setTypeBalance(null);
  };


  // ── Soumission congé ─────────────────────────────────────────────────────────
  const handleSubmitLeave = async () => {
    setFormError(null);
    if (!selectedType) { setFormError('Veuillez sélectionner un type de congé.'); return; }
    const startDate = buildDate(startDay, startMonth, startYear);
    const endDate   = buildDate(endDay, endMonth, endYear);
    if (!startDate || !endDate) { setFormError('Veuillez renseigner les dates de début et de fin.'); return; }
    if (endDate < startDate)    { setFormError('La date de fin doit être égale ou postérieure à la date de début.'); return; }
    if (!calcDays || calcDays <= 0) { setFormError('Impossible de calculer la durée. Vérifiez les dates.'); return; }
    if (needsDocNow && !justificationFile) {
      setFormError('Un justificatif est obligatoire pour ce type de congé. Veuillez le joindre avant de soumettre.'); return;
    }
    if (noticeViolated) {
      setFormError(`Ce type de congé nécessite un délai de prévenance de ${noticeDays} jour(s). Choisissez une date plus tardive.`); return;
    }
    if (balanceShortfall) {
      setFormError(`Solde insuffisant — ${availableDays?.toFixed(1) ?? 0}j disponibles, ${calcDays}j demandés.`); return;
    }
    if (maxExceeded) {
      setFormError(`Ce type est limité à ${selectedTypeObj!.max_days_per_request} jour(s) par demande.`); return;
    }
    if (minNotReached) {
      setFormError(`Ce type requiert au minimum ${selectedTypeObj!.min_days_per_request} jour(s) par demande.`); return;
    }
    if (!employee) return;
    setSubmitting(true);
    try {
      await createLeaveRequest({
        employee_id:    employee.id,
        leave_type_id:  selectedType,
        start_date:     startDate,
        end_date:       endDate,
        days:           calcDays,
        motif:          motif.trim(),
        half_day_start: halfDayStart,
        half_day_end:   halfDayEnd,
        justification:  justificationFile ?? undefined,
      });
      setShowForm(false);
      resetLeaveForm();
      await loadLeaves();
      Alert.alert('Succès', 'Demande envoyée avec succès.');
    } catch (e: any) {
      setFormError(parseLeaveError(e));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Annulation congé ─────────────────────────────────────────────────────────
  const handleCancelLeave = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelLeaveRequest(cancelTarget.id);
      setCancelTarget(null);
      setSelectedLeave(null);
      await loadLeaves();
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.detail || 'Erreur lors de l\'annulation.';
      Alert.alert('Erreur', msg);
    } finally {
      setCancelling(false);
    }
  };


  // ── Justificatif ─────────────────────────────────────────────────────────────
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setJustificationFile({
          uri: result.assets[0].uri,
          name: result.assets[0].name,
          mimeType: result.assets[0].mimeType ?? 'application/octet-stream',
        });
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de sélectionner le fichier.');
    }
  };

  // ── Chaîne de validation congé ────────────────────────────────────────────────
  const renderValidationChain = (item: LeaveRequest) => {
    const emp = item.employee;
    const circleColor = {
      n1: item.reviewed_by ? '#059669' : item.status === 'PENDING' ? '#d97706' : COLORS.border,
      n2: item.second_reviewer && item.second_reviewed_at ? '#059669' : item.status === 'PENDING_SECOND' ? '#7c3aed' : COLORS.border,
      rh: item.hr_reviewer ? '#059669' : item.status === 'PENDING_RH' ? '#3B82F6' : COLORS.border,
    };
    const showN2 = !!(item.requires_second_approval || item.second_reviewer || emp?.n2_manager_id);

    return (
      <View style={styles.chainContainer}>
        <Text style={styles.chainTitle}>Chaîne de validation</Text>
        <View style={{ gap: 10 }}>
          <ChainStep
            color={circleColor.n1} label="N+1" num="1" done={!!item.reviewed_by}
            name={item.reviewed_by
              ? `${item.reviewed_by.full_name}${item.reviewed_at ? ` (${fmtDate(item.reviewed_at)})` : ''}`
              : emp?.n1_manager_name ?? 'Non défini'}
          />
          {showN2 && (
            <ChainStep
              color={circleColor.n2} label="N+2" num="2"
              done={!!(item.second_reviewer && item.second_reviewed_at)}
              name={item.second_reviewer
                ? `${item.second_reviewer.full_name}${item.second_reviewed_at ? ` (${fmtDate(item.second_reviewed_at)})` : ''}`
                : emp?.n2_manager_name ?? 'Non défini'}
            />
          )}
          <ChainStep
            color={circleColor.rh} label="RH" num={showN2 ? '3' : '2'} done={!!item.hr_reviewer}
            name={item.hr_reviewer
              ? `${item.hr_reviewer.full_name}${item.hr_reviewed_at ? ` (${fmtDate(item.hr_reviewed_at)})` : ''}`
              : 'En attente'}
          />
        </View>
        {item.status === 'REJECTED' && item.reject_reason && (
          <View style={styles.rejectBlock}>
            <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rejectTitle}>Motif du rejet</Text>
              <Text style={styles.rejectText}>{item.reject_reason}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  // ── Rendu carte congé ─────────────────────────────────────────────────────────
  const renderRequest = ({ item }: { item: LeaveRequest }) => {
    const cfg = getLeaveStatus(item.status);
    const days = parseFloat(item.days ?? String(item.duration_days)) || 0;
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => setSelectedLeave(item)}>
        <View style={[styles.cardStripe, { backgroundColor: cfg.color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardType}>{getLeaveTypeName(item)}</Text>
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
                <Text style={styles.dateText}>{fmtShort(item.start_date)} → {fmtShort(item.end_date)}</Text>
              </View>
              {item.motif ? (
                <Text style={styles.cardMotif} numberOfLines={1}>"{item.motif}"</Text>
              ) : null}
              {item.reject_reason ? (
                <View style={styles.cardRejectRow}>
                  <Ionicons name="close-circle-outline" size={11} color={COLORS.danger} />
                  <Text style={styles.cardRejectText} numberOfLines={1}>{item.reject_reason}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cardRight}>
              <View style={[styles.badge, { backgroundColor: `${cfg.color}15` }]}>
                <Ionicons name={cfg.icon as any} size={11} color={cfg.color} style={{ marginRight: 3 }} />
                <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
              <View style={styles.daysBadge}>
                <Text style={styles.daysBadgeNum}>{days}</Text>
                <Text style={styles.daysBadgeLabel}>jours</Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };


  // ─────────────────────────────── RENDER ───────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>

      {/* Ligne solde + bouton Nouvelle demande */}
      <View style={styles.soldeRow}>
        <View>
          <Text style={styles.soldeLabel}>Solde de congés</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
            <Text style={styles.soldeNum}>
              {loading ? '—' : Math.round(annualBalance?.remaining_days ?? annualBalance?.remaining ?? 0)}
            </Text>
            <Text style={styles.soldeUnit}>jours</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.newDemandBtn} onPress={() => setShowForm(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={16} color={COLORS.white} />
          <Text style={styles.newDemandBtnText}>Nouvelle demande</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          <Text style={styles.listSectionTitle}>Dernières demandes</Text>
          {requests.slice(0, 4).map(item => (
            <View key={String(item.id)} style={{ marginBottom: 10 }}>
              {renderRequest({ item })}
            </View>
          ))}
          {requests.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucune demande de congé</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ══════════════ MODAL DÉTAIL CONGÉ ══════════════ */}
      <Modal visible={!!selectedLeave} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setSelectedLeave(null)}>
        <SafeAreaView style={styles.modal}>
          {selectedLeave && (() => {
            const cfg = getLeaveStatus(selectedLeave.status);
            const days = parseFloat(selectedLeave.days ?? String(selectedLeave.duration_days)) || 0;
            const ltObj = getLeaveTypeObj(selectedLeave);
            const canCancel = ['PENDING','PENDING_SECOND','PENDING_RH'].includes(selectedLeave.status);
            return (
              <>
                <View style={[styles.modalHeaderColored, { backgroundColor: cfg.color }]}>
                  <View style={styles.modalHeaderColoredInner}>
                    <View style={styles.modalHeaderIconWrap}>
                      <Ionicons name={cfg.icon as any} size={22} color={COLORS.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalHeaderSub}>Demande de congé</Text>
                      <Text style={styles.modalHeaderTitle}>{getLeaveTypeName(selectedLeave)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedLeave(null)} style={styles.modalCloseBtn}>
                      <Ionicons name="close" size={16} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.modalStatusBadge}>
                    <View style={styles.modalStatusDot} />
                    <Text style={styles.modalStatusBadgeText}>{cfg.label}</Text>
                  </View>
                </View>

                <ScrollView contentContainerStyle={styles.detailContent}>
                  {/* Grille infos */}
                  <View style={styles.infoGrid}>
                    <InfoTile icon="calendar-outline" label="Date de début" value={fmtDate(selectedLeave.start_date)} />
                    <InfoTile icon="calendar-outline" label="Date de fin" value={fmtDate(selectedLeave.end_date)} />
                    <InfoTile icon="time-outline" label="Durée" value={`${days} jour${days > 1 ? 's' : ''}`} />
                    <InfoTile icon="send-outline" label="Soumis le" value={fmtDate(selectedLeave.created_at?.slice(0,10))} />
                    {selectedLeave.reviewed_by && (
                      <InfoTile icon="person-outline" label="Traité par" value={selectedLeave.reviewed_by.full_name} />
                    )}
                    {selectedLeave.reviewed_at && (
                      <InfoTile icon="checkmark-circle-outline" label="Traité le" value={fmtDate(selectedLeave.reviewed_at.slice(0,10))} />
                    )}
                  </View>

                  {/* Motif */}
                  <View style={styles.motifBlock}>
                    <Ionicons name="chatbubble-outline" size={14} color={COLORS.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.motifBlockLabel}>Motif</Text>
                      <Text style={styles.motifBlockText}>
                        {selectedLeave.reason || selectedLeave.motif || 'Aucun motif renseigné'}
                      </Text>
                    </View>
                  </View>

                  {/* Motif de rejet */}
                  {selectedLeave.reject_reason && (
                    <View style={styles.rejectBlock}>
                      <Ionicons name="close-circle" size={15} color={COLORS.danger} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rejectTitle}>Motif du rejet</Text>
                        <Text style={styles.rejectText}>{selectedLeave.reject_reason}</Text>
                      </View>
                    </View>
                  )}

                  {/* Approuvé par */}
                  {selectedLeave.status === 'APPROVED' && selectedLeave.reviewed_by && (
                    <View style={styles.approvedBlock}>
                      <Ionicons name="shield-checkmark" size={16} color="#059669" />
                      <Text style={styles.approvedText}>
                        Approuvé par <Text style={{ fontWeight: '700' }}>{selectedLeave.reviewed_by.full_name}</Text>
                      </Text>
                    </View>
                  )}

                  {/* Révocation */}
                  {selectedLeave.revoke_reason && (
                    <View style={[styles.rejectBlock, { backgroundColor: '#FFF7ED', borderColor: '#EA580C' }]}>
                      <Ionicons name="warning" size={15} color="#EA580C" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rejectTitle, { color: '#EA580C' }]}>Motif de révocation</Text>
                        <Text style={styles.rejectText}>{selectedLeave.revoke_reason}</Text>
                      </View>
                    </View>
                  )}

                  {/* Chaîne de validation */}
                  {renderValidationChain(selectedLeave)}

                  {/* Référence */}
                  <View style={styles.refRow}>
                    <Ionicons name="pricetag-outline" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.refText}>Référence : <Text style={{ fontWeight: '600', color: COLORS.text }}>#{selectedLeave.id}</Text></Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.detailActions}>
                    <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setSelectedLeave(null)}>
                      <Text style={styles.detailCloseBtnText}>Fermer</Text>
                    </TouchableOpacity>
                    {canCancel && (
                      <TouchableOpacity style={styles.detailCancelBtn}
                        onPress={() => { setSelectedLeave(null); setCancelTarget(selectedLeave); }}>
                        <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
                        <Text style={styles.detailCancelBtnText}>Annuler</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </>
            );
          })()}
        </SafeAreaView>
      </Modal>

      {/* ══════════════ MODAL CONFIRMATION ANNULATION CONGÉ ══════════════ */}
      <Modal visible={!!cancelTarget} animationType="fade" transparent
        onRequestClose={() => { if (!cancelling) setCancelTarget(null); }}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="trash" size={22} color={COLORS.danger} />
            </View>
            <Text style={styles.confirmTitle}>Annuler cette demande ?</Text>
            {cancelTarget && (
              <>
                <Text style={styles.confirmSubtitle}>{getLeaveTypeName(cancelTarget)}</Text>
                <Text style={styles.confirmDates}>{fmtShort(cancelTarget.start_date)} → {fmtShort(cancelTarget.end_date)}</Text>
              </>
            )}
            <View style={styles.confirmWarning}>
              <Text style={styles.confirmWarningText}>
                Cette action est irréversible. La demande passera au statut Annulé.
              </Text>
            </View>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.confirmKeepBtn}
                onPress={() => setCancelTarget(null)}
                disabled={cancelling}
              >
                <Text style={styles.confirmKeepBtnText}>Garder</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, cancelling && { opacity: 0.6 }]}
                onPress={handleCancelLeave}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <Text style={styles.confirmCancelBtnText}>Confirmer l'annulation</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════ MODAL FORMULAIRE CONGÉ ══════════════ */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => { setShowForm(false); resetLeaveForm(); }}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeaderBlue}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalHeaderBlueTitle}>Nouvelle demande de congé</Text>
              <Text style={styles.modalHeaderBlueSub}>Remplissez tous les champs obligatoires</Text>
            </View>
            <TouchableOpacity onPress={() => { setShowForm(false); resetLeaveForm(); }}>
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

            {/* ── Erreur ── */}
            {formError && <ErrorBanner message={formError} />}

            {/* ── Alerte solde insuffisant ── */}
            {balanceShortfall && !formError && (
              <InfoBanner message={`Solde insuffisant — ${availableDays?.toFixed(1) ?? 0}j disponibles, ${calcDays}j demandés.`}
                color="#dc2626" iconName="alert-circle-outline" />
            )}

            {/* ══ TYPE DE CONGÉ ══ */}
            <Text style={styles.fieldLabel}>Type de congé <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity
              style={[styles.dropdownBtn, showTypeDropdown && styles.dropdownBtnOpen]}
              onPress={() => { setFormError(null); setShowTypeDropdown(v => !v); }}
              activeOpacity={0.7}
            >
              <Text style={selectedType ? styles.dropdownBtnText : styles.dropdownBtnPlaceholder}>
                {selectedTypeObj ? `${selectedTypeObj.label}${selectedTypeObj.is_paid === false ? ' · Non payé' : ''}${selectedTypeObj.requires_justification ? ' 📎' : ''}` : '— Sélectionner un type —'}
              </Text>
              <Ionicons name={showTypeDropdown ? 'chevron-up' : 'chevron-down'} size={18}
                color={showTypeDropdown ? COLORS.primary : COLORS.textSecondary} />
            </TouchableOpacity>

            {showTypeDropdown && (
              <View style={styles.inlineDropdown}>
                {leaveTypes.length === 0
                  ? <Text style={styles.inlineDropdownEmpty}>Aucun type disponible</Text>
                  : leaveTypes.map(lt => (
                    <TouchableOpacity key={lt.id}
                      style={[styles.dropdownItem, selectedType === lt.id && styles.dropdownItemActive]}
                      onPress={() => { setSelectedType(lt.id); setShowTypeDropdown(false); setFormError(null); setEndDay(''); setEndMonth(''); setEndYear(''); }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dropdownItemLeft}>
                        <View style={[styles.radioOuter, selectedType === lt.id && { borderColor: COLORS.primary }]}>
                          {selectedType === lt.id && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.dropdownItemText, selectedType === lt.id && { color: COLORS.primary, fontWeight: '700' }]}>
                          {lt.label || lt.code}{lt.is_paid === false ? ' · Non payé' : ''}{lt.requires_justification ? ' 📎' : ''}
                        </Text>
                      </View>
                      {selectedType === lt.id && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                    </TouchableOpacity>
                  ))
                }
              </View>
            )}

            {/* Alertes type sélectionné */}
            {selectedTypeObj && (
              <View style={{ gap: 6, marginTop: 6 }}>
                {/* Congé non payé */}
                {selectedTypeObj.is_paid === false && (
                  <InfoBanner message="Ce congé est non payé — aucune indemnité ne sera versée pour cette période." color="#ea580c" iconName="cash-outline" />
                )}
                {/* Délai de prévenance */}
                {noticeDays > 0 && (
                  <InfoBanner
                    message={noticeViolated
                      ? `Date trop proche — ce type nécessite ${noticeDays} jour(s) de prévenance minimum.`
                      : `Délai de prévenance requis : ${noticeDays} jour(s) minimum avant le début.`}
                    color={noticeViolated ? '#dc2626' : '#3B82F6'}
                    iconName="calendar-outline"
                  />
                )}
                {/* Durée fixe */}
                {isFixedDuration && fixedDays && (
                  <InfoBanner message={`Durée légale fixe : ${fixedDays} jour(s). La date de fin est calculée automatiquement.`}
                    color="#7c3aed" iconName="lock-closed-outline" />
                )}
                {/* Max / min */}
                {!isFixedDuration && (selectedTypeObj.max_days_per_request ?? 0) > 0 && (
                  <InfoBanner message={`Durée maximale : ${selectedTypeObj.max_days_per_request} jour(s) par demande.`}
                    color="#3B82F6" iconName="time-outline" />
                )}
                {/* Solde disponible */}
                {availableDays !== null && selectedTypeObj.deducts_from_balance !== false && (
                  <InfoBanner message={`Solde disponible : ${availableDays.toFixed(1)} jour(s)`}
                    color="#059669" iconName="trending-up-outline" />
                )}
              </View>
            )}

            {/* ══ DATE DE DÉBUT ══ */}
            <Text style={styles.fieldLabel}>Date de début <Text style={styles.required}>*</Text></Text>
            <View style={styles.dateRow3}>
              <View style={styles.datePartWrap}>
                <TextInput style={styles.datePartInput} value={startDay}
                  onChangeText={v => { const d = v.replace(/\D/g,'').slice(0,2); setStartDay(d); if (d.length===2) startMonthRef.current?.focus(); }}
                  placeholder="JJ" placeholderTextColor={COLORS.textSecondary} keyboardType="numeric" maxLength={2} textAlign="center" />
              </View>
              <Text style={styles.dateSep}>/</Text>
              <View style={styles.datePartWrap}>
                <TextInput ref={startMonthRef} style={styles.datePartInput} value={startMonth}
                  onChangeText={v => { const m = v.replace(/\D/g,'').slice(0,2); setStartMonth(m); if (m.length===2) startYearRef.current?.focus(); }}
                  placeholder="MM" placeholderTextColor={COLORS.textSecondary} keyboardType="numeric" maxLength={2} textAlign="center" />
              </View>
              <Text style={styles.dateSep}>/</Text>
              <View style={[styles.datePartWrap, styles.datePartYear]}>
                <TextInput ref={startYearRef} style={styles.datePartInput} value={startYear}
                  onChangeText={v => { const y = v.replace(/\D/g,'').slice(0,4); setStartYear(y); if (y.length===4 && !isFixedDuration) endDayRef.current?.focus(); }}
                  placeholder="AAAA" placeholderTextColor={COLORS.textSecondary} keyboardType="numeric" maxLength={4} textAlign="center" />
              </View>
            </View>

            {/* ══ DATE DE FIN ══ */}
            <Text style={styles.fieldLabel}>
              Date de fin{' '}
              {isFixedDuration
                ? <Text style={{ color: '#7c3aed', fontSize: 11 }}>· calculée automatiquement ({fixedDays}j)</Text>
                : <Text style={styles.required}>*</Text>
              }
            </Text>
            <View style={[styles.dateRow3, isFixedDuration && { opacity: 0.6 }]}>
              <View style={[styles.datePartWrap, isFixedDuration && { backgroundColor: '#F5F3FF' }]}>
                <TextInput ref={endDayRef} style={styles.datePartInput} value={endDay}
                  editable={!isFixedDuration}
                  onChangeText={v => { const d = v.replace(/\D/g,'').slice(0,2); setEndDay(d); if (d.length===2) endMonthRef.current?.focus(); }}
                  placeholder="JJ" placeholderTextColor={COLORS.textSecondary} keyboardType="numeric" maxLength={2} textAlign="center" />
              </View>
              <Text style={styles.dateSep}>/</Text>
              <View style={[styles.datePartWrap, isFixedDuration && { backgroundColor: '#F5F3FF' }]}>
                <TextInput ref={endMonthRef} style={styles.datePartInput} value={endMonth}
                  editable={!isFixedDuration}
                  onChangeText={v => { const m = v.replace(/\D/g,'').slice(0,2); setEndMonth(m); if (m.length===2) endYearRef.current?.focus(); }}
                  placeholder="MM" placeholderTextColor={COLORS.textSecondary} keyboardType="numeric" maxLength={2} textAlign="center" />
              </View>
              <Text style={styles.dateSep}>/</Text>
              <View style={[styles.datePartWrap, styles.datePartYear, isFixedDuration && { backgroundColor: '#F5F3FF' }]}>
                <TextInput ref={endYearRef} style={styles.datePartInput} value={endYear}
                  editable={!isFixedDuration}
                  onChangeText={v => setEndYear(v.replace(/\D/g,'').slice(0,4))}
                  placeholder="AAAA" placeholderTextColor={COLORS.textSecondary} keyboardType="numeric" maxLength={4} textAlign="center" />
              </View>
            </View>

            {/* ══ RÉSUMÉ DURÉE + FÉRIÉS ══ */}
            {(calcLoading || (calcDays && calcDays > 0)) && (
              <View style={[styles.durationBox, isFixedDuration && { backgroundColor: '#F5F3FF', borderColor: '#E9D5FF' }]}>
                {calcLoading
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : <>
                      <Ionicons name={isFixedDuration ? 'lock-closed-outline' : 'calendar-outline'} size={16}
                        color={isFixedDuration ? '#7c3aed' : COLORS.primary} />
                      <Text style={[styles.durationBoxText, isFixedDuration && { color: '#7c3aed' }]}>
                        {isFixedDuration ? `Durée légale : ${fixedDays} jour(s) fixe` : `Durée : ${calcDays} jour(s)`}
                        {selectedTypeObj?.deducts_from_balance !== false
                          ? ' — prélevé(s) sur votre solde'
                          : ' — sans déduction du solde'}
                        {!isFixedDuration && holidays.length > 0
                          ? ` (${holidays.length} férié(s) exclu(s))`
                          : ''}
                      </Text>
                    </>
                }
              </View>
            )}

            {/* Avertissements durée */}
            {maxExceeded && !calcLoading && (
              <InfoBanner message={`Durée maximale dépassée : limité à ${selectedTypeObj!.max_days_per_request} jour(s) par demande.`}
                color="#dc2626" iconName="alert-circle-outline" />
            )}
            {minNotReached && !calcLoading && (
              <InfoBanner message={`Durée insuffisante : minimum ${selectedTypeObj!.min_days_per_request} jour(s) par demande.`}
                color="#d97706" iconName="warning-outline" />
            )}

            {/* Détail fériés */}
            {holidays.length > 0 && !calcLoading && (
              <View style={styles.holidayBox}>
                <Ionicons name="star" size={13} color="#d97706" />
                <Text style={styles.holidayBoxText}>
                  {holidays.length} jour(s) férié(s) dans cette période :{' '}
                  {holidays.map(h => {
                    const d = new Date(h.date + 'T12:00:00');
                    return `${h.name} (${d.getDate()}/${String(d.getMonth()+1).padStart(2,'0')})`;
                  }).join(', ')}. Ces jours ne seront pas déduits de votre solde.
                </Text>
              </View>
            )}

            {/* ══ JUSTIFICATIF ══ */}
            <Text style={styles.fieldLabel}>
              Justificatif{' '}
              {needsDocNow
                ? <Text style={styles.required}>Obligatoire *</Text>
                : needsDocLater
                ? <Text style={{ color: '#d97706', fontWeight: '400', fontSize: 11 }}>demandé après le congé</Text>
                : <Text style={styles.optional}>(optionnel)</Text>
              }
            </Text>
            {needsDocLater && (
              <InfoBanner
                message={`Un justificatif officiel vous sera demandé après votre retour. Vous pouvez déjà le joindre si vous l'avez.`}
                color="#d97706" iconName="attach-outline" />
            )}
            <TouchableOpacity
              style={[styles.uploadBtn, needsDocNow && !justificationFile && { borderColor: '#dc2626' }, justificationFile && { borderColor: '#059669', backgroundColor: '#F0FDF4' }]}
              onPress={handlePickDocument} activeOpacity={0.7}>
              <View style={styles.uploadBtnLeft}>
                <Ionicons name="attach-outline" size={20}
                  color={justificationFile ? '#059669' : needsDocNow ? '#dc2626' : COLORS.textSecondary} />
                <Text style={[styles.uploadBtnText, justificationFile && { color: '#059669' }]} numberOfLines={1}>
                  {justificationFile ? justificationFile.name : 'PDF, JPEG, PNG — max 5 Mo'}
                </Text>
              </View>
              {justificationFile
                ? <TouchableOpacity onPress={() => setJustificationFile(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                  </TouchableOpacity>
                : <Ionicons name="cloud-upload-outline" size={18} color={COLORS.textSecondary} />
              }
            </TouchableOpacity>

            {/* ══ FOOTER ══ */}
            <View style={styles.formFooter}>
              <TouchableOpacity style={styles.formCancelBtn} onPress={() => { setShowForm(false); resetLeaveForm(); }}>
                <Text style={styles.formCancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (submitting || balanceShortfall || maxExceeded || noticeViolated || (needsDocNow && !justificationFile)) && { opacity: 0.5 }]}
                onPress={handleSubmitLeave}
                disabled={submitting || !!balanceShortfall || !!maxExceeded || !!noticeViolated || (needsDocNow && !justificationFile)}
              >
                {submitting
                  ? <ActivityIndicator color={COLORS.white} />
                  : <><Ionicons name="send" size={16} color={COLORS.white} />
                    <Text style={styles.submitBtnText}>
                      {needsDocNow ? '📎 Soumettre & joindre justificatif' : '📤 Soumettre la demande'}
                    </Text></>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

// ── Sub-composants ────────────────────────────────────────────────────────────

function ChainStep({ color, label, num, done, name, pulse = false }: {
  color: string; label: string; num: string; done: boolean; name: string; pulse?: boolean;
}) {
  return (
    <View style={styles.chainRow}>
      <View style={[styles.chainCircle, { backgroundColor: color }]}>
        <Text style={styles.chainCircleText}>{done ? '✓' : num}</Text>
      </View>
      <Text style={styles.chainStepLabel}>{label}</Text>
      <Text style={styles.chainSep}>—</Text>
      <Text style={[styles.chainName, done ? styles.chainNameDone : styles.chainNamePending]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

function InfoTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoTile}>
      <Ionicons name={icon as any} size={14} color={COLORS.textSecondary} style={{ marginBottom: 4 }} />
      <Text style={styles.infoTileLabel}>{label}</Text>
      <Text style={styles.infoTileValue}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },


  // Bandeau solde congé (bleu foncé)
  // ── Ligne solde + bouton ──
  soldeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 4, marginTop: 10, marginBottom: 10,
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 18,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  soldeLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  soldeNum:   { fontSize: 34, fontWeight: '800', color: COLORS.white, lineHeight: 38 },
  soldeUnit:  { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.75)', marginBottom: 4 },
  newDemandBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  newDemandBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6,
    alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border,
  },
  statNum: { fontSize: 20, fontWeight: 'bold' },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' },

  // List
  list: { padding: 12, paddingTop: 4, gap: 10, paddingBottom: 90 },
  listSectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
  clearFilterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: `${COLORS.primary}12` },
  clearFilterText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },

  // Cards
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, flexDirection: 'row', overflow: 'hidden',
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  cardStripe: { width: 4 },
  cardBody: { flex: 1, padding: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardType: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 12, color: COLORS.textSecondary },
  cardMotif: { fontSize: 11, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 3 },
  cardRejectRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  cardRejectText: { fontSize: 11, color: COLORS.danger, flex: 1 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  daysBadge: {
    width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center',
  },
  daysBadgeNum: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  daysBadgeLabel: { fontSize: 8, color: COLORS.textSecondary, textTransform: 'uppercase' },

  // Modal
  modal: { flex: 1, backgroundColor: COLORS.background },

  // Modal header coloré (détail)
  modalHeaderColored: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  modalHeaderColoredInner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  modalHeaderIconWrap: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalHeaderSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  modalHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  modalStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.white },
  modalStatusBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },

  // Modal header bleu (formulaire)
  modalHeaderBlue: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 18,
    backgroundColor: COLORS.primary,
  },
  modalHeaderBlueTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.white },
  modalHeaderBlueSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Detail content
  detailContent: { padding: 16, paddingBottom: 40 },

  // Info grid (2 colonnes)
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  infoTile: {
    width: '47%', backgroundColor: COLORS.white, borderRadius: 12, padding: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 1,
  },
  infoTileLabel: { fontSize: 10, color: COLORS.textSecondary, textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
  infoTileValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },

  // Motif block
  motifBlock: {
    flexDirection: 'row', gap: 10, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, marginBottom: 10,
  },
  motifBlockLabel: { fontSize: 10, color: COLORS.textSecondary, textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.5, marginBottom: 3 },
  motifBlockText: { fontSize: 13, color: COLORS.text },

  // Reject / revoke
  rejectBlock: {
    flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, marginBottom: 10,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  rejectTitle: { fontSize: 11, fontWeight: '700', color: COLORS.danger, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  rejectText: { fontSize: 13, color: COLORS.text },

  // Approved
  approvedBlock: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
    borderRadius: 12, padding: 12, marginBottom: 10,
  },
  approvedText: { fontSize: 13, color: '#15803d' },

  // Ref
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 16 },
  refText: { fontSize: 12, color: COLORS.textSecondary },

  // Detail actions
  detailActions: { flexDirection: 'row', gap: 10 },
  detailCloseBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center',
  },
  detailCloseBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  detailCancelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.danger,
  },
  detailCancelBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.danger },

  // Chaîne de validation
  chainContainer: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 14, marginBottom: 12,
  },
  chainTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  chainRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chainCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chainCircleText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  chainStepLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, width: 52 },
  chainSep: { fontSize: 13, color: COLORS.textSecondary },
  chainName: { fontSize: 12, flex: 1 },
  chainNameDone: { color: '#059669', fontWeight: '600' },
  chainNamePending: { color: COLORS.textSecondary },
  chainStepBadge: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, backgroundColor: `${COLORS.primary}10`,
  },
  chainStepBadgeText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },

  // Durée calculée
  durationBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 6,
  },
  durationBoxText: { fontSize: 13, fontWeight: '600', color: COLORS.primary, flex: 1 },

  // Jours fériés
  holidayBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4,
  },
  holidayBoxText: { fontSize: 12, color: '#92400e', flex: 1, lineHeight: 18 },

  // Confirmation modal
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmBox: { backgroundColor: COLORS.white, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 },
  confirmIconWrap: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16,
  },
  confirmTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 4 },
  confirmSubtitle: { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  confirmDates: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 12 },
  confirmWarning: {
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20,
  },
  confirmWarningText: { fontSize: 12, color: '#92400e', textAlign: 'center' },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  confirmKeepBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center',
  },
  confirmKeepBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  confirmCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.danger, alignItems: 'center',
  },
  confirmCancelBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.white },

  // Form modal content
  modalContent: { padding: 16, paddingBottom: 40 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, marginTop: 18, textTransform: 'uppercase', letterSpacing: 0.5 },
  required: { color: '#EF4444', fontWeight: '400' },
  optional: { fontSize: 11, fontWeight: '400', color: COLORS.textSecondary, textTransform: 'none' },

  // Error / info banners
  errorBanner: {
    flexDirection: 'row', gap: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4,
  },
  errorBannerText: { fontSize: 13, color: '#B91C1C', flex: 1, lineHeight: 18 },
  infoBanner: {
    flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 6,
  },
  infoBannerText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // Dropdown inline
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 15,
  },
  dropdownBtnOpen: { borderColor: COLORS.primary, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  dropdownBtnText: { fontSize: 15, color: COLORS.text, flex: 1 },
  dropdownBtnPlaceholder: { fontSize: 15, color: COLORS.textSecondary, flex: 1 },
  inlineDropdown: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderTopWidth: 0,
    borderColor: COLORS.primary, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, marginBottom: 4, overflow: 'hidden',
  },
  inlineDropdownEmpty: { padding: 14, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  dropdownItemActive: { backgroundColor: '#EFF6FF' },
  dropdownItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dropdownItemText: { fontSize: 15, color: COLORS.text },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },

  // Input fields
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text,
  },
  textarea: { height: 88, textAlignVertical: 'top' },

  // Upload
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderStyle: 'dashed',
  },
  uploadBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  uploadBtnText: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },

  // Date inputs
  dateRow3: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 160 },
  datePartWrap: { flex: 1, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12 },
  datePartYear: { flex: 2 },
  datePartInput: { paddingVertical: 14, paddingHorizontal: 8, fontSize: 16, color: COLORS.text, fontWeight: '600' },
  dateSep: { fontSize: 20, color: COLORS.textSecondary, fontWeight: '300' },

  // Form footer
  formFooter: { flexDirection: 'row', gap: 10, marginTop: 28 },
  formCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center',
  },
  formCancelBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  submitBtn: {
    flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14,
  },
  submitBtnExit: { backgroundColor: '#7C3AED' },
  submitBtnText: { color: COLORS.white, fontSize: 15, fontWeight: 'bold' },
});
