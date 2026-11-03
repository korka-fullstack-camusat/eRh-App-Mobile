import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  approveExitAuthorization, getManagerExitAuthorizations, rejectExitAuthorization,
} from '@/services/leaveService';
import type { ExitAuthorization, ExitAuthorizationStatus } from '@/types/leave';
import { COLORS } from '@/theme';

const STATUS: Record<ExitAuthorizationStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'En attente', color: '#d97706', bg: '#fffbeb' },
  APPROVED: { label: 'Approuvé', color: '#059669', bg: '#ecfdf5' },
  REJECTED: { label: 'Rejeté', color: '#dc2626', bg: '#fef2f2' },
  CANCELLED: { label: 'Annulé', color: '#64748b', bg: '#f1f5f9' },
};
const p2 = (n: number) => String(n).padStart(2, '0');
const fmtDT = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

type Tab = 'pending' | 'history';

/** Validation des demandes de sortie de l'équipe (manager N+1), comme sur la page web. */
export default function ExitApprovalsSection({ managerId }: { managerId: number }) {
  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<ExitAuthorization[]>([]);
  const [history, setHistory] = useState<ExitAuthorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ExitAuthorization | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([
        getManagerExitAuthorizations(managerId, ['PENDING']),
        getManagerExitAuthorizations(managerId, ['APPROVED', 'REJECTED']),
      ]);
      setPending(p); setHistory(h);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les demandes de sortie.');
    }
  }, [managerId]);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const close = () => { setSelected(null); setShowReject(false); setReason(''); };

  const approve = (it: ExitAuthorization) => {
    Alert.alert('Approuver la sortie', `Confirmer la sortie de ${it.employee_name ?? 'cet employé'} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Approuver',
        onPress: async () => {
          setBusy(true);
          try {
            await approveExitAuthorization(it.id, managerId);
            close(); await load();
            Alert.alert('Succès', 'La demande a été approuvée.');
          } catch (e: any) {
            Alert.alert('Erreur', e?.response?.data?.error || "Erreur lors de l'approbation.");
          } finally { setBusy(false); }
        },
      },
    ]);
  };

  const reject = async () => {
    if (!selected) return;
    if (!reason.trim()) { Alert.alert('Motif requis', 'Veuillez saisir un motif de rejet.'); return; }
    setBusy(true);
    try {
      await rejectExitAuthorization(selected.id, reason.trim(), managerId);
      close(); await load();
      Alert.alert('Succès', 'La demande a été rejetée.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.error || 'Erreur lors du rejet.');
    } finally { setBusy(false); }
  };

  const source = tab === 'pending' ? pending : history;

  return (
    <View style={{ flex: 1 }}>
      <View style={S.tabBar}>
        {(['pending', 'history'] as Tab[]).map(t => {
          const n = (t === 'pending' ? pending : history).length;
          return (
            <TouchableOpacity key={t} style={[S.tab, tab === t && S.tabOn]} onPress={() => setTab(t)} accessibilityRole="tab">
              <Text style={[S.tabText, tab === t && S.tabTextOn]}>{t === 'pending' ? 'En attente' : 'Historique'}</Text>
              {n > 0 && <View style={[S.count, tab === t && { backgroundColor: COLORS.primary }]}><Text style={[S.countText, tab === t && { color: '#fff' }]}>{n}</Text></View>}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} /> : (
        <FlatList
          data={source}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={S.empty}>
              <Ionicons name="log-out-outline" size={48} color={COLORS.border} />
              <Text style={S.emptyText}>{tab === 'pending' ? 'Aucune demande de sortie en attente' : 'Aucun historique'}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = STATUS[item.status] ?? STATUS.PENDING;
            return (
              <TouchableOpacity style={S.card} onPress={() => setSelected(item)} activeOpacity={0.85} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <Text style={S.name}>{item.employee_name ?? 'Employé'}</Text>
                  {!!item.employee_matricule && <Text style={S.mat}>{item.employee_matricule}{item.employee_service ? ` · ${item.employee_service}` : ''}</Text>}
                  <Text style={S.motif} numberOfLines={2}>{item.motif}</Text>
                  <Text style={S.sub}>Sortie : {fmtDT(item.datetime_exit)}</Text>
                  <Text style={S.sub}>Retour : {fmtDT(item.datetime_return)}</Text>
                </View>
                <View style={[S.badge, { backgroundColor: st.bg }]}><Text style={[S.badgeText, { color: st.color }]}>{st.label}</Text></View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <SafeAreaView style={S.modal}>
          <View style={S.modalHead}>
            <Text style={S.modalTitle}>Demande de sortie</Text>
            <TouchableOpacity onPress={close} accessibilityLabel="Fermer"><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
          </View>
          {selected && (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
              <Row label="Employé" value={`${selected.employee_name ?? ''}${selected.employee_matricule ? ` (${selected.employee_matricule})` : ''}`} />
              {!!selected.employee_service && <Row label="Service" value={selected.employee_service} />}
              <Row label="Sortie le" value={fmtDT(selected.datetime_exit)} />
              <Row label="Retour prévu" value={fmtDT(selected.datetime_return)} />
              <Row label="Motif" value={selected.motif} />
              {(selected.justif_required || !!selected.justif_file) && (
                <Row label="Justificatif" value={selected.justif_file ? (selected.justif_validated ? 'Fourni et validé' : 'Fourni') : 'Obligatoire — non fourni'} />
              )}
              {selected.status === 'REJECTED' && !!selected.reject_reason && <Row label="Motif du rejet" value={selected.reject_reason} />}
              {!!selected.reviewed_by_name && <Row label="Traité par" value={selected.reviewed_by_name} />}

              {selected.status === 'PENDING' && (showReject ? (
                <View style={{ gap: 8 }}>
                  <Text style={S.label}>Motif du rejet *</Text>
                  <TextInput style={S.input} multiline value={reason} onChangeText={setReason} placeholder="Expliquez le refus…" accessibilityLabel="Motif du rejet" />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[S.btn, S.btnGhost]} onPress={() => { setShowReject(false); setReason(''); }} disabled={busy}>
                      <Text style={[S.btnText, { color: COLORS.textSecondary }]}>Retour</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[S.btn, S.btnRed, busy && { opacity: 0.6 }]} onPress={reject} disabled={busy}>
                      {busy ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>Confirmer le rejet</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  <TouchableOpacity style={[S.btn, S.btnRedOutline]} onPress={() => setShowReject(true)} disabled={busy} accessibilityRole="button">
                    <Text style={[S.btnText, { color: COLORS.danger }]}>Rejeter</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[S.btn, S.btnGreen, busy && { opacity: 0.6 }]} onPress={() => approve(selected)} disabled={busy} accessibilityRole="button">
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>Approuver</Text>}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={S.row}>
      <Text style={S.rowLabel}>{label}</Text>
      <Text style={S.rowValue}>{value}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.blue50, borderRadius: 14, padding: 4, gap: 4, marginHorizontal: 16, marginTop: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10 },
  tabOn: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, fontWeight: '800', color: COLORS.textSecondary },
  tabTextOn: { color: COLORS.primary },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: COLORS.blue100, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 11, fontWeight: '900', color: COLORS.primary },
  card: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
  name: { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  mat: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginTop: 1 },
  motif: { fontSize: 13.5, color: COLORS.text, fontWeight: '700', marginTop: 6 },
  sub: { fontSize: 12.5, color: COLORS.text, opacity: 0.8, fontWeight: '600', marginTop: 1 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyText: { color: COLORS.textSecondary, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, padding: 16 },
  modalTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '800' },
  row: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 12 },
  rowLabel: { fontSize: 11, textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: '700', letterSpacing: 0.5 },
  rowValue: { fontSize: 15, color: COLORS.text, fontWeight: '700', marginTop: 3 },
  label: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 12, minHeight: 90, textAlignVertical: 'top', fontSize: 15, color: COLORS.text },
  btn: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  btnGreen: { backgroundColor: COLORS.success },
  btnRed: { backgroundColor: COLORS.danger },
  btnRedOutline: { borderWidth: 1.5, borderColor: COLORS.danger, backgroundColor: '#fff' },
  btnGhost: { borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#fff' },
});
