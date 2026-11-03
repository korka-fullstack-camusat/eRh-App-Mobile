// Mise à jour de l'app depuis l'app : un bandeau avec un bouton « Mettre à jour ».
//  1. Mise à jour instantanée (OTA, expo-updates) : changement des écrans sans réinstaller l'APK. Le bouton télécharge
//     la nouvelle version puis redémarre l'app.
//  2. Nouvelle version de l'APK (changement natif) : si le serveur annonce un versionCode plus récent
//     (/downloads/app-version.json), le bouton ouvre le téléchargement de l'APK.
// Rien ne s'affiche s'il n'y a pas de mise à jour. Sans effet sur la version web et en développement.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Application from 'expo-application';
import { COLORS } from '@/theme';

const SITE = (process.env.EXPO_PUBLIC_APP_SITE || 'https://erh.camusatsn.com').replace(/\/$/, '');
const MIN_DELAY_MS = 5 * 60 * 1000;         // pas plus d'une vérification toutes les 5 minutes

type Pending = { kind: 'ota' } | { kind: 'apk'; url: string; version?: string };

export default function UpdatePrompt() {
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    if (Platform.OS === 'web' || __DEV__ || pending) return;
    if (Date.now() - lastCheck.current < MIN_DELAY_MS) return;
    lastCheck.current = Date.now();
    try {
      const Updates = require('expo-updates');
      if (Updates.isEnabled) {
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) { setPending({ kind: 'ota' }); return; }
      }
    } catch { /* pas de réseau ou mises à jour non configurées : on passe à la vérification suivante */ }
    if (Platform.OS !== 'android') return;
    try {
      const res = await fetch(`${SITE}/downloads/app-version.json?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
      if (!res.ok) return;
      const info = await res.json();
      const installed = parseInt(Application.nativeBuildVersion || '0', 10);
      if (Number(info.versionCode) > installed) {
        const url = String(info.url || '/downloads/erh-camusat.apk');
        setPending({ kind: 'apk', url: url.startsWith('http') ? url : `${SITE}${url}`, version: info.version });
      }
    } catch { /* serveur injoignable : on réessaiera */ }
  }, [pending]);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
  }, [check]);

  const update = async () => {
    if (!pending) return;
    setError('');
    if (pending.kind === 'apk') {
      Linking.openURL(pending.url).catch(() => setError('Impossible d’ouvrir le téléchargement.'));
      return;
    }
    setBusy(true);
    try {
      const Updates = require('expo-updates');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();                       // redémarre l'app avec la nouvelle version
    } catch {
      setError('Mise à jour impossible, vérifiez votre connexion puis réessayez.');
      setBusy(false);
    }
  };

  if (!pending) return null;
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]} accessibilityRole="alert">
      <View style={styles.card}>
        <View style={styles.texts}>
          <Text style={styles.title}>Mise à jour disponible</Text>
          <Text style={styles.sub}>
            {error || (pending.kind === 'apk'
              ? `Une nouvelle version${pending.version ? ` (${pending.version})` : ''} est disponible.`
              : 'Une nouvelle version de l’application est prête.')}
          </Text>
        </View>
        <Pressable onPress={update} disabled={busy} accessibilityRole="button" accessibilityLabel="Mettre à jour l’application"
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }, busy && { opacity: 0.7 }]}>
          {busy ? <ActivityIndicator color={COLORS.primary} /> : <Text style={styles.btnText}>Mettre à jour</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, paddingHorizontal: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  texts: { flex: 1 },
  title: { color: COLORS.primary, fontWeight: '900', fontSize: 14 },
  sub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  btn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, minWidth: 118, alignItems: 'center' },
  btnText: { color: COLORS.white, fontWeight: '900', fontSize: 14 },
});
