import React from 'react';
import { Platform, View, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/theme';
import { useNavigation } from '@react-navigation/native';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployee } from '@/contexts/EmployeeContext';

import DashboardScreen from '@/screens/DashboardScreen';
import RequestsScreen from '@/screens/leaves/RequestsScreen';
import AttendanceScreen from '@/screens/attendance/AttendanceScreen';
import LeaveApprobationScreen from '@/screens/leaves/LeaveApprobationScreen';
import PayslipsScreen from '@/screens/payslips/PayslipsScreen';
import DossierScreen from '@/screens/dossier/DossierScreen';
import ChangePasswordScreen from '@/screens/auth/ChangePasswordScreen';

function CustomHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const navigation = useNavigation<any>();
  return (
    <AppHeader
      title={title}
      onBack={onBack}
      onProfile={() => navigation.navigate('ProfileTab', { screen: 'ProfileMain' })}
      onChangePassword={() => navigation.navigate('ProfileTab', { screen: 'ChangePassword' })}
    />
  );
}

export type RootTabParamList = {
  DashboardTab: undefined;
  LeavesTab: undefined;
  ApprobationTab: undefined;
  PayslipsTab: undefined;
  AttendanceTab: undefined;
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

function isManager(roles?: string[]): boolean {
  if (!roles) return false;
  return roles.includes('manager1') || roles.includes('manager2') || roles.includes('rh');
}

export default function MainNavigator() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { employee, bulletinsCount, isLoading: employeeLoading } = useEmployee();
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;
  const tabBarHeight = 58 + bottomInset;
  const managerAccess = isManager(user?.roles);
  const isTechnicien = (employee?.fonction || '').toUpperCase() === 'TECHNICIEN';
  // Bulletins : seulement pour ceux qui en ont ; les autres (hors techniciens) voient « Pointage » à la place.
  const hasBulletins = bulletinsCount > 0;
  const showPayslips = !employeeLoading && !isTechnicien && hasBulletins;
  const showAttendance = !employeeLoading && !isTechnicien && !hasBulletins;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
        tabBarStyle: {
          backgroundColor: COLORS.primary,
          borderTopWidth: 0,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'android' ? bottomInset + 6 : 6,
          height: tabBarHeight,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800' },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'DashboardTab')      iconName = focused ? 'home'             : 'home-outline';
          else if (route.name === 'LeavesTab')    iconName = focused ? 'clipboard'        : 'clipboard-outline';
          else if (route.name === 'ApprobationTab') iconName = focused ? 'checkmark-done' : 'checkmark-done-outline';
          else if (route.name === 'PayslipsTab')  iconName = focused ? 'document-text'   : 'document-text-outline';
          else if (route.name === 'AttendanceTab') iconName = focused ? 'time'             : 'time-outline';
          else if (route.name === 'ProfileTab')   iconName = focused ? 'person'           : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="DashboardTab" component={DashboardScreen}
        options={{ title: 'Accueil', headerShown: false }} />
      <Tab.Screen name="LeavesTab" component={RequestsScreen}
        options={{ title: 'Demandes', header: () => <CustomHeader title="Mes demandes" /> }} />
      {managerAccess && (
        <Tab.Screen name="ApprobationTab" component={LeaveApprobationScreen}
          options={{ title: 'Approbation', header: () => <CustomHeader title="Approbations" /> }} />
      )}
      {showPayslips && (
        <Tab.Screen name="PayslipsTab" component={PayslipsScreen}
          options={{
            title: 'Bulletins',
            header: () => <CustomHeader title="Mes bulletins" />,
            tabBarBadge: bulletinsCount > 0 ? bulletinsCount : undefined,
            tabBarBadgeStyle: { backgroundColor: COLORS.danger, fontSize: 10 },
          }} />
      )}
      {showAttendance && (
        <Tab.Screen name="AttendanceTab" component={AttendanceScreen}
          options={{ title: 'Pointage', header: () => <CustomHeader title="Mon pointage" /> }} />
      )}
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator}
        options={{ title: 'Profil', headerShown: false }} />
    </Tab.Navigator>
  );
}
