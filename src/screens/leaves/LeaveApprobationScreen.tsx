import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import {
  getManagerLeaves,
  approveLeaveRequest,
  rejectLeaveRequest,
  hrValidateLeaveRequest,
  hrRejectLeaveRequest,
} from '@/services/leaveService';
import type { LeaveRequest, LeaveStatus } from '@/types/leave';
import { COLORS } from '@/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type Tab = 'pending' | 'history';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:        { label: 'En attente N+1',   color: '#F59E0B', bg: '#FFFBEB' },
  PENDING_SECOND: { label: 'En attente N+2',   color: '#7C3AED', bg: '#F5F3FF' },
  PENDING_RH:     { label: 'En attente RH',    color: '#2563EB', bg: '#EFF6FF' },
  APPROVED:       { label: 'Approuvé',          color: COLORS.success, bg: '#ECFDF5' },
  REJECTED:       { label: 'Rejeté',            color: COLORS.danger,  bg: '#FEF2F2' },
  CANCELLED:      { label: 'Annulé',            color: COLORS.textSecondary, bg: '#F8FAFC' },
  REVOKED:        { label: 'Révoqué',           color: '#B45309', bg: '#FFF7ED' },
};

function fmtDate(d: string) {
  try { return format(new Date(d), 'd MMM yyyy', { locale: fr }); } catch { return d; }
}
function fmtDateTime(d?: string | null) {
  if (!d) return '';
  try { return format(new Date(d), 'd MMM yyyy HH:mm', { locale: fr }); } catch { return d; }
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

export default function LeaveApprobationScreen() {
  const { user } = useAuth();
  const managerEmployeeId = user?.employee_id ?? null;
  const isRh = user?.roles?.includes('rh') ?? false;

  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [history, setHistory] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Detail / action modal
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!managerEmployeeId) return;
    try {
      const [p, h] = await Promise.all([
        getManagerLeaves(managerEmployeeId, ['PENDING', 'PENDING_SECOND', 'PENDING_RH']),
        getManagerLeaves(managerEmployeeId, ['APPROVED', 'REJECTED']),
      ]);
      setPending(p);
      setHistory(h);
    } catch { /* keep stale data */ }
  }, [managerEmployeeId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const closeModal = () => {
    setSelected(null);
    setRejectReason('');
    setShowRejectInput(false);
  };

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleApprove = (item: LeaveRequest) => {
    Alert.alert(
      'Approuver la demande',
      `Confirmer l\'approbation du congé de ${item.employee.full_name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Approuver', style: 'default',
          onPress: async () => {
            if (!managerEmployeeId) return;
            setSubmitting(true);
            try {
              if (item.status === 'PENDING_RH' && isRh) {
                await hrValidateLeaveRequest(item.id, managerEmployeeId);
              } else {
                await approveLeaveRequest(item.id, managerEmployeeId);
              }
              closeModal();
              await load();
              Alert.alert('Succès', 'La demande a été approuvée.');
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.error || 'Erreur lors de l\'approbation.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const handleReject = async () => {
    if (!selected || !managerEmployeeId) return;
    if (!rejectReason.trim()) {
      Alert.alert('Motif requis', 'Veuillez saisir un motif de rejet.');
      return;
    }
    setSubmitting(true);
    try {
      if (selected.status === 'PENDING_RH' && isRh) {
        await hrRejectLeaveRequest(selected.id, rejectReason.trim(), managerEmployeeId);
      } else {
        await rejectLeaveRequest(selected.id, managerEmployeeId, rejectReason.trim());
      }
      closeModal();
      await load();
      Alert.alert('Succès', 'La demande a été rejetée.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.error || 'Erreur lors du rejet.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Validation chain (web-style) ─────────────────────────────────────────

  const renderChain = (item: LeaveRequest) => {
    const emp = item.employee;
    const showN2 = !!(item.requires_second_approval || item.second_reviewer || emp?.n2_manager_id);

    const circleColor = {
      n1: item.reviewed_by    ? COLORS.success
        : item.status === 'PENDING' ? '#F59E0B'
        : COLORS.border,
      n2: item.second_reviewer && item.second_reviewed_at ? COLORS.success
        : item.status === 'PENDING_SECOND' ? '#7C3AED'
        : COLORS.border,
      rh: item.hr_reviewer    ? COLORS.success
        : item.status === 'PENDING_RH' ? '#2563EB'
        : COLORS.border,
    };

    return (
      <View style={styles.chainBox}>
        <Text style={styles.chainBoxTitle}>Chaîne de validation</Text>
        <View style={{ gap: 10 }}>
          {/* N+1 */}
          <View style={styles.chainRow}>
            <View style={[styles.chainCircle, { backgroundColor: circleColor.n1 }]}>
              <Text style={styles.chainCircleText}>{item.reviewed_by ? '✓' : '1'}</Text>
            </View>
            <Text style={styles.chainLevel}>N+1</Text>
            <Text style={styles.chainDash}>—</Text>
            <Text style={[styles.chainName, item.reviewed_by ? styles.chainDone : styles.chainWait]} numberOfLines={1}>
              {item.reviewed_by
                ? `${item.reviewed_by.full_name}${item.reviewed_at ? ` (${fmtDate(item.reviewed_at)})` : ''}`
                : emp?.n1_manager_name ?? 'Non défini'}
            </Text>
          </View>

          {/* N+2 (conditionnelle) */}
          {showN2 && (
            <View style={styles.chainRow}>
              <View style={[styles.chainCircle, { backgroundColor: circleColor.n2 }]}>
                <Text style={styles.chainCircleText}>
                  {item.second_reviewer && item.second_reviewed_at ? '✓' : '2'}
                </Text>
              </View>
              <Text style={styles.chainLevel}>N+2</Text>
              <Text style={styles.chainDash}>—</Text>
              <Text style={[styles.chainName, item.second_reviewer && item.second_reviewed_at ? styles.chainDone : styles.chainWait]} numberOfLines={1}>
                {item.second_reviewer
                  ? `${item.second_reviewer.full_name}${item.second_reviewed_at ? ` (${fmtDate(item.second_reviewed_at)})` : ''}`
                  : emp?.n2_manager_name ?? 'Non défini'}
              </Text>
            </View>
          )}

          {/* RH */}
          <View style={styles.chainRow}>
            <View style={[styles.chainCircle, { backgroundColor: circleColor.rh }]}>
              <Text style={styles.chainCircleText}>{item.hr_reviewer ? '✓' : showN2 ? '3' : '2'}</Text>
            </View>
            <Text style={styles.chainLevel}>RH</Text>
            <Text style={styles.chainDash}>—</Text>
            <Text style={[styles.chainName, item.hr_reviewer ? styles.chainDone : styles.chainWait]} numberOfLines={1}>
              {item.hr_reviewer
                ? `${item.hr_reviewer.full_name}${item.hr_reviewed_at ? ` (${fmtDate(item.hr_reviewed_at)})` : ''}`
                : 'En attente'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // ── Request card ──────────────────────────────────────────────────────────

  const renderCard = ({ item }: { item: LeaveRequest }) => {
    const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: COLORS.textSecondary, bg: COLORS.background };
    const isPending = tab === 'pending';

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => setSelected(item)}>
        <View style={styles.cardTop}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: COLORS.primary }]}>
            <Text style={styles.avatarText}>{initials(item.employee.full_name)}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{item.employee.full_name}</Text>
            <Text style={styles.cardMeta}>
              {[item.employee.matricule, item.employee.service, item.employee.fonction].filter(Boolean).join(' · ')}
            </Text>
          </View>

          {/* Status badge */}
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={13} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>{item.leave_type_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>
              {fmtDate(item.start_date)} → {fmtDate(item.end_date)}
              {'  '}<Text style={styles.duration}>{item.duration_days}j</Text>
            </Text>
          </View>
        </View>

        {/* Quick actions for pending requests */}
        {isPending && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleApprove(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={15} color={COLORS.white} />
              <Text style={styles.actionBtnText}>Approuver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => { setSelected(item); setShowRejectInput(true); }}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={15} color={COLORS.white} />
              <Text style={styles.actionBtnText}>Rejeter</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Rejection reason in history */}
        {!isPending && item.reject_reason && (
          <View style={styles.rejectReason}>
            <Ionicons name="alert-circle-outline" size={13} color={COLORS.danger} />
            <Text style={styles.rejectReasonText} numberOfLines={2}>{item.reject_reason}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── Source list ───────────────────────────────────────────────────────────

  const source = tab === 'pending' ? pending : history;

  if (!managerEmployeeId) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.empty}>
          <Ionicons name="lock-closed-outline" size={48} color={COLORS.border} />
          <Text style={styles.emptyText}>Accès réservé aux managers</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>

      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        {(['pending', 'history'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === 'pending' ? 'En attente' : 'Historique'}
            </Text>
            {(t === 'pending' ? pending : history).length > 0 && (
              <View style={[styles.tabBadge, tab === t && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, tab === t && styles.tabBadgeTextActive]}>
                  {(t === 'pending' ? pending : history).length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── List ── */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={source}
          keyExtractor={item => String(item.id)}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name={tab === 'pending' ? 'checkmark-circle-outline' : 'document-text-outline'}
                size={56} color={COLORS.border}
              />
              <Text style={styles.emptyText}>
                {tab === 'pending' ? 'Aucune demande en attente' : 'Aucun historique'}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Detail / Reject Modal ── */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          {selected && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Demande de congé</Text>
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

                {/* Status banner */}
                {(() => {
                  const cfg = STATUS_CONFIG[selected.status];
                  return cfg ? (
                    <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                      <Text style={[styles.statusBannerText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  ) : null;
                })()}

                {/* Employee card */}
                <View style={styles.detailCard}>
                  <View style={[styles.avatar, { backgroundColor: COLORS.primary, width: 44, height: 44, borderRadius: 22 }]}>
                    <Text style={[styles.avatarText, { fontSize: 16 }]}>{initials(selected.employee.full_name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{selected.employee.full_name}</Text>
                    <Text style={styles.detailMeta}>
                      {[selected.employee.matricule, selected.employee.service, selected.employee.fonction].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>

                {/* Leave info */}
                <View style={styles.infoCard}>
                  <DetailRow label="Type de congé" value={selected.leave_type_name} />
                  <DetailRow label="Du" value={fmtDate(selected.start_date)} />
                  <DetailRow label="Au" value={fmtDate(selected.end_date)} />
                  <DetailRow label="Durée" value={`${selected.duration_days} jour(s)`} />
                  <DetailRow label="Soumis le" value={fmtDateTime(selected.created_at)} />
                  {(selected.reason || selected.motif) && (
                    <View style={styles.motifBlock}>
                      <Text style={styles.motifLabel}>Motif</Text>
                      <Text style={styles.motifText}>{selected.reason || selected.motif}</Text>
                    </View>
                  )}
                  {selected.justification_document && (
                    <View style={[styles.infoRow, { marginTop: 8 }]}>
                      <Ionicons name="attach-outline" size={14} color={COLORS.primary} />
                      <Text style={[styles.infoText, { color: COLORS.primary }]}>Justificatif joint</Text>
                    </View>
                  )}
                </View>

                {/* Validation chain */}
                {renderChain(selected)}

                {/* Reject reason */}
                {selected.reject_reason && (
                  <View style={styles.rejectBlock}>
                    <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rejectBlockTitle}>Motif du rejet</Text>
                      <Text style={styles.rejectBlockText}>{selected.reject_reason}</Text>
                    </View>
                  </View>
                )}

                {/* Revoke reason */}
                {selected.revoke_reason && (
                  <View style={[styles.rejectBlock, { backgroundColor: '#FFF7ED', borderColor: '#B45309' }]}>
                    <Ionicons name="warning" size={16} color="#B45309" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rejectBlockTitle, { color: '#B45309' }]}>Motif de révocation</Text>
                      <Text style={styles.rejectBlockText}>{selected.revoke_reason}</Text>
                    </View>
                  </View>
                )}

                {/* Reject input */}
                {showRejectInput && (
                  <View style={styles.rejectInputBox}>
                    <Text style={styles.rejectInputLabel}>Motif du rejet *</Text>
                    <TextInput
                      style={styles.rejectInput}
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      placeholder="Saisir le motif du rejet..."
                      placeholderTextColor={COLORS.textSecondary}
                      multiline numberOfLines={3}
                    />
                  </View>
                )}

                {/* Action buttons — only for pending */}
                {tab === 'pending' && (
                  <View style={styles.modalActions}>
                    {!showRejectInput ? (
                      <>
                        <TouchableOpacity
                          style={[styles.modalBtn, styles.approveBtn, submitting && styles.disabled]}
                          onPress={() => handleApprove(selected)}
                          disabled={submitting}
                        >
                          {submitting
                            ? <ActivityIndicator color={COLORS.white} size="small" />
                            : <><Ionicons name="checkmark-circle" size={18} color={COLORS.white} /><Text style={styles.modalBtnText}>Approuver</Text></>
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.modalBtn, styles.rejectBtn]}
                          onPress={() => setShowRejectInput(true)}
                        >
                          <Ionicons name="close-circle" size={18} color={COLORS.white} />
                          <Text style={styles.modalBtnText}>Rejeter</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.modalBtn, styles.rejectBtn, submitting && styles.disabled]}
                          onPress={handleReject}
                          disabled={submitting}
                        >
                          {submitting
                            ? <ActivityIndicator color={COLORS.white} size="small" />
                            : <><Ionicons name="close-circle" size={18} color={COLORS.white} /><Text style={styles.modalBtnText}>Confirmer le rejet</Text></>
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.modalBtn, { backgroundColor: COLORS.border }]}
                          onPress={() => { setShowRejectInput(false); setRejectReason(''); }}
                        >
                          <Text style={[styles.modalBtnText, { color: COLORS.text }]}>Annuler</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}

              </ScrollView>
            </>
          )}
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

  // Tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingHorizontal: 12, paddingTop: 8,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    marginBottom: 4,
  },
  tabActive: { backgroundColor: `${COLORS.primary}12` },
  tabLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  tabLabelActive: { color: COLORS.primary },
  tabBadge: {
    backgroundColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  tabBadgeActive: { backgroundColor: COLORS.primary },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  tabBadgeTextActive: { color: COLORS.white },

  // List
  list: { padding: 12, gap: 10, paddingBottom: 30 },

  // Card
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  cardName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardBody: { gap: 4, marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { fontSize: 13, color: COLORS.text },
  duration: { fontWeight: '700', color: COLORS.primary },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: 10,
  },
  approveBtn: { backgroundColor: COLORS.success },
  rejectBtn:  { backgroundColor: COLORS.danger },
  actionBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  rejectReason: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 8,
    backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8,
  },
  rejectReasonText: { fontSize: 12, color: COLORS.danger, flex: 1 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.text },

  // Modal
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  modalContent: { padding: 16, paddingBottom: 40, gap: 12 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 12,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusBannerText: { fontSize: 15, fontWeight: '700' },

  detailCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  detailName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  detailMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  infoCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  detailLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  detailValue: { fontSize: 14, color: COLORS.text, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 16 },
  motifBlock: { paddingTop: 10 },
  motifLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500', marginBottom: 4 },
  motifText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },

  // Validation chain
  chainBox: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 14,
  },
  chainBoxTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  chainRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chainCircle: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chainCircleText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  chainLevel: { fontSize: 13, fontWeight: '600', color: COLORS.text, width: 28 },
  chainDash: { fontSize: 13, color: COLORS.textSecondary },
  chainName: { fontSize: 13, flex: 1 },
  chainDone: { color: COLORS.success, fontWeight: '600' },
  chainWait: { color: COLORS.textSecondary },

  // Reject blocks
  rejectBlock: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: COLORS.danger,
    borderRadius: 12, padding: 12,
  },
  rejectBlockTitle: { fontSize: 13, fontWeight: '700', color: COLORS.danger, marginBottom: 2 },
  rejectBlockText: { fontSize: 13, color: COLORS.text, lineHeight: 18 },

  rejectInputBox: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  rejectInputLabel: { fontSize: 14, fontWeight: '600', color: COLORS.danger, marginBottom: 8 },
  rejectInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12,
    fontSize: 14, color: COLORS.text, minHeight: 80, textAlignVertical: 'top',
  },

  modalActions: { gap: 10 },
  modalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
  },
  modalBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
