import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEmployee } from '@/contexts/EmployeeContext';
import {
  getMyLeaveRequests, getMyLeaveBalances,
  getLeaveTypes, createLeaveRequest, cancelLeaveRequest,
  getApprovalChain,
} from '@/services/leaveService';
import type { LeaveRequest, LeaveBalance, LeaveType, LeaveStatus, ApprovalChain } from '@/types/leave';
import { COLORS } from '@/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as DocumentPicker from 'expo-document-picker';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  PENDING:        { label: 'En attente N+1', color: '#F59E0B', icon: 'time-outline' },
  PENDING_SECOND: { label: 'En attente N+2', color: '#8B5CF6', icon: 'time-outline' },
  PENDING_RH:     { label: 'En attente RH',  color: '#3B82F6', icon: 'hourglass-outline' },
  APPROVED:       { label: 'Approuvé',        color: COLORS.success, icon: 'checkmark-circle' },
  REJECTED:       { label: 'Rejeté',          color: COLORS.danger, icon: 'close-circle' },
  CANCELLED:      { label: 'Annulé',          color: COLORS.textSecondary, icon: 'ban-outline' },
  REVOKED:        { label: 'Révoqué',         color: '#EA580C', icon: 'warning-outline' },
  // Lowercase fallbacks
  pending:        { label: 'En attente', color: '#F59E0B', icon: 'time-outline' },
  approved:       { label: 'Approuvé',   color: COLORS.success, icon: 'checkmark-circle' },
  rejected:       { label: 'Rejeté',     color: COLORS.danger, icon: 'close-circle' },
  cancelled:      { label: 'Annulé',     color: COLORS.textSecondary, icon: 'ban-outline' },
};

function fmtDate(d: string) {
  try { return format(new Date(d), 'd MMM yyyy', { locale: fr }); } catch { return d; }
}
function fmtDateTime(d?: string) {
  if (!d) return '';
  try { return format(new Date(d), 'd MMM yyyy à HH:mm', { locale: fr }); } catch { return d; }
}

