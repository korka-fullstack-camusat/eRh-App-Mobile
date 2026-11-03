import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEmployee } from '@/contexts/EmployeeContext';
import {
  AttestationDocumentType, AttestationRequest, DOC_TYPES, EXTRA_FIELDS, createAttestation, getMyAttestations,
} from '@/services/attestationService';
import { COLORS } from '@/theme';

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'En attente', color: '#d97706', bg: '#fffbeb' },
  GENERATED: { label: 'En attente', color: '#d97706', bg: '#fffbeb' },
  PROCESSED: { label: 'Traité', color: '#059669', bg: '#ecfdf5' },
  REJECTED: { label: 'Refusé', color: '#dc2626', bg: '#fef2f2' },
};

const p2 = (n: number) => String(n).padStart(2, '0');
const fmt = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const maskDate = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
};
/** « 25/12/2026 » -> « 2026-12-25 » (format attendu par le serveur) ; null si invalide. */
const toIso = (v: string): string | null => {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return d.getFullYear() === +m[3] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[1] ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

export default function AttestationRequestsSection() {
  const { employee } = useEmployee();
  const [items, setItems] = useState<AttestationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<AttestationDocumentType | null>(null);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!employee) return;
    try {
      setItems(await getMyAttestations(employee.id));
    } catch {
      Alert.alert('Erreur', 'Impossible de charger vos demandes d’attestation.');
    }
  }, [employee]);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const close = () => { setShowForm(false); setType(null); setExtra({}); setError(null); };

  const send = async (t: AttestationDocumentType, data: Record<string, string>) => {
    setSubmitting(true); setError(null);
    try {
      await createAttestation({ document_type: t, extra_data: data });
      close();
      await load();
      Alert.alert('Demande envoyée', 'Le RH va traiter votre demande. Le document vous sera envoyé par email.');
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.response?.data?.non_field_errors?.[0] || 'Erreur lors de l’envoi.');
    } finally {
      setSubmitting(false);
    }
  };

  const pick = (t: AttestationDocumentType) => {
    setType(t); setError(null);
    if (EXTRA_FIELDS[t].length === 0) send(t, {});     // rien à renseigner : envoi direct, comme sur le web
  };

  const submitFields = () => {
    if (!type) return;
    const out: Record<string, string> = {};
    for (const f of EXTRA_FIELDS[type]) {
      const v = (extra[f.key] || '').trim();
      if (f.required && !v) { setError(`Le champ « ${f.label} » est obligatoire.`); return; }
      if (!v) continue;
      if (f.type === 'date') {
        const iso = toIso(v);
        if (!iso) { setError(`« ${f.label} » : date invalide (format JJ/MM/AAAA).`); return; }
        out[f.key] = iso;
      } else out[f.key] = v;
    }
    send(type, out);
  };

  const pending = items.filter(i => i.status === 'PENDING' || i.status === 'GENERATED').length;
  const processed = items.filter(i => i.status === 'PROCESSED').length;
  const rejected = items.filter(i => i.status === 'REJECTED').length;

  return (
    <View style={{ flex: 1 }}>
      <View style={S.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={S.title}>Demandes d’attestation</Text>
          <Text style={S.sub}>Document officiel généré par le RH et envoyé par email</Text>
        </View>
        <TouchableOpacity style={S.newBtn} onPress={() => setShowForm(true)} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={S.newBtnText}>Nouvelle demande</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.primary} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[{ l: 'En attente', v: pending, c: '#d97706' }, { l: 'Reçus', v: processed, c: '#059669' }, { l: 'Refusés', v: rejected, c: '#dc2626' }].map(t => (
              <View key={t.l} style={S.tile}>
                <Text style={S.tileNum}>{t.v}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={[S.dot, { backgroundColor: t.c }]} /><Text style={S.tileLabel}>{t.l}</Text>
                </View>
              </View>
            ))}
          </View>

          {items.map(it => {
            const st = STATUS[it.status] ?? STATUS.PENDING;
            return (
              <View key={it.id} style={S.card}>
                <View style={{ flex: 1 }}>
                  <Text style={S.cardTitle}>{it.document_type_display}</Text>
                  <Text style={S.cardSub}>Demandé le {fmt(it.created_at)}</Text>
                  {it.status === 'REJECTED' && !!it.notes && <Text style={S.rejected}>Motif : {it.notes}</Text>}
                  {it.status === 'PROCESSED' && !!it.pdf_url && (
                    <TouchableOpacity onPress={() => Linking.openURL(it.pdf_url!)} style={S.dl} accessibilityRole="link">
                      <Ionicons name="download-outline" size={16} color={COLORS.primary} />
                      <Text style={S.dlText}>Télécharger le document</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={[S.badge, { backgroundColor: st.bg }]}><Text style={[S.badgeText, { color: st.color }]}>{st.label}</Text></View>
              </View>
            );
          })}
          {items.length === 0 && (
            <View style={S.empty}>
              <Ionicons name="ribbon-outline" size={48} color={COLORS.border} />
              <Text style={S.emptyText}>Aucune demande d’attestation</Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <SafeAreaView style={S.modal}>
          <View style={S.modalHead}>
            {type && EXTRA_FIELDS[type].length > 0 && (
              <TouchableOpacity onPress={() => { setType(null); setError(null); }} accessibilityLabel="Retour"><Ionicons name="chevron-back" size={24} color="#fff" /></TouchableOpacity>
            )}
            <Text style={S.modalTitle}>{type ? DOC_TYPES.find(d => d.type === type)?.label : 'Quel document ?'}</Text>
            <TouchableOpacity onPress={close} disabled={submitting} accessibilityLabel="Fermer"><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
            {!!error && <View style={S.err}><Ionicons name="alert-circle" size={16} color={COLORS.danger} /><Text style={S.errText}>{error}</Text></View>}
            {submitting && <ActivityIndicator color={COLORS.primary} />}

            {!type && DOC_TYPES.map(d => (
              <TouchableOpacity key={d.type} style={S.choice} onPress={() => pick(d.type)} disabled={submitting} accessibilityRole="button">
                <View style={S.choiceIcon}><Ionicons name="document-text-outline" size={22} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={S.cardTitle}>{d.label}</Text>
                  <Text style={S.cardSub}>{d.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}

            {!!type && EXTRA_FIELDS[type].length > 0 && (
              <>
                {EXTRA_FIELDS[type].map(f => (
                  <View key={f.key}>
                    <Text style={S.label}>{f.label}{f.required ? ' *' : ' (facultatif)'}</Text>
                    <TextInput
                      style={S.input}
                      value={extra[f.key] || ''}
                      onChangeText={v => setExtra(prev => ({ ...prev, [f.key]: f.type === 'date' ? maskDate(v) : v }))}
                      placeholder={f.type === 'date' ? 'JJ/MM/AAAA' : ''}
                      keyboardType={f.type === 'date' || f.key === 'salaire_net_chiffre' ? 'number-pad' : 'default'}
                      maxLength={f.type === 'date' ? 10 : undefined}
                      accessibilityLabel={f.label}
                    />
                  </View>
                ))}
                <TouchableOpacity style={[S.submit, submitting && { opacity: 0.6 }]} onPress={submitFields} disabled={submitting} accessibilityRole="button">
                  <Text style={S.submitText}>Envoyer la demande</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  sub: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  newBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  tile: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
  tileNum: { fontSize: 24, fontWeight: '900', color: COLORS.primary },
  tileLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  dot: { width: 7, height: 7, borderRadius: 4 },
  card: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
  cardTitle: { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  cardSub: { fontSize: 12.5, color: COLORS.text, opacity: 0.8, fontWeight: '600', marginTop: 2 },
  rejected: { fontSize: 12.5, color: COLORS.danger, fontWeight: '700', marginTop: 4 },
  dl: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dlText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', marginTop: 32, gap: 8 },
  emptyText: { color: COLORS.textSecondary, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.primary, padding: 16 },
  modalTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '800' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.blue50 },
  choiceIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '800', color: COLORS.primary, marginBottom: 4, marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: COLORS.text, backgroundColor: '#fff' },
  submit: { marginTop: 14, backgroundColor: COLORS.primary, borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  err: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: COLORS.red100, borderRadius: 12, padding: 12 },
  errText: { flex: 1, color: COLORS.danger, fontWeight: '700', fontSize: 13 },
});
