import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getEmployees } from '@/services/employeeService';
import type { Employee, EmployeeStatus } from '@/types/employee';
import { COLORS } from '@/theme';
import type { EmployeeStackParamList } from '@/navigation/MainNavigator';

type FilterTab = 'ACTIVE' | 'EXITED' | 'ALL';

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: 'Actif',
  EXITED: 'Sorti',
  SUSPENDED: 'Suspendu',
};

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  ACTIVE: COLORS.success,
  EXITED: COLORS.danger,
  SUSPENDED: COLORS.warning,
};

export default function EmployeesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<EmployeeStackParamList>>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filtered, setFiltered] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await getEmployees({ status: filter });
      setEmployees(data);
    } catch {
      setEmployees([]);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    loadEmployees().finally(() => setLoading(false));
  }, [loadEmployees]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(employees);
    } else {
      const q = search.toLowerCase();
      setFiltered(
        employees.filter(
          (e) =>
            e.nom.toLowerCase().includes(q) ||
            e.prenom.toLowerCase().includes(q) ||
            e.matricule.toLowerCase().includes(q) ||
            (e.fonction || '').toLowerCase().includes(q) ||
            (e.service || '').toLowerCase().includes(q)
        )
      );
    }
  }, [search, employees]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEmployees();
    setRefreshing(false);
  }, [loadEmployees]);

  const renderItem = ({ item }: { item: Employee }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('EmployeeDetail', { employeeId: item.id })}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: `${COLORS.primary}20` }]}>
        <Text style={styles.avatarText}>
          {item.prenom[0]?.toUpperCase()}{item.nom[0]?.toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name}>{item.prenom} {item.nom}</Text>
        <Text style={styles.meta}>{item.matricule} • {item.fonction}</Text>
        {item.service && <Text style={styles.service}>{item.service}</Text>}
      </View>
      <View style={styles.statusBadge}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
        <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
          {STATUS_LABELS[item.status]}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'ACTIVE', label: 'Actifs' },
    { key: 'EXITED', label: 'Sortis' },
    { key: 'ALL', label: 'Tous' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher par nom, matricule..."
          placeholderTextColor={COLORS.textSecondary}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter tabs */}
      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, filter === tab.key && styles.tabActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={[styles.tabText, filter === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Count */}
      <Text style={styles.countText}>{filtered.length} employé(s)</Text>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucun employé trouvé</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    margin: 12,
    marginBottom: 0,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  tabs: { flexDirection: 'row', margin: 12, marginBottom: 4, gap: 8 },
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
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },
  countText: { fontSize: 12, color: COLORS.textSecondary, marginHorizontal: 16, marginBottom: 6 },
  list: { padding: 12, paddingTop: 4, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  cardBody: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  service: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
});
