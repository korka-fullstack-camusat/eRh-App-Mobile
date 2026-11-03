import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useEmployee } from '@/contexts/EmployeeContext';
import {
  cancelExitAuthorization, createExitAuthorization, getMyExitAuthorizations, uploadExitJustif,
} from '@/services/leaveService';
import type { ExitAuthorization, ExitAuthorizationStatus } from '@/types/leave';
import { COLORS } from '@/theme';

// Mêmes motifs et règles que la page web (Autorisations de sortie).
const MOTIFS = [
  { label: 'Rendez-vous médical', justif: true, desc: false, hint: 'Un justificatif médical est obligatoire (ordonnance, carnet de rendez-vous, convocation...).' },
  { label: 'Préparation de voyage', justif: false, desc: false, hint: null },
  { label: 'Enterrement', justif: false, desc: false, hint: null },
  { label: 'Rendez-vous à la banque', justif: false, desc: false, hint: null },
  { label: 'Rendez-vous à la police', justif: false, desc: false, hint: null },
  { label: 'Urgence', justif: false, desc: true, hint: "Veuillez décrire l'urgence dans la description ci-dessous (obligatoire)." },
  { label: 'Déplacement académique', justif: true, desc: false, hint: "Un justificatif académique est obligatoire (convocation, attestation d'inscription...)." },
  { label: 'Autre (à préciser)', justif: false, desc: true, hint: 'Veuillez préciser le motif dans la description ci-dessous (obligatoire).' },
] as const;

const MAX_HOURS = 3;

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
  if (isNaN(d.getTime())) return '—';
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

/** Saisie « JJ/MM/AAAA » avec barres automatiques. */
const maskDate = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
};
/** Saisie « HH:MM ». */
const maskTime = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};
const toDate = (date: string, time: string): Date | null => {
  const m = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const t = time.match(/^(\d{2}):(\d{2})$/);
  if (!m || !t) return null;
  const dt = new Date(+m[3], +m[2] - 1, +m[1], +t[1], +t[2]);
  return isNaN(dt.getTime()) || +t[1] > 23 || +t[2] > 59 || +m[2] > 12 ? null : dt;
};

