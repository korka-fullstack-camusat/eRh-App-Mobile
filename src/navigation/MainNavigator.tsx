import React from 'react';
import { Platform, View, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/theme';
import CamusatLogo from '@/components/CamusatLogo';

import DashboardScreen from '@/screens/DashboardScreen';
import LeavesScreen from '@/screens/leaves/LeavesScreen';
import PayslipsScreen from '@/screens/payslips/PayslipsScreen';
import DossierScreen from '@/screens/dossier/DossierScreen';
import ChangePasswordScreen from '@/screens/auth/ChangePasswordScreen';

function CustomHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      backgroundColor: COLORS.primary,
      paddingHorizontal: 16,
      paddingBottom: 14,
      paddingTop: insets.top + 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      {/* Gauche : back (si dispo) + logo */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {onBack && (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
        )}
        <CamusatLogo size={28} showText={false} />
        <View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.white, letterSpacing: -0.3 }}>camusat</Text>
          <Text style={{ fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.75)', letterSpacing: 1.2, textTransform: 'uppercase' }}>ERH</Text>
        </View>
      </View>
      {/* Droite : titre de la page */}
      <Text style={{ fontSize: 17, fontWeight: 'bold', color: COLORS.white }}>{title}</Text>
    </View>
  );
}

export type RootTabParamList = {
  DashboardTab: undefined;
  LeavesTab: undefined;
  PayslipsTab: undefined;
  ProfileTab: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ChangePassword: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen
        name="ProfileMain"
        component={DossierScreen}
        options={({ navigation }) => ({
          header: () => <CustomHeader title="Mon profil" />,
          headerShown: true,
        })}
      />
      <ProfileStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={({ navigation }) => ({
          header: () => <CustomHeader title="Changer le mot de passe" onBack={() => navigation.goBack()} />,
          headerShown: true,
        })}
      />
    </ProfileStack.Navigator>
  );
}

export default function MainNavigator() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;
  const tabBarHeight = 58 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'android' ? bottomInset + 6 : 6,
          height: tabBarHeight,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'DashboardTab')   iconName = focused ? 'home'          : 'home-outline';
          else if (route.name === 'LeavesTab')   iconName = focused ? 'calendar'      : 'calendar-outline';
          else if (route.name === 'PayslipsTab') iconName = focused ? 'document-text' : 'document-text-outline';
          else if (route.name === 'ProfileTab')  iconName = focused ? 'person'        : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="DashboardTab" component={DashboardScreen}
        options={{ title: 'Accueil', headerShown: false }} />
      <Tab.Screen name="LeavesTab" component={LeavesScreen}
        options={{ title: 'Congés', header: () => <CustomHeader title="Mes congés" /> }} />
      <Tab.Screen name="PayslipsTab" component={PayslipsScreen}
        options={{ title: 'Bulletins', header: () => <CustomHeader title="Mes bulletins" /> }} />
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator}
        options={{ title: 'Profil', headerShown: false }} />
    </Tab.Navigator>
  );
}
