import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/theme';
import CamusatLogo from '@/components/CamusatLogo';

import DashboardScreen from '@/screens/DashboardScreen';
import AttendanceScreen from '@/screens/attendance/AttendanceScreen';
import LeavesScreen from '@/screens/leaves/LeavesScreen';
import PayslipsScreen from '@/screens/payslips/PayslipsScreen';
import DossierScreen from '@/screens/dossier/DossierScreen';
import ChangePasswordScreen from '@/screens/auth/ChangePasswordScreen';

export type RootTabParamList = {
  DashboardTab: undefined;
  LeavesTab: undefined;
  PayslipsTab: undefined;
  DossierTab: undefined;
  AttendanceTab: undefined;
};

export type DossierStackParamList = {
  DossierMain: undefined;
  ChangePassword: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const DossierStack = createNativeStackNavigator<DossierStackParamList>();

function HeaderLogo() {
  return (
    <View style={{ paddingLeft: 4 }}>
      <CamusatLogo size={28} showText={true} textColor={COLORS.white} />
    </View>
  );
}

function DossierStackNavigator() {
  return (
    <DossierStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <DossierStack.Screen
        name="DossierMain"
        component={DossierScreen}
        options={{ title: 'Mon dossier' }}
      />
      <DossierStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Changer le mot de passe' }}
      />
    </DossierStack.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold', fontSize: 17 },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          paddingBottom: 6,
          paddingTop: 4,
          height: 64,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'DashboardTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'LeavesTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'PayslipsTab') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'DossierTab') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'AttendanceTab') {
            iconName = focused ? 'time' : 'time-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          title: 'Accueil',
          headerTitle: () => <HeaderLogo />,
        }}
      />
      <Tab.Screen
        name="LeavesTab"
        component={LeavesScreen}
        options={{ title: 'Congés', headerTitle: 'Mes congés' }}
      />
      <Tab.Screen
        name="PayslipsTab"
        component={PayslipsScreen}
        options={{ title: 'Bulletins', headerTitle: 'Mes bulletins' }}
      />
      <Tab.Screen
        name="DossierTab"
        component={DossierStackNavigator}
        options={{ title: 'Dossier', headerShown: false }}
      />
      <Tab.Screen
        name="AttendanceTab"
        component={AttendanceScreen}
        options={{ title: 'Présences', headerTitle: 'Mes présences' }}
      />
    </Tab.Navigator>
  );
}
