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
  getManagerPendingLeaves,
  approveLeaveRequest,
  rejectLeaveRequest,
} from '@/services/leaveService';
import type { LeaveRequest } from '@/types/leave';
import { COLORS } from '@/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function fmtDate(d: string) {
  try { return format(new Date(d), 'd MMM yyyy', { locale: fr }); } catch { return d; }
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:        'En attente N+1',
  PENDING_SECOND: 'En attente N+2',
};

export default function LeaveApprobationScreen() {
  const { user } = useAuth();
  const managerEmployeeId = user?.employee_id ?? null;

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected request for detail/action modal
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!managerEmployeeId) return;
    try {
      const data = await getManagerPendingLeaves(managerEmployeeId);
      setRequests(data);
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

  const handleApprove = (item: LeaveRequest) => {
    Alert.alert(
      'Approuver la demande',
      `Confirmer l'approbation du congé de ${item.employee_name ?? 'cet employé'} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Approuver', style: 'default',
          onPress: async () => {
            if (!managerEmployeeId) return;
            setSubmitting(true);
            try {
              await approveLeaveRequest(item.id, managerEmployeeId);
              closeModal();
              await load();
              Alert.alert('Succès', 'La demande a été approuvée.');
            } catch (e: any) {
              const msg = e?.response?.data?.error || 'Erreur lors de l\'approbation.';
              Alert.alert('Erreur', msg);
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
      await rejectLeaveRequest(selected.id, managerEmployeeId, rejectReason.trim());
      closeModal();
      await load();
      Alert.alert('Succès', 'La demande a été rejetée.');
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Erreur lors du rejet.';
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: LeaveRequest }) => {
    const statusLabel = STATUS_LABEL[item.status] ?? item.status;
    const isPendingSecond = item.status === 'PENDING_SECOND';
    const badgeColor = isPendingSecond ? '#8B5CF6' : '#F59E0B';

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => setSelected(item)}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.employeeName}>{item.employee_name ?? `Employé #${item.employee}`}</Text>
            {item.matricule ? <Text style={styles.matricule}>{item.matricule}</Text> : null}
            {item.service ? <Text style={styles.service}>{item.service}</Text> : null}
          </View>
          <View style={[styles.badge, { backgroundColor: `${badgeColor}18` }]}>
            <Ionicons name="time-outline" size={12} color={badgeColor} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: badgeColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>{item.leave_type_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>
              {fmtDate(item.start_date)} → {fmtDate(item.end_date)}
              {'  '}
              <Text style={styles.duration}>{item.duration_days}j</Text>
            </Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => handleApprove(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={16} color={COLORS.white} />
            <Text style={styles.actionBtnText}>Approuver</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => { setSelected(item); setShowRejectInput(true); }}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={16} color={COLORS.white} />
            <Text style={styles.actionBtnText}>Rejeter</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

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
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>Demandes en attente</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{requests.length}</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={56} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucune demande en attente</Text>
              <Text style={styles.emptySubText}>Toutes les demandes ont été traitées</Text>
            </View>
          }
        />
      )}

      {/* Detail / Reject Modal */}
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
                {/* Employee info */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailEmployeeName}>{selected.employee_name ?? `Employé #${selected.employee}`}</Text>
                  {selected.matricule && <Text style={styles.detailMeta}>{selected.matricule}</Text>}
                  {selected.service && <Text style={styles.detailMeta}>{selected.service}</Text>}
                </View>

                {/* Leave info */}
                <View style={styles.detailCard}>
                  <DetailRow label="Type de congé" value={selected.leave_type_name} />
                  <DetailRow label="Du" value={fmtDate(selected.start_date)} />
                  <DetailRow label="Au" value={fmtDate(selected.end_date)} />
                  <DetailRow label="Durée" value={`${selected.duration_days} jour(s)`} />
                  {(selected.reason || selected.motif) && (
                    <View style={styles.reasonBlock}>
                      <Text style={styles.reasonLabel}>Motif</Text>
                      <Text style={styles.reasonText}>{selected.reason || selected.motif}</Text>
                    </View>
                  )}
                  {selected.justification_document && (
                    <View style={styles.infoRow}>
                      <Ionicons name="attach-outline" size={16} color={COLORS.primary} />
                      <Text style={[styles.infoText, { color: COLORS.primary }]}>Justificatif joint</Text>
                    </View>
                  )}
                </View>

                {/* Reject input */}
                {showRejectInput && (
                  <View style={styles.rejectSection}>
                    <Text style={styles.rejectLabel}>Motif du rejet *</Text>
                    <TextInput
                      style={styles.rejectInput}
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      placeholder="Saisir le motif du rejet..."
                      placeholderTextColor={COLORS.textSecondary}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.modalActions}>
                  {!showRejectInput ? (
                    <>
                      <TouchableOpacity
                        style={[styles.modalBtn, styles.approveBtn, submitting && { opacity: 0.7 }]}
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
                        style={[styles.modalBtn, styles.rejectBtn, submitting && { opacity: 0.7 }]}
                        onPress={handleReject}
                        disabled={submitting}
                      >
                        {submitting
                          ? <ActivityIndicator color={COLORS.white} size="small" />
                          : <><Ionicons name="close-circle" size={18} color={COLORS.white} /><Text style={styles.modalBtnText}>Confirmer le rejet</Text></>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalBtn, styles.cancelBtn]}
                        onPress={() => { setShowRejectInput(false); setRejectReason(''); }}
                      >
                        <Text style={[styles.modalBtnText, { color: COLORS.text }]}>Annuler</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
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

  list: { padding: 12, paddingTop: 4, gap: 12, paddingBottom: 30 },

  listHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8,
  },
  listHeaderTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: COLORS.accent, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  countText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  employeeName: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  matricule: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  service: { fontSize: 12, color: COLORS.textSecondary },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  cardBody: { gap: 4, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: COLORS.text },
  duration: { fontWeight: '700', color: COLORS.primary },

  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10,
  },
  approveBtn: { backgroundColor: COLORS.success },
  rejectBtn: { backgroundColor: COLORS.danger },
  cancelBtn: { backgroundColor: COLORS.border },
  actionBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  emptySubText: { color: COLORS.textSecondary, fontSize: 14 },

  // Modal
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  modalContent: { padding: 16, paddingBottom: 40, gap: 12 },
  modalActions: { flexDirection: 'column', gap: 10, marginTop: 8 },
  modalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
  },
  modalBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },

  detailCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  detailEmployeeName: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  detailMeta: { fontSize: 13, color: COLORS.textSecondary },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  detailLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  detailValue: { fontSize: 14, color: COLORS.text, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 16 },
  reasonBlock: { paddingTop: 10 },
  reasonLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500', marginBottom: 4 },
  reasonText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },

  rejectSection: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    shadowColor: COLORS.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  rejectLabel: { fontSize: 14, fontWeight: '600', color: COLORS.danger, marginBottom: 8 },
  rejectInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12,
    fontSize: 14, color: COLORS.text, minHeight: 80, textAlignVertical: 'top',
  },
});
