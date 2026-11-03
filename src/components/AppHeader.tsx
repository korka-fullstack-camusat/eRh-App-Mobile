import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '@/theme';
import CamusatLogo from '@/components/CamusatLogo';
import { useAuth } from '@/contexts/AuthContext';

type Props = {
  title?: string;
  onBack?: () => void;
  onProfile?: () => void;
  onChangePassword?: () => void;
};

/** En-tête bleu commun (même design qu'Inventory-Camusat) : retour, logo, titre, menu utilisateur. */
export default function AppHeader({ title = 'eRH Camusat', onBack, onProfile, onChangePassword }: Props) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <View style={[S.bar, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={S.row}>
        <View style={S.left}>
          {onBack && (
            <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour">
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </Pressable>
          )}
          <View style={S.logo}><CamusatLogo size={22} showText={false} /></View>
          <Text style={S.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
        </View>
        <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Menu utilisateur" style={S.avatar}>
          <Ionicons name="person-outline" size={18} color="#fff" />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={S.backdrop} onPress={close} accessibilityLabel="Fermer le menu">
          <View style={[S.menu, { marginTop: insets.top + 52 }]}>
            {onProfile && <Item icon="person-outline" label="Profil" onPress={() => { close(); onProfile(); }} />}
            {onChangePassword && <Item icon="key-outline" label="Changer le mot de passe" onPress={() => { close(); onChangePassword(); }} />}
            <Item icon="log-out-outline" label="Se déconnecter" danger onPress={() => { close(); logout(); }} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Item({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [S.item, pressed && { backgroundColor: COLORS.blue50 }]}>
      <Ionicons name={icon} size={18} color={danger ? '#b91c1c' : COLORS.primary} />
      <Text style={[S.itemText, danger && { color: '#b91c1c', fontWeight: '900' }]}>{label}</Text>
    </Pressable>
  );
}

const S = StyleSheet.create({
  bar: { backgroundColor: COLORS.primary },
  row: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  logo: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '800', color: '#fff', flexShrink: 1 },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'flex-end', paddingRight: 12 },
  menu: {
    minWidth: 220, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  itemText: { fontSize: 15, fontWeight: '700', color: COLORS.primaryDark },
});
