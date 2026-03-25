import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { getEmployees } from '@/services/employeeService';
import { getDailyStats } from '@/services/attendanceService';
import { getLeaveSummary } from '@/services/leaveService';
import { COLORS } from '@/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface StatCard {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  subtitle?: string;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    pendingLeaves: 0,
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayLabel = format(new Date(), 'EEEE d MMMM yyyy', { locale: fr });

  const loadData = useCallback(async () => {
    try {
      const [allEmployees, activeEmployees, dailyStats, leaveSummary] = await Promise.allSettled([
        getEmployees({ status: 'ALL' }),
        getEmployees({ status: 'ACTIVE' }),
        getDailyStats(today),
        getLeaveSummary(),
      ]);

      setStats({
        totalEmployees:
          allEmployees.status === 'fulfilled' ? allEmployees.value.length : 0,
        activeEmployees:
          activeEmployees.status === 'fulfilled' ? activeEmployees.value.length : 0,
        presentToday:
          dailyStats.status === 'fulfilled' ? dailyStats.value.kpis.present : 0,
        absentToday:
          dailyStats.status === 'fulfilled' ? dailyStats.value.kpis.absent : 0,
        pendingLeaves:
          leaveSummary.status === 'fulfilled' ? leaveSummary.value.pending : 0,
      });
    } catch {
      // Silent error — partial data shown
    }
  }, [today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const cards: StatCard[] = [
    {
      title: 'Employés actifs',
      value: stats.activeEmployees,
      icon: 'people',
      color: COLORS.primary,
      subtitle: `Total: ${stats.totalEmployees}`,
    },
    {
      title: 'Présents aujourd\'hui',
      value: stats.presentToday,
      icon: 'checkmark-circle',
      color: COLORS.success,
      subtitle: `Absents: ${stats.absentToday}`,
    },
    {
      title: 'Congés en attente',
      value: stats.pendingLeaves,
      icon: 'calendar',
      color: COLORS.warning,
      subtitle: 'À valider',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Welcome Banner */}
        <View style={styles.banner}>
          <View>
            <Text style={styles.greeting}>
              Bonjour, {user?.first_name || user?.username} 👋
            </Text>
            <Text style={styles.date}>{todayLabel}</Text>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Stat Cards */}
        <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
        <View style={styles.cardsGrid}>
          {cards.map((card, idx) => (
            <View key={idx} style={[styles.card, { borderLeftColor: card.color }]}>
              <View style={[styles.cardIcon, { backgroundColor: `${card.color}15` }]}>
                <Ionicons name={card.icon} size={24} color={card.color} />
              </View>
              <Text style={styles.cardValue}>{card.value}</Text>
              <Text style={styles.cardTitle}>{card.title}</Text>
              {card.subtitle && <Text style={styles.cardSubtitle}>{card.subtitle}</Text>}
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.actionsRow}>
          {[
            { icon: 'people-outline', label: 'Voir les\nemployés', color: COLORS.primary },
            { icon: 'time-outline', label: 'Suivi des\nprésences', color: COLORS.info },
            { icon: 'calendar-outline', label: 'Gérer les\ncongés', color: COLORS.warning },
          ].map((action, i) => (
            <TouchableOpacity key={i} style={styles.actionBtn}>
              <View style={[styles.actionIcon, { backgroundColor: `${action.color}15` }]}>
                <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={22} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 32 },
  banner: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  date: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 8,
  },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardValue: { fontSize: 28, fontWeight: 'bold', color: COLORS.text },
  cardTitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  cardSubtitle: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionLabel: { fontSize: 12, color: COLORS.text, textAlign: 'center', fontWeight: '500' },
});
