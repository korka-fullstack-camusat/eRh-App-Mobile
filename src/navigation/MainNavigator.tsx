import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/theme';

import DashboardScreen from '@/screens/DashboardScreen';
import LeavesScreen from '@/screens/leaves/LeavesScreen';
import PayslipsScreen from '@/screens/payslips/PayslipsScreen';
import DossierScreen from '@/screens/dossier/DossierScreen';
import ChangePasswordScreen from '@/screens/auth/ChangePasswordScreen';

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
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <ProfileStack.Screen name="ProfileMain" component={DossierScreen} options={{ title: 'Mon profil' }} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Changer le mot de passe' }} />
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
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold', fontSize: 17 },
        headerTitleAlign: 'center',
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
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{ title: 'Accueil', headerShown: false }}
      />
      <Tab.Screen
        name="LeavesTab"
        component={LeavesScreen}
        options={{ title: 'Cong\u00e9s', headerTitle: 'Mes cong\u00e9s' }}
      />
      <Tab.Screen
        name="PayslipsTab"
        component={PayslipsScreen}
        options={{ title: 'Bulletins', headerTitle: 'Mes bulletins' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{ title: 'Profil', headerShown: false }}
      />
    </Tab.Navigator>
  );
}
