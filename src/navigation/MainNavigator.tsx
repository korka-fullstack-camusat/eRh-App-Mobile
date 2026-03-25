import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/theme';

import DashboardScreen from '@/screens/DashboardScreen';
import EmployeesScreen from '@/screens/employees/EmployeesScreen';
import EmployeeDetailScreen from '@/screens/employees/EmployeeDetailScreen';
import AttendanceScreen from '@/screens/attendance/AttendanceScreen';
import LeavesScreen from '@/screens/leaves/LeavesScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import ChangePasswordScreen from '@/screens/auth/ChangePasswordScreen';

export type RootTabParamList = {
  DashboardTab: undefined;
  EmployeesTab: undefined;
  AttendanceTab: undefined;
  LeavesTab: undefined;
  ProfileTab: undefined;
};

export type EmployeeStackParamList = {
  EmployeesList: undefined;
  EmployeeDetail: { employeeId: number };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ChangePassword: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const EmployeeStack = createNativeStackNavigator<EmployeeStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function EmployeesStackNavigator() {
  return (
    <EmployeeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <EmployeeStack.Screen
        name="EmployeesList"
        component={EmployeesScreen}
        options={{ title: 'Employés' }}
      />
      <EmployeeStack.Screen
        name="EmployeeDetail"
        component={EmployeeDetailScreen}
        options={{ title: 'Détail employé' }}
      />
    </EmployeeStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <ProfileStack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ title: 'Mon profil' }}
      />
      <ProfileStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Changer le mot de passe' }}
      />
    </ProfileStack.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold' },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          paddingBottom: 4,
          height: 60,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'DashboardTab') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'EmployeesTab') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'AttendanceTab') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'LeavesTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{ title: 'Tableau de bord', headerTitle: 'eRH Employer' }}
      />
      <Tab.Screen
        name="EmployeesTab"
        component={EmployeesStackNavigator}
        options={{ title: 'Employés', headerShown: false }}
      />
      <Tab.Screen
        name="AttendanceTab"
        component={AttendanceScreen}
        options={{ title: 'Présences', headerTitle: 'Présences' }}
      />
      <Tab.Screen
        name="LeavesTab"
        component={LeavesScreen}
        options={{ title: 'Congés', headerTitle: 'Gestion des congés' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{ title: 'Profil', headerShown: false }}
      />
    </Tab.Navigator>
  );
}
