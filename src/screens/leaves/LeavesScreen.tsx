import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getLeaveRequests, approveLeave, rejectLeave } from '@/services/leaveService';
import type { LeaveRequest, LeaveStatus } from '@/types/leave';
import { COLORS } from '@/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
  cancelled: 'Annulé',
};

const STATUS_COLOR: Record<LeaveStatus, string> = {
  pending: COLORS.warning,
  approved: COLORS.success,
  rejected: COLORS.danger,
  cancelled: COLORS.textSecondary,
};

type FilterStatus = 'all' | LeaveStatus;

export default function LeavesScreen() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filtered, setFiltered] = useState<LeaveRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const data = await getLeaveRequests(params);
      setRequests(data);
      setFiltered(data);
    } catch {
      setRequests([]);
      setFiltered([]);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleApprove = (item: LeaveRequest) => {
    Alert.alert('Approuver la demande', `Approuver le congé de ${item.employee_name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Approuver',
        style: 'default',
        onPress: async () => {
          try {
            await approveLeave(item.id);
            await load();
            Alert.alert('Succès', 'Congé approuvé.');
          } catch {
            Alert.alert('Erreur', 'Opération échouée.');
          }
        },
      },
    ]);
  };

  const handleReject = (item: LeaveRequest) => {
    Alert.alert('Rejeter la demande', `Rejeter le congé de ${item.employee_name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Rejeter',
        style: 'destructive',
        onPress: async () => {
          try {
            await rejectLeave(item.id);
            await load();
            Alert.alert('Succès', 'Congé rejeté.');
          } catch {
            Alert.alert('Erreur', 'Opération échouée.');
          }
        },
      },
    ]);
  };

  const formatDate = (d: string) => {
    try {
      return format(new Date(d), 'd MMM yyyy', { locale: fr });
    } catch { return d; }
  };

  const tabs: { key: FilterStatus; label: string }[] = [
    { key: 'pending', label: 'En attente' },
    { key: 'approved', label: 'Approuvés' },
    { key: 'rejected', label: 'Rejetés' },
    { key: 'all', label: 'Tous' },
  ];

  const renderItem = ({ item }: { item: LeaveRequest }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <Text style={styles.employeeName}>{item.employee_name || `#${item.employee}`}</Text>
          <Text style={styles.leaveType}>{item.leave_type_name}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${STATUS_COLOR[item.status]}20` }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>
            {STATUS_LABEL[item.status]}
          </Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
        <Text style={styles.dateText}>
          {formatDate(item.start_date)} → {formatDate(item.end_date)}
          {' '}({item.duration_days}j)
        </Text>
      </View>

      {item.reason && (
        <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>
      )}

      {item.status === 'pending' && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: `${COLORS.success}15`, borderColor: COLORS.success }]}
            onPress={() => handleApprove(item)}
          >
            <Ionicons name="checkmark" size={16} color={COLORS.success} />
            <Text style={[styles.actionBtnText, { color: COLORS.success }]}>Approuver</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: `${COLORS.danger}15`, borderColor: COLORS.danger }]}
            onPress={() => handleReject(item)}
          >
            <Ionicons name="close" size={16} color={COLORS.danger} />
            <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Rejeter</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Filter Tabs */}
      <ScrollableTabs tabs={tabs} active={statusFilter} onSelect={setStatusFilter} />

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucune demande trouvée</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function ScrollableTabs<T extends string>({
  tabs, active, onSelect,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onSelect: (k: T) => void;
}) {
  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, active === tab.key && styles.tabActive]}
          onPress={() => onSelect(tab.key)}
        >
          <Text style={[styles.tabText, active === tab.key && styles.tabTextActive]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabs: { flexDirection: 'row', margin: 12, marginBottom: 8, gap: 6 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },
  list: { padding: 12, paddingTop: 4, gap: 10, paddingBottom: 32 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: { flex: 1 },
  employeeName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  leaveType: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  dateText: { fontSize: 13, color: COLORS.textSecondary },
  reason: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic', marginBottom: 10 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
});
