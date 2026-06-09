import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity,
  Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEmployee } from '@/contexts/EmployeeContext';
import {
  getAvailableBulletins,
  requestPayslipAccess,
  getMyPayslipRequests,
  type PayslipRequest,
} from '@/services/employeeService';
import { COLORS } from '@/theme';

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];
const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

interface Bulletin { year: number; month: number }

const STATUS_LABEL: Record<string, string> = {
  pending:  'En attente',
  sent:     'Traité',
  rejected: 'Rejeté',
};
const STATUS_COLOR: Record<string, string> = {
  pending:  '#F59E0B',
  sent:     COLORS.success,
  rejected: COLORS.danger,
};
const STATUS_BG: Record<string, string> = {
  pending:  '#FEF3C7',
  sent:     `${COLORS.success}18`,
  rejected: `${COLORS.danger}18`,
};
const STATUS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending:  'time-outline',
  sent:     'checkmark-circle-outline',
  rejected: 'close-circle-outline',
};

export default function PayslipsScreen() {
  const { employee } = useEmployee();
  const [bulletins,  setBulletins]  = useState<Bulletin[]>([]);
  const [requests,   setRequests]   = useState<PayslipRequest[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal demande
  const [reqModal,    setReqModal]    = useState(false);
  const [reqSelected, setReqSelected] = useState<Bulletin[]>([]);
  const [reqMessage,  setReqMessage]  = useState('');
  const [reqSending,  setReqSending]  = useState(false);
  const [reqSent,     setReqSent]     = useState(false);

  const load = useCallback(async () => {
    if (!employee?.matricule) return;
    try {
      const [data, reqs] = await Promise.all([
        getAvailableBulletins(employee.matricule),
        getMyPayslipRequests(),
      ]);
      setBulletins(data.sort((a, b) => b.year - a.year || b.month - a.month));
      setRequests(reqs);
    } catch {
      setBulletins([]);
      setRequests([]);
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

  // Options mois antérieurs (4 à 27 mois en arrière)
  const today = new Date();
  const reqOptions: Bulletin[] = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (i + 4), 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  const toggleMonth = (entry: Bulletin) => {
    setReqSelected(prev => {
      const exists = prev.some(e => e.year === entry.year && e.month === entry.month);
      return exists
        ? prev.filter(e => !(e.year === entry.year && e.month === entry.month))
        : [...prev, entry];
    });
  };

  const submitRequest = async () => {
    if (reqSelected.length === 0) {
      Alert.alert('Sélection requise', 'Veuillez sélectionner au moins un mois.');
      return;
    }
    setReqSending(true);
    try {
      await requestPayslipAccess({ months: reqSelected, message: reqMessage });
      setReqSent(true);
      // Recharger les demandes après envoi
      const reqs = await getMyPayslipRequests();
      setRequests(reqs);
    } catch {
      Alert.alert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setReqSending(false);
    }
  };

  const closeModal = () => {
    setReqModal(false);
    setReqSelected([]);
    setReqMessage('');
    setReqSent(false);
  };

  // Modal détail demande
  const [detailReq, setDetailReq] = useState<PayslipRequest | null>(null);

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

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const otherRequests   = requests.filter(r => r.status !== 'pending');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Bouton en haut dès qu'il y a des bulletins OU des demandes */}
      {(years.length > 0 || requests.length > 0) && (
        <TouchableOpacity
          style={styles.reqBtn}
          onPress={() => { setReqSent(false); setReqModal(true); }}
          activeOpacity={0.85}
        >
          <Ionicons name="document-text-outline" size={18} color={COLORS.white} />
          <Text style={styles.reqBtnText}>Demande de bulletin de salaire</Text>
        </TouchableOpacity>
      )}

      {years.length === 0 && requests.length === 0 ? (
        /* ── Aucun bulletin et aucune demande ── */
        <View style={styles.center}>
          <Ionicons name="document-outline" size={56} color={COLORS.border} />
          <Text style={styles.emptyTitle}>Aucun bulletin disponible</Text>
          <Text style={styles.emptyText}>Vos bulletins de paie apparaîtront ici</Text>
          <TouchableOpacity
            style={styles.reqBtn}
            onPress={() => { setReqSent(false); setReqModal(true); }}
            activeOpacity={0.85}
          >
            <Ionicons name="document-text-outline" size={18} color={COLORS.white} />
            <Text style={styles.reqBtnText}>Demande de bulletin de salaire</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Demandes en attente ── */}
          {pendingRequests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Demandes en cours</Text>
              {pendingRequests.map(req => (
                <RequestCard key={req.id} req={req} onPress={() => setDetailReq(req)} />
              ))}
            </View>
          )}

          {/* ── Bulletins disponibles ── */}
          {years.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Bulletins disponibles</Text>
              {years.map(year => (
                <View key={year} style={styles.yearSection}>
                  <Text style={styles.yearTitle}>{year}</Text>
                  <View style={styles.monthsGrid}>
                    {grouped[year].map((b) => (
                      <View key={`${b.year}-${b.month}`} style={styles.monthCard}>
                        <View style={styles.monthIcon}>
                          <Ionicons name="document-text" size={22} color={COLORS.primary} />
                        </View>
                        <Text style={styles.monthName}>{MONTHS_FR[b.month - 1]}</Text>
                        <Text style={styles.monthYear}>{b.year}</Text>
                        <View style={styles.monthBadge}>
                          <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                          <Text style={styles.monthBadgeText}>Disponible</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Demandes traitées / rejetées ── */}
          {otherRequests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Historique des demandes</Text>
              {otherRequests.map(req => (
                <RequestCard key={req.id} req={req} />
              ))}
            </View>
          )}

        </ScrollView>
      )}

      {/* ══ MODAL DÉTAIL DEMANDE ══ */}
      <Modal
        visible={!!detailReq}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailReq(null)}
      >
        {detailReq && (
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            {/* En-tête */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={[styles.modalIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="time-outline" size={16} color="#F59E0B" />
                </View>
                <Text style={styles.modalTitle}>Détail de la demande</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailReq(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Statut */}
              <View style={detailStyles.statusRow}>
                <Ionicons name="time-outline" size={15} color="#F59E0B" />
                <Text style={detailStyles.statusText}>En attente de traitement par le service RH</Text>
              </View>

              {/* Date */}
              <View style={detailStyles.row}>
                <Text style={detailStyles.label}>Date de la demande</Text>
                <Text style={detailStyles.value}>{detailReq.created_at}</Text>
              </View>

              {/* Mois demandés */}
              <Text style={detailStyles.label}>Mois demandés</Text>
              <View style={detailStyles.chipList}>
                {detailReq.requested_months.map((m, i) => (
                  <View key={i} style={detailStyles.chip}>
                    <Text style={detailStyles.chipText}>
                      {MONTHS_FR[m.month - 1]} {m.year}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Message optionnel */}
              {!!detailReq.message && (
                <View style={detailStyles.messageBox}>
                  <Text style={detailStyles.label}>Message joint</Text>
                  <Text style={detailStyles.messageText}>{detailReq.message}</Text>
                </View>
              )}

              {/* Info */}
              <View style={detailStyles.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
                <Text style={detailStyles.infoText}>
                  Le service RH traitera votre demande dans les meilleurs délais. Vous recevrez vos bulletins via la plateforme.
                </Text>
              </View>

              <TouchableOpacity style={[styles.reqBtn, { marginTop: 8, marginBottom: 0 }]} onPress={() => setDetailReq(null)}>
                <Text style={styles.reqBtnText}>Fermer</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* ══ MODAL DEMANDE BULLETINS ANTÉRIEURS ══ */}
      <Modal
        visible={reqModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          {/* En-tête modal */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <View style={styles.modalIcon}>
                <Ionicons name="send-outline" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.modalTitle}>Demander des bulletins antérieurs</Text>
            </View>
            <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {reqSent ? (
            /* ── Confirmation ── */
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={56} color={COLORS.success} />
              <Text style={styles.successTitle}>Demande envoyée !</Text>
              <Text style={styles.successSub}>
                Le service RH a été notifié et vous enverra les bulletins demandés.
              </Text>
              <TouchableOpacity style={styles.successCloseBtn} onPress={closeModal}>
                <Text style={styles.successCloseBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.hint}>
                Sélectionnez les mois souhaités. Le service RH vous les enverra après traitement.
              </Text>

              {/* Grille mois */}
              <View style={styles.chipGrid}>
                {reqOptions.map(opt => {
                  const isSelected = reqSelected.some(e => e.year === opt.year && e.month === opt.month);
                  return (
                    <TouchableOpacity
                      key={`${opt.year}-${opt.month}`}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => toggleMonth(opt)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {MONTHS_SHORT[opt.month - 1]} {opt.year}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {reqSelected.length > 0 && (
                <Text style={styles.selectedCount}>
                  {reqSelected.length} mois sélectionné{reqSelected.length > 1 ? 's' : ''}
                </Text>
              )}

              <Text style={styles.fieldLabel}>Message (optionnel)</Text>
              <TextInput
                style={styles.textArea}
                value={reqMessage}
                onChangeText={setReqMessage}
                placeholder="Ex : Bulletins nécessaires pour un dossier de prêt"
                placeholderTextColor={COLORS.textSecondary}
                multiline
                numberOfLines={3}
              />

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, (reqSending || reqSelected.length === 0) && { opacity: 0.5 }]}
                  onPress={submitRequest}
                  disabled={reqSending || reqSelected.length === 0}
                >
                  {reqSending
                    ? <ActivityIndicator size="small" color={COLORS.white} />
                    : <Ionicons name="send" size={14} color={COLORS.white} />
                  }
                  <Text style={styles.submitText}>Envoyer la demande</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Composant carte de demande ── */
function RequestCard({ req, onPress }: { req: PayslipRequest; onPress?: () => void }) {
  const color  = STATUS_COLOR[req.status]  ?? COLORS.textSecondary;
  const bg     = STATUS_BG[req.status]     ?? '#F3F4F6';
  const icon   = STATUS_ICON[req.status]   ?? 'help-circle-outline';
  const label  = STATUS_LABEL[req.status]  ?? req.status;

  const monthLabels = req.requested_months
    .map(m => `${MONTHS_SHORT[m.month - 1]} ${m.year}`)
    .join(' · ');

  return (
    <TouchableOpacity style={reqStyles.card} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={reqStyles.row}>
        <View style={[reqStyles.iconBox, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={reqStyles.info}>
          <Text style={reqStyles.months} numberOfLines={2}>{monthLabels}</Text>
          <Text style={reqStyles.date}>{req.created_at}</Text>
        </View>
        <View style={[reqStyles.badge, { backgroundColor: bg }]}>
          <Text style={[reqStyles.badgeText, { color }]}>{label}</Text>
        </View>
      </View>
      {req.status === 'sent' && (
        <View style={reqStyles.fulfilledNote}>
          <Ionicons name="information-circle-outline" size={13} color={COLORS.success} />
          <Text style={reqStyles.fulfilledNoteText}>
            Votre bulletin a été envoyé. Actualisez la page pour le voir dans la liste.
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const detailStyles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7', borderRadius: 10,
    padding: 12, marginBottom: 20,
  },
  statusText: { fontSize: 13, color: '#92400E', fontWeight: '600', flex: 1 },
  row:        { marginBottom: 16 },
  label:      { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  value:      { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  chipList:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    backgroundColor: `${COLORS.primary}12`, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: `${COLORS.primary}25`,
  },
  chipText:    { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  messageBox:  { marginBottom: 20 },
  messageText: { fontSize: 14, color: COLORS.text, lineHeight: 20, backgroundColor: COLORS.white, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: `${COLORS.primary}10`, borderRadius: 10,
    padding: 12, marginBottom: 20,
  },
  infoText: { fontSize: 12, color: COLORS.primary, flex: 1, lineHeight: 18 },
});

const reqStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  info:    { flex: 1 },
  months:  { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  date:    { fontSize: 11, color: COLORS.textSecondary },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  fulfilledNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: `${COLORS.success}30`,
  },
  fulfilledNoteText: { fontSize: 11, color: COLORS.success, flex: 1, lineHeight: 16 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  reqBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary,
    marginHorizontal: 16, marginTop: 16, borderRadius: 12,
    paddingVertical: 14,
  },
  reqBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },

  // Liste
  list:        { padding: 16, paddingBottom: 32 },
  section:     { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 10,
  },
  yearSection: { marginBottom: 16 },
  yearTitle: {
    fontSize: 18, fontWeight: 'bold', color: COLORS.primary,
    marginBottom: 12, paddingBottom: 8,
    borderBottomWidth: 2, borderBottomColor: `${COLORS.primary}30`,
  },
  monthsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthCard: {
    width: '47%', backgroundColor: COLORS.white, borderRadius: 12,
    padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    borderWidth: 1, borderColor: COLORS.border,
  },
  monthIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  monthName:      { fontSize: 14, fontWeight: '600', color: COLORS.text },
  monthYear:      { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  monthBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
    backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  monthBadgeText: { fontSize: 10, color: COLORS.success, fontWeight: '600' },

  emptyTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  emptyText:  { fontSize: 14, color: COLORS.textSecondary },

  // Modal
  modalSafe: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  modalIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary, flex: 1 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: { padding: 16, paddingBottom: 32 },
  hint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 14, lineHeight: 18 },

  chipGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  chipTextActive: { color: COLORS.white, fontWeight: '600' },

  selectedCount: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 14 },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  textArea: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    padding: 12, fontSize: 14, color: COLORS.text,
    backgroundColor: COLORS.white, minHeight: 80, textAlignVertical: 'top',
    marginBottom: 20,
  },
  actions:   { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  cancelText:  { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  submitBtn: {
    flex: 2, backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 13, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },

  // Succès
  successBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  successTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  successSub:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  successCloseBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 13,
  },
  successCloseBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
});
