import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEmployee } from '@/contexts/EmployeeContext';
import {
  getMyLeaveRequests, getMyLeaveBalances,
  getLeaveTypes, createLeaveRequest, cancelLeaveRequest,
} from '@/services/leaveService';
import type { LeaveRequest, LeaveBalance, LeaveType } from '@/types/leave';
import { COLORS } from '@/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente', approved: 'Approuvé',
  rejected: 'Rejeté', cancelled: 'Annulé',
};
const STATUS_COLOR: Record<string, string> = {
  pending: COLORS.warning, approved: COLORS.success,
  rejected: COLORS.danger, cancelled: COLORS.textSecondary,
};

function formatDate(d: string) {
  try { return format(new Date(d), 'd MMM yyyy', { locale: fr }); } catch { return d; }
}

export default function LeavesScreen() {
  const { employee } = useEmployee();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [tab, setTab] = useState<'requests' | 'balances'>('requests');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
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
    } catch { /* keep stale */ }
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
    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      Alert.alert('Erreur', 'Format de date invalide. Utilisez YYYY-MM-DD.');
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
      setShowForm(false);
      setSelectedType(null);
      setStartDate('');
      setEndDate('');
      setReason('');
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
    Alert.alert('Annuler la demande', 'Confirmer l\'annulation de cette demande ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler', style: 'destructive',
        onPress: async () => {
          try {
            await cancelLeaveRequest(item.id);
            await load();
          } catch {
            Alert.alert('Erreur', 'Impossible d\'annuler cette demande.');
          }
        },
      },
    ]);
  };

  const renderRequest = ({ item }: { item: LeaveRequest }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardType}>{item.leave_type_name}</Text>
        <View style={[styles.badge, { backgroundColor: `${STATUS_COLOR[item.status]}20` }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>
            {STATUS_LABEL[item.status]}
          </Text>
        </View>
      </View>
      <View style={styles.dateRow}>
        <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
        <Text style={styles.dateText}>
          {formatDate(item.start_date)} → {formatDate(item.end_date)} ({item.duration_days}j)
        </Text>
      </View>
      {item.reason ? <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text> : null}
      {item.status === 'pending' && (
        <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item)}>
          <Text style={styles.cancelBtnText}>Annuler la demande</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderBalance = ({ item }: { item: LeaveBalance }) => (
    <View style={styles.balanceCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.balanceName}>{item.leave_type_name}</Text>
        <Text style={styles.balanceSub}>{item.used_days}j utilisés sur {item.total_days}j</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {
            width: `${Math.min((item.used_days / item.total_days) * 100, 100)}%`,
          }]} />
        </View>
      </View>
      <View style={styles.remainingBadge}>
        <Text style={styles.remainingText}>{item.remaining_days}j</Text>
        <Text style={styles.remainingSub}>restants</Text>
      </View>
    </View>
  );

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
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'requests' ? 'Mes demandes' : 'Mes soldes'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={20} color={COLORS.white} />
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
              <Ionicons name="calendar-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>
                {tab === 'requests' ? 'Aucune demande' : 'Aucun solde disponible'}
              </Text>
            </View>
          }
        />
      )}

      {/* Modal nouvelle demande */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouvelle demande de congé</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Type de congé */}
            <Text style={styles.fieldLabel}>Type de congé *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
              {leaveTypes.map(lt => (
                <TouchableOpacity
                  key={lt.id}
                  style={[styles.typeChip, selectedType === lt.id && styles.typeChipActive]}
                  onPress={() => setSelectedType(lt.id)}
                >
                  <Text style={[styles.typeChipText, selectedType === lt.id && styles.typeChipTextActive]}>
                    {lt.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Date de début * (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2025-01-15"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>Date de fin * (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2025-01-20"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>Motif (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={reason}
              onChangeText={setReason}
              placeholder="Raison de la demande..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.submitBtnText}>Soumettre la demande</Text>
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
  tabs: { flexDirection: 'row', margin: 12, gap: 8, alignItems: 'center' },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    backgroundColor: COLORS.white, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center',
  },
  list: { padding: 12, paddingTop: 4, gap: 10, paddingBottom: 32 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardType: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dateText: { fontSize: 13, color: COLORS.textSecondary },
  reason: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 4 },
  cancelBtn: {
    marginTop: 10, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.danger, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13, color: COLORS.danger, fontWeight: '600' },
  balanceCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  balanceName: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  balanceSub: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  progressBar: { height: 6, backgroundColor: COLORS.background, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  remainingBadge: { alignItems: 'center' },
  remainingText: { fontSize: 22, fontWeight: 'bold', color: COLORS.primary },
  remainingSub: { fontSize: 10, color: COLORS.textSecondary },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  modalContent: { padding: 16, paddingBottom: 40 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  typeScroll: { marginBottom: 4 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  typeChipTextActive: { color: COLORS.white },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, fontSize: 15, color: COLORS.text,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10, height: 50,
    justifyContent: 'center', alignItems: 'center', marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
});