export default function ExitRequestsSection() {
  const { employee } = useEmployee();
  const [items, setItems] = useState<ExitAuthorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ExitAuthorizationStatus | 'ALL'>('ALL');
  const [detail, setDetail] = useState<ExitAuthorization | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [exitDate, setExitDate] = useState('');
  const [exitTime, setExitTime] = useState('');
  const [retDate, setRetDate] = useState('');
  const [retTime, setRetTime] = useState('');
  const [motifType, setMotifType] = useState('');
  const [showMotifs, setShowMotifs] = useState(false);
  const [motifDesc, setMotifDesc] = useState('');
  const [file, setFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!employee) return;
    try {
      const data = await getMyExitAuthorizations(employee.id);
      setItems(data.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les demandes de sortie.');
    }
  }, [employee]);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const motifCfg = MOTIFS.find(m => m.label === motifType) ?? null;

  const reset = () => {
    setExitDate(''); setExitTime(''); setRetDate(''); setRetTime('');
    setMotifType(''); setMotifDesc(''); setFile(null); setError(null); setShowMotifs(false);
  };

  const pickFile = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
      if (!r.canceled && r.assets?.[0]) {
        const a = r.assets[0];
        setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream' });
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de sélectionner le fichier.');
    }
  };

  const submit = async () => {
    setError(null);
    if (!employee) return;
    const dExit = toDate(exitDate, exitTime);
    const dRet = toDate(retDate, retTime);
    if (!dExit || !dRet || !motifType) { setError('Veuillez remplir tous les champs (dates au format JJ/MM/AAAA, heures HH:MM).'); return; }
    if (motifCfg?.desc && !motifDesc.trim()) { setError('Une description est obligatoire pour ce motif.'); return; }
    if (motifCfg?.justif && !file) { setError('Un justificatif est obligatoire pour ce motif.'); return; }
    const diffH = (dRet.getTime() - dExit.getTime()) / 3600000;
    if (diffH <= 0) { setError("L'heure de rentrée doit être après l'heure de sortie."); return; }
    if (diffH > MAX_HOURS) { setError(`La durée de sortie ne peut pas dépasser ${MAX_HOURS}h00.`); return; }
    setSubmitting(true);
    try {
      const created = await createExitAuthorization({
        employee_id: employee.id,
        datetime_exit: dExit.toISOString(),
        datetime_return: dRet.toISOString(),
        motif: motifType + (motifDesc.trim() ? ` — ${motifDesc.trim()}` : ''),
      });
      if (file && created?.id) await uploadExitJustif(created.id, file);
      setShowForm(false); reset();
      await load();
      Alert.alert('Succès', 'Demande de sortie soumise — votre manager N+1 va être notifié.');
    } catch (e: any) {
      setError(e?.response?.data?.datetime_return?.[0] ?? e?.response?.data?.detail ?? 'Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (it: ExitAuthorization) => {
    setCancelling(true);
    try {
      await cancelExitAuthorization(it.id);
      setDetail(null);
      await load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.error || e?.response?.data?.detail || "Erreur lors de l'annulation.");
    } finally {
      setCancelling(false);
    }
  };

  const counts = useMemo(() => ({
    PENDING: items.filter(i => i.status === 'PENDING').length,
    APPROVED: items.filter(i => i.status === 'APPROVED').length,
    REJECTED: items.filter(i => i.status === 'REJECTED').length,
    CANCELLED: items.filter(i => i.status === 'CANCELLED').length,
    ALL: items.length,
  }), [items]);
  const shown = items.filter(i => filter === 'ALL' || i.status === filter);

  const tiles: { key: ExitAuthorizationStatus | 'ALL'; label: string; color: string }[] = [
    { key: 'PENDING', label: 'En attente', color: '#d97706' },
    { key: 'APPROVED', label: 'Approuvées', color: '#059669' },
    { key: 'REJECTED', label: 'Rejetées', color: '#dc2626' },
    { key: 'ALL', label: 'Total', color: '#94a3b8' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={S.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={S.title}>Autorisations de sortie</Text>
          <Text style={S.sub}>Durée maximale : {MAX_HOURS}h00</Text>
        </View>
        <TouchableOpacity style={S.newBtn} onPress={() => setShowForm(true)} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="add" size={16} color={COLORS.white} />
          <Text style={S.newBtnText}>Nouvelle demande</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.primary} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
          <View style={S.tiles}>
            {tiles.map(t => (
              <TouchableOpacity key={t.key} onPress={() => setFilter(t.key)} accessibilityRole="button"
                style={[S.tile, filter === t.key && S.tileOn]}>
                <Text style={S.tileNum}>{counts[t.key]}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={[S.dot, { backgroundColor: t.color }]} />
                  <Text style={S.tileLabel}>{t.label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {shown.map(it => {
            const st = STATUS[it.status] ?? STATUS.PENDING;
            return (
              <TouchableOpacity key={it.id} style={S.card} onPress={() => setDetail(it)} activeOpacity={0.85} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <Text style={S.cardTitle} numberOfLines={2}>{it.motif}</Text>
                  <Text style={S.cardSub}>Sortie : {fmtDT(it.datetime_exit)}</Text>
                  <Text style={S.cardSub}>Retour : {fmtDT(it.datetime_return)}</Text>
                  {it.justif_required && !it.justif_file && it.status === 'PENDING' && (
                    <Text style={[S.cardSub, { color: '#d97706', fontWeight: '800' }]}>Justificatif à fournir</Text>
                  )}
                </View>
                <View style={[S.badge, { backgroundColor: st.bg }]}>
                  <Text style={[S.badgeText, { color: st.color }]}>{st.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {shown.length === 0 && (
            <View style={S.empty}>
              <Ionicons name="log-out-outline" size={48} color={COLORS.border} />
              <Text style={S.emptyText}>Aucune demande de sortie</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Détail ── */}
      <Modal visible={!!detail} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetail(null)}>
        <SafeAreaView style={S.modal}>
          <View style={S.modalHead}>
            <Text style={S.modalTitle}>Demande de sortie</Text>
            <TouchableOpacity onPress={() => setDetail(null)} accessibilityLabel="Fermer"><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
          </View>
          {detail && (() => {
            const st = STATUS[detail.status] ?? STATUS.PENDING;
            return (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                <View style={[S.badge, { backgroundColor: st.bg, alignSelf: 'flex-start' }]}>
                  <Text style={[S.badgeText, { color: st.color }]}>{st.label}</Text>
                </View>
                <Info label="Sortie le" value={fmtDT(detail.datetime_exit)} />
                <Info label="Retour prévu" value={fmtDT(detail.datetime_return)} />
                <Info label="Motif" value={detail.motif} />
                <Info label="Manager N+1" value={detail.n1_manager_name ?? 'Non défini'} />
                {detail.reviewed_by_name && <Info label="Traité par" value={`${detail.reviewed_by_name}${detail.reviewed_at ? ` (${fmtDT(detail.reviewed_at)})` : ''}`} />}
                {(detail.justif_required || !!detail.justif_file) && (
                  <Info label="Justificatif" value={detail.justif_file ? (detail.justif_validated ? 'Fourni et validé' : 'Fourni — en attente de validation') : 'Obligatoire — non fourni'} />
                )}
                {detail.status === 'REJECTED' && !!detail.reject_reason && (
                  <View style={S.reject}>
                    <Text style={S.rejectTitle}>Motif du rejet</Text>
                    <Text style={S.rejectText}>{detail.reject_reason}</Text>
                  </View>
                )}
                {detail.status === 'PENDING' && (
                  <TouchableOpacity style={[S.cancelBtn, cancelling && { opacity: 0.6 }]} disabled={cancelling}
                    onPress={() => Alert.alert('Annuler cette demande ?', 'Elle passera au statut Annulé.', [
                      { text: 'Garder', style: 'cancel' },
                      { text: 'Annuler la demande', style: 'destructive', onPress: () => cancel(detail) },
                    ])}>
                    {cancelling ? <ActivityIndicator color="#fff" /> : <Text style={S.cancelText}>Annuler la demande</Text>}
                  </TouchableOpacity>
                )}
              </ScrollView>
            );
          })()}
        </SafeAreaView>
      </Modal>

      {/* ── Formulaire ── */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowForm(false); reset(); }}>
        <SafeAreaView style={S.modal}>
          <View style={S.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={S.modalTitle}>Nouvelle demande de sortie</Text>
              <Text style={S.modalSub}>Votre manager N+1 sera notifié</Text>
            </View>
            <TouchableOpacity onPress={() => { setShowForm(false); reset(); }} accessibilityLabel="Fermer"><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 6 }} keyboardShouldPersistTaps="handled">
            {!!error && (
              <View style={S.err}><Ionicons name="alert-circle" size={16} color={COLORS.danger} /><Text style={S.errText}>{error}</Text></View>
            )}

            <Text style={S.label}>Date et heure de sortie *</Text>
            <View style={S.pair}>
              <TextInput style={[S.input, { flex: 3 }]} placeholder="JJ/MM/AAAA" keyboardType="number-pad" value={exitDate}
                onChangeText={v => setExitDate(maskDate(v))} maxLength={10} accessibilityLabel="Date de sortie" />
              <TextInput style={[S.input, { flex: 2 }]} placeholder="HH:MM" keyboardType="number-pad" value={exitTime}
                onChangeText={v => setExitTime(maskTime(v))} maxLength={5} accessibilityLabel="Heure de sortie" />
            </View>

            <Text style={S.label}>Date et heure de rentrée *</Text>
            <View style={S.pair}>
              <TextInput style={[S.input, { flex: 3 }]} placeholder="JJ/MM/AAAA" keyboardType="number-pad" value={retDate}
                onChangeText={v => setRetDate(maskDate(v))} maxLength={10} accessibilityLabel="Date de rentrée" />
              <TextInput style={[S.input, { flex: 2 }]} placeholder="HH:MM" keyboardType="number-pad" value={retTime}
                onChangeText={v => setRetTime(maskTime(v))} maxLength={5} accessibilityLabel="Heure de rentrée" />
            </View>
            <Text style={S.hint}>Durée maximale autorisée : {MAX_HOURS}h00.</Text>

            <Text style={S.label}>Motif *</Text>
            <TouchableOpacity style={S.dropdown} onPress={() => setShowMotifs(v => !v)} accessibilityRole="button">
              <Text style={motifType ? S.dropText : S.dropPlaceholder}>{motifType || '— Sélectionner un motif —'}</Text>
              <Ionicons name={showMotifs ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {showMotifs && (
              <View style={S.dropList}>
                {MOTIFS.map(m => (
                  <TouchableOpacity key={m.label} style={[S.dropItem, motifType === m.label && { backgroundColor: COLORS.blue50 }]}
                    onPress={() => { setMotifType(m.label); setShowMotifs(false); setError(null); }}>
                    <Text style={[S.dropText, motifType === m.label && { color: COLORS.primary, fontWeight: '800' }]}>
                      {m.label}{m.justif ? ' 📎' : ''}
                    </Text>
                    {motifType === m.label && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {!!motifCfg?.hint && (
              <View style={S.infoBox}><Ionicons name="information-circle" size={16} color={COLORS.primary} /><Text style={S.infoText}>{motifCfg.hint}</Text></View>
            )}

            <Text style={S.label}>Description{motifCfg?.desc ? ' *' : ' (facultatif)'}</Text>
            <TextInput style={[S.input, { minHeight: 80, textAlignVertical: 'top' }]} multiline value={motifDesc}
              onChangeText={setMotifDesc} placeholder="Précisions…" accessibilityLabel="Description" />

            {(motifCfg?.justif || file) && (
              <>
                <Text style={S.label}>Justificatif{motifCfg?.justif ? ' *' : ''}</Text>
                <TouchableOpacity style={S.fileBtn} onPress={pickFile} accessibilityRole="button">
                  <Ionicons name="attach" size={18} color={COLORS.primary} />
                  <Text style={S.fileText} numberOfLines={1}>{file ? file.name : 'Joindre un fichier (image ou PDF)'}</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={[S.submit, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting} accessibilityRole="button">
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={S.submitText}>Envoyer la demande</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={S.infoRow}>
      <Text style={S.infoLabel}>{label}</Text>
      <Text style={S.infoValue}>{value}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  sub: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  newBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
  tileOn: { borderColor: COLORS.primary, backgroundColor: COLORS.blue50 },
  tileNum: { fontSize: 24, fontWeight: '900', color: COLORS.primary },
  tileLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  dot: { width: 7, height: 7, borderRadius: 4 },
  card: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
  cardTitle: { fontSize: 15, fontWeight: '900', color: COLORS.primary, marginBottom: 4 },
  cardSub: { fontSize: 12.5, color: COLORS.text, opacity: 0.8, fontWeight: '600', marginTop: 1 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', marginTop: 32, gap: 8 },
  emptyText: { color: COLORS.textSecondary, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.primary, padding: 16 },
  modalTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '800' },
  modalSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '800', color: COLORS.primary, marginTop: 10, marginBottom: 4 },
  hint: { fontSize: 12, color: COLORS.textSecondary },
  pair: { flexDirection: 'row', gap: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: COLORS.text, backgroundColor: '#fff' },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13 },
  dropText: { fontSize: 15, color: COLORS.text, flex: 1 },
  dropPlaceholder: { fontSize: 15, color: '#9aa7bd' },
  dropList: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, overflow: 'hidden' },
  dropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.blue50, borderRadius: 12, padding: 10, marginTop: 6 },
  infoText: { flex: 1, fontSize: 12.5, color: COLORS.primary, fontWeight: '600' },
  fileBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary, borderRadius: 12, padding: 13 },
  fileText: { flex: 1, color: COLORS.primary, fontWeight: '700' },
  submit: { marginTop: 18, backgroundColor: COLORS.primary, borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  err: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: COLORS.red100, borderRadius: 12, padding: 12 },
  errText: { flex: 1, color: COLORS.danger, fontWeight: '700', fontSize: 13 },
  infoRow: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 12 },
  infoLabel: { fontSize: 11, textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: '700', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: COLORS.text, fontWeight: '700', marginTop: 3 },
  reject: { backgroundColor: COLORS.red100, borderRadius: 14, padding: 12 },
  rejectTitle: { color: COLORS.danger, fontWeight: '800', fontSize: 12 },
  rejectText: { color: COLORS.text, marginTop: 3 },
  cancelBtn: { backgroundColor: COLORS.danger, borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  cancelText: { color: '#fff', fontWeight: '900' },
});