export default function LeavesScreen() {
  const { employee } = useEmployee();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Detail modal
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [approvalChain, setApprovalChain] = useState<ApprovalChain | null>(null);
  const [chainLoading, setChainLoading] = useState(false);

  // Create modal
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [startDay, setStartDay] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endDay, setEndDay] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [endYear, setEndYear] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [reason, setReason] = useState('');
  const [justificationFile, setJustificationFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const startMonthRef = useRef<TextInput>(null);
  const startYearRef = useRef<TextInput>(null);
  const endDayRef = useRef<TextInput>(null);
  const endMonthRef = useRef<TextInput>(null);
  const endYearRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    if (!employee) return;
    try {
      const [reqs, bals, types] = await Promise.all([
        getMyLeaveRequests(employee.id),
        getMyLeaveBalances(employee.id),
        getLeaveTypes(),
      ]);
      setRequests(reqs);
      setBalances(bals);
      setLeaveTypes(types);
    } catch { /* keep stale data */ }
  }, [employee]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleSubmit = async () => {
    const startDate = startYear && startMonth && startDay
      ? `${startYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`
      : '';
    const endDate = endYear && endMonth && endDay
      ? `${endYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`
      : '';
    if (!employee || !selectedType || !startDate || !endDate) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSubmitting(true);
    try {
      await createLeaveRequest({
        employee: employee.id, leave_type: selectedType,
        start_date: startDate, end_date: endDate, reason,
        justification: justificationFile ?? undefined,
      });
      setShowForm(false);
      setSelectedType(null);
      setStartDay(''); setStartMonth(''); setStartYear('');
      setEndDay(''); setEndMonth(''); setEndYear('');
      setReason(''); setJustificationFile(null);
      await load();
      Alert.alert('Succès', 'Demande de congé soumise avec succès.');
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.non_field_errors?.[0] || 'Erreur lors de la soumission.';
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (item: LeaveRequest) => {
    setSelectedLeave(item);
    setApprovalChain(null);
    setChainLoading(true);
    try {
      const chain = await getApprovalChain(item.employee);
      setApprovalChain(chain);
    } catch { /* ignore */ }
    finally { setChainLoading(false); }
  };

  const handleCancel = (item: LeaveRequest) => {
    Alert.alert('Annuler la demande', 'Confirmer l\'annulation ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler', style: 'destructive',
        onPress: async () => {
          try {
            await cancelLeaveRequest(item.id);
            setSelectedLeave(null);
            await load();
          } catch {
            Alert.alert('Erreur', 'Impossible d\'annuler cette demande.');
          }
        },
      },
    ]);
  };

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

  const getStatusCfg = (status: string) =>
    STATUS_CONFIG[status] ?? { label: status, color: COLORS.textSecondary, icon: 'ellipse' };

  // Arborescence de validation complète
  const renderValidationChain = (item: LeaveRequest) => {
    const isRejected = item.status === 'REJECTED' || item.status === 'rejected';
    const isRevoked  = item.status === 'REVOKED';
    const isFinal    = item.status === 'APPROVED' || item.status === 'approved' || isRejected || isRevoked || item.status === 'CANCELLED';

    // Build merged steps: chain steps (approbateurs nommés) + état actuel
    type Step = {
      label: string;
      approverName?: string | null;
      isOnLeave?: boolean;
      done: boolean;
      active: boolean;
      rejected: boolean;
      reviewer?: string;
      reviewDate?: string;
    };

    const steps: Step[] = [];

    if (approvalChain) {
      // Étapes issues de la hiérarchie réelle
      approvalChain.steps.forEach((s) => {
        const levelLabel = s.level === 'DG'
          ? 'Directeur Général'
          : s.level === 'N+1'
            ? 'Responsable N+1'
            : s.level === 'N+2'
              ? 'Responsable N+2'
              : s.level;

        const isDone  = s.level === 'N+1' ? !!item.reviewed_at
                      : s.level === 'N+2' ? !!item.second_reviewed_at
                      : s.level === 'DG'  ? (!!item.reviewed_at && item.status !== 'PENDING')
                      : false;
        const isActive = s.level === 'N+1' ? (item.status === 'PENDING' || item.status === 'pending')
                       : s.level === 'N+2' ? item.status === 'PENDING_SECOND'
                       : s.level === 'DG'  ? (item.status === 'PENDING' || item.status === 'pending')
                       : false;

        steps.push({
          label: levelLabel,
          approverName: s.approver_name,
          isOnLeave: s.is_on_leave,
          done: isDone,
          active: isActive && !isRejected,
          rejected: isRejected && isActive,
          reviewer: s.level === 'N+1' ? item.reviewed_by
                  : s.level === 'N+2' ? item.second_reviewer
                  : undefined,
          reviewDate: s.level === 'N+1' ? item.reviewed_at
                    : s.level === 'N+2' ? item.second_reviewed_at
                    : undefined,
        });
      });
    } else {
      // Fallback sans chaîne chargée
      steps.push({
        label: 'Responsable N+1',
        done: !!item.reviewed_at,
        active: (item.status === 'PENDING' || item.status === 'pending') && !isRejected,
        rejected: isRejected && (item.status === 'PENDING' || item.status === 'pending'),
        reviewer: item.reviewed_by,
        reviewDate: item.reviewed_at,
      });
      if (item.second_reviewed_at || item.status === 'PENDING_SECOND') {
        steps.push({
          label: 'Responsable N+2',
          done: !!item.second_reviewed_at,
          active: item.status === 'PENDING_SECOND' && !isRejected,
          rejected: isRejected && item.status === 'PENDING_SECOND',
          reviewer: item.second_reviewer,
          reviewDate: item.second_reviewed_at,
        });
      }
    }

    // Toujours ajouter RH en dernier
    steps.push({
      label: 'Validation RH',
      approverName: undefined,
      done: !!item.hr_reviewed_at,
      active: item.status === 'PENDING_RH' && !isRejected,
      rejected: isRejected && item.status === 'PENDING_RH',
      reviewer: item.hr_reviewer,
      reviewDate: item.hr_reviewed_at,
    });

    return (
      <View style={styles.chainContainer}>
        <View style={styles.chainTitleRow}>
          <Ionicons name="git-branch-outline" size={16} color={COLORS.primary} />
          <Text style={styles.chainTitle}>Arborescence de validation</Text>
          {chainLoading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 6 }} />}
        </View>

        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          let dotColor = COLORS.border;
          let dotIcon: string = 'ellipse-outline';
          if (step.done)     { dotColor = COLORS.success; dotIcon = 'checkmark-circle'; }
          else if (step.active)   { dotColor = '#F59E0B';      dotIcon = 'time'; }
          else if (step.rejected) { dotColor = COLORS.danger;  dotIcon = 'close-circle'; }
          else if (isFinal && !step.done) { dotColor = COLORS.border; dotIcon = 'remove-circle-outline'; }

          return (
            <View key={i} style={styles.chainStep}>
              <View style={styles.chainDotCol}>
                <Ionicons name={dotIcon as any} size={22} color={dotColor} />
                {!isLast && (
                  <View style={[styles.chainLine, { backgroundColor: step.done ? COLORS.success : COLORS.border }]} />
                )}
              </View>
              <View style={styles.chainInfo}>
                <View style={styles.chainLabelRow}>
                  <Text style={[
                    styles.chainLabel,
                    step.active  && { color: '#F59E0B', fontWeight: '700' },
                    step.done    && { color: COLORS.success },
                    step.rejected && { color: COLORS.danger },
                  ]}>
                    {step.label}
                  </Text>
                  {step.isOnLeave && (
                    <View style={styles.onLeaveBadge}>
                      <Text style={styles.onLeaveBadgeText}>En congé</Text>
                    </View>
                  )}
                </View>

                {/* Nom de l'approbateur (arborescence) */}
                {step.approverName && !step.done && (
                  <Text style={styles.chainApproverName}>
                    <Ionicons name="person-outline" size={11} color={COLORS.textSecondary} /> {step.approverName}
                  </Text>
                )}

                {/* Validé par */}
                {step.done && step.reviewer && (
                  <Text style={styles.chainReviewer}>
                    {step.reviewer}{step.reviewDate ? ` — ${fmtDateTime(step.reviewDate)}` : ''}
                  </Text>
                )}

                {/* En attente */}
                {step.active && !step.done && (
                  <Text style={styles.chainWaiting}>En attente de validation...</Text>
                )}

                {/* Rejeté */}
                {step.rejected && (
                  <Text style={[styles.chainWaiting, { color: COLORS.danger }]}>Demande rejetée</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderRequest = ({ item }: { item: LeaveRequest }) => {
    const cfg = getStatusCfg(item.status);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => openDetail(item)}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardType}>{item.leave_type_name}</Text>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
              <Text style={styles.dateText}>
                {fmtDate(item.start_date)} → {fmtDate(item.end_date)}
              </Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: `${cfg.color}15` }]}>
            <Ionicons name={cfg.icon as any} size={12} color={cfg.color} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.durationText}>{item.duration_days}j</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  };

  const annualBalance =
    balances.find(b =>
      (b.leave_type_code || '').toUpperCase() === 'CA' ||
      (b.leave_type_code || '').toUpperCase() === 'CP' ||
      (b.leave_type_name || '').toLowerCase().includes('annuel') ||
      (b.leave_type_name || '').toLowerCase().includes('congés payés')
    ) ?? balances[0];

  const filteredRequests = searchQuery.trim()
    ? requests.filter(r =>
        (r.leave_type_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        getStatusCfg(r.status).label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : requests;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>

      {/* ── Solde congé annuel ── */}
      <View style={styles.balanceHeader}>
        <Text style={styles.balanceHeaderName}>
          {annualBalance?.leave_type_name ?? 'Congé Annuel'}
        </Text>
        <Text style={styles.balanceHeaderDays}>
          {loading ? '—' : `${annualBalance?.remaining_days ?? annualBalance?.remaining ?? 0} jours`}
        </Text>
      </View>

      {/* ── Barre de recherche ── */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Rechercher par type ou statut..."
          placeholderTextColor={COLORS.textSecondary}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Liste des demandes ── */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRequest}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListHeaderComponent={
            <Text style={styles.listSectionTitle}>Mes demandes</Text>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>
                {searchQuery.trim() ? 'Aucune demande trouvée' : 'Aucune demande de congé'}
              </Text>
            </View>
          }
        />
      )}

      {/* ── FAB nouvelle demande ── */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowForm(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>

      {/* Detail Modal */}
      <Modal visible={!!selectedLeave} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          {selectedLeave && (() => {
            const cfg = getStatusCfg(selectedLeave.status);
            return (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Détail de la demande</Text>
                  <TouchableOpacity onPress={() => setSelectedLeave(null)}>
                    <Ionicons name="close" size={24} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={styles.detailContent}>
                  {/* Status banner */}
                  <View style={[styles.statusBanner, { backgroundColor: `${cfg.color}12` }]}>
                    <Ionicons name={cfg.icon as any} size={24} color={cfg.color} />
                    <Text style={[styles.statusBannerText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>

                  {/* Info grid */}
                  <View style={styles.detailCard}>
                    <DetailRow label="Type de congé" value={selectedLeave.leave_type_name} />
                    <DetailRow label="Du" value={fmtDate(selectedLeave.start_date)} />
                    <DetailRow label="Au" value={fmtDate(selectedLeave.end_date)} />
                    <DetailRow label="Durée" value={`${selectedLeave.duration_days} jour(s)`} />
                    <DetailRow label="Soumis le" value={fmtDateTime(selectedLeave.created_at)} />
                    {(selectedLeave.reason || selectedLeave.motif) && (
                      <View style={styles.reasonBlock}>
                        <Text style={styles.reasonLabel}>Motif</Text>
                        <Text style={styles.reasonText}>{selectedLeave.reason || selectedLeave.motif}</Text>
                      </View>
                    )}
                  </View>

                  {/* Validation chain */}
                  {renderValidationChain(selectedLeave)}

                  {/* Rejection reason */}
                  {selectedLeave.reject_reason && (
                    <View style={styles.rejectBlock}>
                      <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rejectTitle}>Motif du rejet</Text>
                        <Text style={styles.rejectText}>{selectedLeave.reject_reason}</Text>
                      </View>
                    </View>
                  )}

                  {/* Revoke reason */}
                  {selectedLeave.revoke_reason && (
                    <View style={[styles.rejectBlock, { backgroundColor: '#FFF7ED', borderColor: '#EA580C' }]}>
                      <Ionicons name="warning" size={18} color="#EA580C" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rejectTitle, { color: '#EA580C' }]}>Motif de révocation</Text>
                        <Text style={styles.rejectText}>{selectedLeave.revoke_reason}</Text>
                      </View>
                    </View>
                  )}

                  {/* Cancel button */}
                  {['PENDING', 'PENDING_SECOND', 'PENDING_RH', 'pending', 'APPROVED', 'approved'].includes(selectedLeave.status) && (
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(selectedLeave)}>
                      <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                      <Text style={styles.cancelBtnText}>Annuler cette demande</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </>
            );
          })()}
        </SafeAreaView>
      </Modal>

      {/* Create Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouvelle demande de congé</Text>
            <TouchableOpacity onPress={() => {
              setShowForm(false); setJustificationFile(null);
              setStartDay(''); setStartMonth(''); setStartYear('');
              setEndDay(''); setEndMonth(''); setEndYear('');
            }}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

            {/* ── Type de congé (dropdown) ── */}
            <Text style={styles.fieldLabel}>Type de congé *</Text>
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowTypeDropdown(true)} activeOpacity={0.7}>
              <Text style={selectedType ? styles.dropdownBtnText : styles.dropdownBtnPlaceholder}>
                {selectedType
                  ? (leaveTypes.find(lt => lt.id === selectedType)?.label ?? leaveTypes.find(lt => lt.id === selectedType)?.name ?? 'Type sélectionné')
                  : 'Sélectionner un type de congé...'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {/* ── Date de début ── */}
            <Text style={styles.fieldLabel}>Date de début *</Text>
            <View style={styles.dateRow3}>
              <View style={styles.datePartWrap}>
                <TextInput
                  style={styles.datePartInput}
                  value={startDay}
                  onChangeText={v => {
                    const d = v.replace(/\D/g, '').slice(0, 2);
                    setStartDay(d);
                    if (d.length === 2) startMonthRef.current?.focus();
                  }}
                  placeholder="JJ"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  maxLength={2}
                  textAlign="center"
                />
              </View>
              <Text style={styles.dateSep}>/</Text>
              <View style={styles.datePartWrap}>
                <TextInput
                  ref={startMonthRef}
                  style={styles.datePartInput}
                  value={startMonth}
                  onChangeText={v => {
                    const m = v.replace(/\D/g, '').slice(0, 2);
                    setStartMonth(m);
                    if (m.length === 2) startYearRef.current?.focus();
                  }}
                  placeholder="MM"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  maxLength={2}
                  textAlign="center"
                />
              </View>
              <Text style={styles.dateSep}>/</Text>
              <View style={[styles.datePartWrap, styles.datePartYear]}>
                <TextInput
                  ref={startYearRef}
                  style={styles.datePartInput}
                  value={startYear}
                  onChangeText={v => {
                    const y = v.replace(/\D/g, '').slice(0, 4);
                    setStartYear(y);
                    if (y.length === 4) endDayRef.current?.focus();
                  }}
                  placeholder="AAAA"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  maxLength={4}
                  textAlign="center"
                />
              </View>
            </View>

            {/* ── Date de fin ── */}
            <Text style={styles.fieldLabel}>Date de fin *</Text>
            <View style={styles.dateRow3}>
              <View style={styles.datePartWrap}>
                <TextInput
                  ref={endDayRef}
                  style={styles.datePartInput}
                  value={endDay}
                  onChangeText={v => {
                    const d = v.replace(/\D/g, '').slice(0, 2);
                    setEndDay(d);
                    if (d.length === 2) endMonthRef.current?.focus();
                  }}
                  placeholder="JJ"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  maxLength={2}
                  textAlign="center"
                />
              </View>
              <Text style={styles.dateSep}>/</Text>
              <View style={styles.datePartWrap}>
                <TextInput
                  ref={endMonthRef}
                  style={styles.datePartInput}
                  value={endMonth}
                  onChangeText={v => {
                    const m = v.replace(/\D/g, '').slice(0, 2);
                    setEndMonth(m);
                    if (m.length === 2) endYearRef.current?.focus();
                  }}
                  placeholder="MM"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  maxLength={2}
                  textAlign="center"
                />
              </View>
              <Text style={styles.dateSep}>/</Text>
              <View style={[styles.datePartWrap, styles.datePartYear]}>
                <TextInput
                  ref={endYearRef}
                  style={styles.datePartInput}
                  value={endYear}
                  onChangeText={v => {
                    const y = v.replace(/\D/g, '').slice(0, 4);
                    setEndYear(y);
                  }}
                  placeholder="AAAA"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  maxLength={4}
                  textAlign="center"
                />
              </View>
            </View>

            {/* ── Motif ── */}
            <Text style={styles.fieldLabel}>Motif (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={reason} onChangeText={setReason}
              placeholder="Décrivez brièvement la raison de votre congé..."
              placeholderTextColor={COLORS.textSecondary}
              multiline numberOfLines={3}
            />

            {/* ── Justification (optionnel) ── */}
            <Text style={styles.fieldLabel}>Justificatif <Text style={styles.optionalTag}>(optionnel)</Text></Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={handlePickDocument} activeOpacity={0.7}>
              <View style={styles.uploadBtnLeft}>
                <Ionicons name="attach-outline" size={20} color={justificationFile ? COLORS.primary : COLORS.textSecondary} />
                <Text style={[styles.uploadBtnText, justificationFile && { color: COLORS.primary }]} numberOfLines={1}>
                  {justificationFile ? justificationFile.name : 'Joindre un fichier (PDF, photo)'}
                </Text>
              </View>
              {justificationFile ? (
                <TouchableOpacity onPress={() => setJustificationFile(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="cloud-upload-outline" size={18} color={COLORS.textSecondary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit} disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={COLORS.white} />
                : <><Ionicons name="send" size={18} color={COLORS.white} /><Text style={styles.submitBtnText}>Soumettre la demande</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Dropdown type de congé */}
      <Modal visible={showTypeDropdown} transparent animationType="fade">
        <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setShowTypeDropdown(false)}>
          <View style={styles.dropdownMenu}>
            <View style={styles.dropdownMenuHeader}>
              <Text style={styles.dropdownMenuTitle}>Choisir un type de congé</Text>
              <TouchableOpacity onPress={() => setShowTypeDropdown(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView bounces={false}>
              {leaveTypes.map(lt => (
                <TouchableOpacity
                  key={lt.id}
                  style={[styles.dropdownItem, selectedType === lt.id && styles.dropdownItemActive]}
                  onPress={() => { setSelectedType(lt.id); setShowTypeDropdown(false); }}
                >
                  <View style={styles.dropdownItemLeft}>
                    <View style={[styles.radioOuter, selectedType === lt.id && { borderColor: COLORS.primary }]}>
                      {selectedType === lt.id && <View style={styles.radioInner} />}
                    </View>
                    <Text style={[styles.dropdownItemText, selectedType === lt.id && { color: COLORS.primary, fontWeight: '700' }]}>
                      {lt.label || lt.name}
                    </Text>
                  </View>
                  {selectedType === lt.id && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Balance header card
  balanceHeader: {
    margin: 12, marginBottom: 8,
    backgroundColor: COLORS.white, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  balanceHeaderName: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  balanceHeaderDays: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },

  listSectionTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },

  list: { padding: 12, paddingTop: 4, gap: 10, paddingBottom: 90 },

  // Request card
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardType: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 12, color: COLORS.textSecondary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  durationText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },


  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },

  // Detail modal
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  detailContent: { padding: 16, paddingBottom: 40 },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14, marginBottom: 16,
  },
  statusBannerText: { fontSize: 16, fontWeight: '700' },
  detailCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  detailLabel: { fontSize: 13, color: COLORS.textSecondary },
  detailValue: { fontSize: 13, color: COLORS.text, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  reasonBlock: { marginTop: 12, padding: 12, backgroundColor: COLORS.background, borderRadius: 10 },
  reasonLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  reasonText: { fontSize: 13, color: COLORS.text, fontStyle: 'italic' },

  // Validation chain
  chainContainer: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  chainTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  chainTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  chainStep: { flexDirection: 'row', minHeight: 52 },
  chainDotCol: { alignItems: 'center', width: 30, marginRight: 12 },
  chainLine: { width: 2, flex: 1, marginVertical: 4 },
  chainInfo: { flex: 1, paddingBottom: 16 },
  chainLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  chainLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  chainApproverName: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  chainReviewer: { fontSize: 12, color: COLORS.success, marginTop: 2 },
  chainWaiting: { fontSize: 12, color: '#F59E0B', fontStyle: 'italic', marginTop: 2 },
  onLeaveBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  onLeaveBadgeText: { fontSize: 10, fontWeight: '600', color: '#92400E' },

  // Reject/Revoke blocks
  rejectBlock: {
    flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, marginBottom: 16,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  rejectTitle: { fontSize: 13, fontWeight: '700', color: COLORS.danger },
  rejectText: { fontSize: 13, color: COLORS.text, marginTop: 2 },

  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.danger,
    marginTop: 8,
  },
  cancelBtnText: { fontSize: 14, color: COLORS.danger, fontWeight: '600' },

  // Create modal
  modalContent: { padding: 16, paddingBottom: 40 },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 6, marginTop: 18, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  optionalTag: { fontSize: 11, fontWeight: '400', color: COLORS.textSecondary, textTransform: 'none' },

  // Dropdown button
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 15,
  },
  dropdownBtnText: { fontSize: 15, color: COLORS.text, flex: 1 },
  dropdownBtnPlaceholder: { fontSize: 15, color: COLORS.textSecondary, flex: 1 },

  // Dropdown overlay + menu
  dropdownOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  dropdownMenu: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '70%', paddingBottom: 24,
  },
  dropdownMenuHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  dropdownMenuTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  dropdownItemActive: { backgroundColor: '#EFF6FF' },
  dropdownItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dropdownItemText: { fontSize: 15, color: COLORS.text },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },

  // Date input with icon
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  inputWithIcon: { flex: 1, paddingVertical: 14, fontSize: 15, color: COLORS.text },

  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text,
  },
  textarea: { height: 88, textAlignVertical: 'top' },

  // Upload button
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderStyle: 'dashed',
  },
  uploadBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  uploadBtnText: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },

  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, height: 54,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 28,
  },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    marginHorizontal: 12, marginBottom: 4,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },

  // 3-part date input
  dateRow3: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  datePartWrap: {
    flex: 1,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12,
  },
  datePartYear: { flex: 2 },
  datePartInput: {
    paddingVertical: 14, paddingHorizontal: 8,
    fontSize: 16, color: COLORS.text, fontWeight: '600',
  },
  dateSep: { fontSize: 20, color: COLORS.textSecondary, fontWeight: '300' },
});
