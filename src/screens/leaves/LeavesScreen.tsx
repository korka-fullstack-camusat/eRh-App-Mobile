import React, { useState, useEffect, useCallback } from 'react';
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
} from '@/services/leaveService';
import type { LeaveRequest, LeaveBalance, LeaveType, LeaveStatus } from '@/types/leave';
import { COLORS } from '@/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  const [tab, setTab] = useState<'requests' | 'balances'>('requests');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Detail modal
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);

  // Create modal
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        employee: employee.id, leave_type: selectedType,
        start_date: startDate, end_date: endDate, reason,
      });
      setShowForm(false);
      setSelectedType(null); setStartDate(''); setEndDate(''); setReason('');
      await load();
      Alert.alert('Succès', 'Demande de congé soumise avec succès.');
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.non_field_errors?.[0] || 'Erreur lors de la soumission.';
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
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

  const getStatusCfg = (status: string) =>
    STATUS_CONFIG[status] ?? { label: status, color: COLORS.textSecondary, icon: 'ellipse' };

  // Validation chain for detail modal
  const renderValidationChain = (item: LeaveRequest) => {
    const steps = [
      {
        label: 'Responsable N+1',
        done: !!item.reviewed_at,
        active: item.status === 'PENDING' || item.status === 'pending',
        reviewer: item.reviewed_by,
        date: item.reviewed_at,
      },
      {
        label: 'Responsable N+2',
        done: !!item.second_reviewed_at,
        active: item.status === 'PENDING_SECOND',
        reviewer: item.second_reviewer,
        date: item.second_reviewed_at,
      },
      {
        label: 'Validation RH',
        done: !!item.hr_reviewed_at,
        active: item.status === 'PENDING_RH',
        reviewer: item.hr_reviewer,
        date: item.hr_reviewed_at,
      },
    ];

    return (
      <View style={styles.chainContainer}>
        <Text style={styles.chainTitle}>Processus de validation</Text>
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          let dotColor = COLORS.border;
          let dotIcon = 'ellipse-outline';
          if (step.done) { dotColor = COLORS.success; dotIcon = 'checkmark-circle'; }
          else if (step.active) { dotColor = '#F59E0B'; dotIcon = 'time'; }
          else if (item.status === 'REJECTED' || item.status === 'rejected') { dotColor = COLORS.danger; dotIcon = 'close-circle'; }

          return (
            <View key={i} style={styles.chainStep}>
              <View style={styles.chainDotCol}>
                <Ionicons name={dotIcon as any} size={22} color={dotColor} />
                {!isLast && <View style={[styles.chainLine, { backgroundColor: step.done ? COLORS.success : COLORS.border }]} />}
              </View>
              <View style={styles.chainInfo}>
                <Text style={[styles.chainLabel, step.active && { color: '#F59E0B', fontWeight: '700' }]}>
                  {step.label}
                </Text>
                {step.done && step.reviewer && (
                  <Text style={styles.chainReviewer}>{step.reviewer} — {fmtDateTime(step.date)}</Text>
                )}
                {step.active && <Text style={styles.chainWaiting}>En cours de traitement...</Text>}
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
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => setSelectedLeave(item)}>
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

  const renderBalance = ({ item }: { item: LeaveBalance }) => {
    const remaining = item.remaining_days ?? item.remaining ?? 0;
    const total = item.total_days ?? item.acquired ?? 0;
    const used = item.used_days ?? item.taken ?? 0;
    const pct = total > 0 ? Math.min((remaining / total) * 100, 100) : 0;
    return (
      <View style={styles.balanceCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.balanceName}>{item.leave_type_name}</Text>
          <Text style={styles.balanceSub}>{used}j pris sur {total}j acquis</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct < 20 ? COLORS.danger : COLORS.primary }]} />
          </View>
        </View>
        <View style={styles.remainingBadge}>
          <Text style={[styles.remainingText, pct < 20 && { color: COLORS.danger }]}>{remaining}j</Text>
          <Text style={styles.remainingSub}>restants</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {(['requests', 'balances'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Ionicons
              name={t === 'requests' ? 'document-text-outline' : 'wallet-outline'}
              size={16}
              color={tab === t ? COLORS.white : COLORS.textSecondary}
            />
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'requests' ? 'Mes demandes' : 'Mes soldes'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={tab === 'requests' ? requests : balances}
          keyExtractor={(item) => String(item.id)}
          renderItem={tab === 'requests' ? renderRequest : renderBalance as any}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name={tab === 'requests' ? 'document-text-outline' : 'wallet-outline'} size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>
                {tab === 'requests' ? 'Aucune demande de congé' : 'Aucun solde disponible'}
              </Text>
            </View>
          }
        />
      )}

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
            <TouchableOpacity onPress={() => setShowForm(false)}>
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
              style={[styles.input, styles.textarea]}
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
                : <><Ionicons name="send" size={18} color={COLORS.white} /><Text style={styles.submitBtnText}>Soumettre</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
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
  tabs: { flexDirection: 'row', margin: 12, gap: 8, alignItems: 'center' },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 10, flexDirection: 'row',
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },
  addBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  list: { padding: 12, paddingTop: 4, gap: 10, paddingBottom: 32 },

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

  // Balance card
  balanceCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  balanceName: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  balanceSub: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  progressBar: { height: 6, backgroundColor: COLORS.background, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  remainingBadge: { alignItems: 'center' },
  remainingText: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary },
  remainingSub: { fontSize: 10, color: COLORS.textSecondary },

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
  chainTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  chainStep: { flexDirection: 'row', minHeight: 52 },
  chainDotCol: { alignItems: 'center', width: 30, marginRight: 12 },
  chainLine: { width: 2, flex: 1, marginVertical: 4 },
  chainInfo: { flex: 1, paddingBottom: 16 },
  chainLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  chainReviewer: { fontSize: 12, color: COLORS.success, marginTop: 2 },
  chainWaiting: { fontSize: 12, color: '#F59E0B', fontStyle: 'italic', marginTop: 2 },

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
