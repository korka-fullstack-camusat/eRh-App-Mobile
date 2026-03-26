import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEmployee } from '@/contexts/EmployeeContext';
import { getAvailableBulletins } from '@/services/employeeService';
import { COLORS } from '@/theme';

const MONTHS_FR = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

interface Bulletin { year: number; month: number }

export default function PayslipsScreen() {
  const { employee } = useEmployee();
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!employee?.matricule) return;
    try {
      const data = await getAvailableBulletins(employee.matricule);
      // Trier par date décroissante
      setBulletins(data.sort((a, b) => b.year - a.year || b.month - a.month));
    } catch {
      setBulletins([]);
    }
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

  // Grouper par année
  const grouped = bulletins.reduce<Record<number, Bulletin[]>>((acc, b) => {
    if (!acc[b.year]) acc[b.year] = [];
    acc[b.year].push(b);
    return acc;
  }, {});

  const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (!employee) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-outline" size={48} color={COLORS.border} />
        <Text style={styles.emptyText}>Profil employé non trouvé</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Ionicons name="document-text" size={20} color={COLORS.primary} />
        <Text style={styles.headerText}>Bulletins de paie — {employee.prenom} {employee.nom}</Text>
      </View>

      {years.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="document-outline" size={56} color={COLORS.border} />
          <Text style={styles.emptyTitle}>Aucun bulletin disponible</Text>
          <Text style={styles.emptyText}>Vos bulletins de paie apparaîtront ici</Text>
        </View>
      ) : (
        <FlatList
          data={years}
          keyExtractor={(y) => String(y)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item: year }) => (
            <View style={styles.yearSection}>
              <Text style={styles.yearTitle}>{year}</Text>
              <View style={styles.monthsGrid}>
                {grouped[year].map((b) => (
                  <View key={`${b.year}-${b.month}`} style={styles.monthCard}>
                    <View style={styles.monthIcon}>
                      <Ionicons name="document-text" size={22} color={COLORS.primary} />
                    </View>
                    <Text style={styles.monthName}>{MONTHS_FR[b.month]}</Text>
                    <Text style={styles.monthYear}>{b.year}</Text>
                    <View style={styles.monthBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                      <Text style={styles.monthBadgeText}>Disponible</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white, padding: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerText: { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1 },
  list: { padding: 16, paddingBottom: 32 },
  yearSection: { marginBottom: 20 },
  yearTitle: {
    fontSize: 18, fontWeight: 'bold', color: COLORS.primary,
    marginBottom: 12, paddingBottom: 8,
    borderBottomWidth: 2, borderBottomColor: `${COLORS.primary}30`,
  },
  monthsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthCard: {
    width: '47%', backgroundColor: COLORS.white, borderRadius: 12,
    padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    borderWidth: 1, borderColor: COLORS.border,
  },
  monthIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  monthName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  monthYear: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  monthBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  monthBadgeText: { fontSize: 10, color: COLORS.success, fontWeight: '600' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
});
