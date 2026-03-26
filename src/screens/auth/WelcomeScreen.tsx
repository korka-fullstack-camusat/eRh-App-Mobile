import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';
import { COLORS } from '@/theme';
import CamusatLogo from '@/components/CamusatLogo';

const { height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  // Animations
  const logoScale   = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textSlide   = useRef(new Animated.Value(20)).current;
  const btnOpacity  = useRef(new Animated.Value(0)).current;
  const btnSlide    = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo apparaît avec spring
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      // Texte glisse vers le haut
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(textSlide,   { toValue: 0,  duration: 400, useNativeDriver: true }),
      ]),
      // Bouton apparaît
      Animated.parallel([
        Animated.timing(btnOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(btnSlide,   { toValue: 0,  duration: 350, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        {/* Logo animé */}
        <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <CamusatLogo size={80} showText={false} />
        </Animated.View>

        {/* Texte */}
        <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textSlide }], alignItems: 'center' }}>
          <Text style={styles.brand}>camusat</Text>
          <Text style={styles.appName}>eRH Employé</Text>
          <Text style={styles.tagline}>Votre espace RH en un clic</Text>
        </Animated.View>
      </View>

      {/* Bouton en bas */}
      <Animated.View style={[styles.footer, { opacity: btnOpacity, transform: [{ translateY: btnSlide }] }]}>
        <TouchableOpacity
          style={styles.loginBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginBtnText}>Se connecter</Text>
        </TouchableOpacity>
        <Text style={styles.copyright}>© {new Date().getFullYear()} CAMUSAT</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
  },
  logoWrap: {
    width: 120, height: 120,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    fontSize: 32, fontWeight: '700', color: COLORS.white,
    letterSpacing: -0.5,
  },
  appName: {
    fontSize: 18, fontWeight: '400', color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  tagline: {
    fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 10,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
    alignItems: 'center',
  },
  loginBtn: {
    backgroundColor: COLORS.white,
    width: '100%',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  loginBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
  },
  copyright: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
});
