import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/theme';
import LeavesScreen from './LeavesScreen';
import ExitRequestsSection from './ExitRequestsSection';
import AttestationRequestsSection from './AttestationRequestsSection';

type View_ = 'home' | 'leave' | 'exit' | 'attestation';

const CHOICES: { key: Exclude<View_, 'home'>; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'leave', label: 'Demande de congé', desc: 'Poser un congé, suivre vos demandes et votre solde', icon: 'calendar-outline' },
  { key: 'exit', label: 'Demande de sortie', desc: 'Autorisation de sortie pendant les heures de travail (3 h max)', icon: 'log-out-outline' },
  { key: 'attestation', label: 'Demande d’attestation', desc: 'Attestation de travail, de congés, domiciliation de salaire', icon: 'ribbon-outline' },
];

/** Accueil « Demandes » : on choisit le type de demande, puis on affiche la page correspondante. */
export default function RequestsScreen() {
  const route = useRoute<any>();
  const [view, setView] = useState<View_>('home');
  const routeView = route.params?.mode as View_ | undefined;
  const routeTs = route.params?.ts;

  // Un raccourci de l'accueil ouvre directement le bon type
  useEffect(() => { if (routeView) setView(routeView); }, [routeView, routeTs]);

  // Bouton retour d'Android : revient au choix au lieu de quitter l'écran
  useEffect(() => {
    if (view === 'home') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setView('home'); return true; });
    return () => sub.remove();
  }, [view]);

  if (view === 'home') {
    return (
      <SafeAreaView style={S.safe} edges={['bottom']}>
        <View style={S.wrap}>
          <Text style={S.title}>Que souhaitez-vous demander ?</Text>
          {CHOICES.map(c => (
            <TouchableOpacity key={c.key} style={S.choice} onPress={() => setView(c.key)} activeOpacity={0.85}
              accessibilityRole="button" accessibilityLabel={c.label}>
              <View style={S.icon}><Ionicons name={c.icon} size={30} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={S.label}>{c.label}</Text>
                <Text style={S.desc}>{c.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  const current = CHOICES.find(c => c.key === view)!;
  return (
    <SafeAreaView style={S.safe} edges={['bottom']}>
      <TouchableOpacity style={S.back} onPress={() => setView('home')} accessibilityRole="button" accessibilityLabel="Retour aux types de demandes">
        <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        <Text style={S.backText}>Demandes</Text>
        <Text style={S.backSep}>›</Text>
        <Text style={S.backCurrent}>{current.label}</Text>
      </TouchableOpacity>
      {view === 'leave' && <LeavesScreen />}
      {view === 'exit' && <ExitRequestsSection />}
      {view === 'attestation' && <AttestationRequestsSection />}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  wrap: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '900', color: COLORS.primary, marginBottom: 4, marginTop: 4 },
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, minHeight: 92,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, backgroundColor: COLORS.blue50,
  },
  icon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  desc: { fontSize: 13, color: COLORS.text, opacity: 0.75, marginTop: 3, fontWeight: '600' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  backSep: { color: COLORS.textSecondary, fontSize: 14 },
  backCurrent: { color: COLORS.textSecondary, fontWeight: '800', fontSize: 14 },
});
