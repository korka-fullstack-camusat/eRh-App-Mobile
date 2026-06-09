import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';
import { COLORS } from '@/theme';
import CamusatLogo from '@/components/CamusatLogo';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  // ── Animations ──
  const bgScale      = useRef(new Animated.Value(1.15)).current;
  const logoScale    = useRef(new Animated.Value(0.4)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const ringScale1   = useRef(new Animated.Value(0.6)).current;
  const ringOpacity1 = useRef(new Animated.Value(0)).current;
  const ringScale2   = useRef(new Animated.Value(0.6)).current;
  const ringOpacity2 = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide   = useRef(new Animated.Value(24)).current;
  const subOpacity   = useRef(new Animated.Value(0)).current;
  const subSlide     = useRef(new Animated.Value(16)).current;
  const btnOpacity   = useRef(new Animated.Value(0)).current;
  const btnSlide     = useRef(new Animated.Value(32)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Séquence principale
    Animated.sequence([
      // 1. Zoom arrière du fond
      Animated.timing(bgScale, {
        toValue: 1, duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // 2. Logo + anneaux simultanément
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(ringScale1,  { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
        Animated.timing(ringOpacity1,{ toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(ringScale2,  { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
        Animated.timing(ringOpacity2,{ toValue: 0.5, duration: 500, useNativeDriver: true }),
      ]),
      // 3. Titre
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(titleSlide,   { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      // 4. Sous-titre
      Animated.parallel([
        Animated.timing(subOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(subSlide,   { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      // 5. Bouton
      Animated.parallel([
        Animated.timing(btnOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(btnSlide,   { toValue: 0, duration: 350, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
    ]).start();

    // Pulsation infinie du logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Fond avec zoom ── */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.bgGradient, { transform: [{ scale: bgScale }] }]} />

      {/* ── Cercles décoratifs ── */}
      <Animated.View style={[styles.circle, styles.circleTop, { opacity: ringOpacity2, transform: [{ scale: ringScale2 }] }]} />
      <Animated.View style={[styles.circle, styles.circleBottom, { opacity: ringOpacity1, transform: [{ scale: ringScale1 }] }]} />

      {/* ── Corps ── */}
      <View style={styles.body}>

        {/* Anneaux + Logo */}
        <View style={styles.logoArea}>
          <Animated.View style={[styles.ring2, { opacity: ringOpacity2, transform: [{ scale: ringScale2 }] }]} />
          <Animated.View style={[styles.ring1, { opacity: ringOpacity1, transform: [{ scale: ringScale1 }] }]} />
          <Animated.View style={[
            styles.logoWrap,
            { opacity: logoOpacity, transform: [{ scale: Animated.multiply(logoScale, pulseAnim) }] },
          ]}>
            <CamusatLogo size={72} showText={false} />
          </Animated.View>
        </View>

        {/* Textes */}
        <Animated.View style={[styles.textBlock, { opacity: titleOpacity, transform: [{ translateY: titleSlide }] }]}>
          <Text style={styles.brand}>eRH · Camusat</Text>
        </Animated.View>

        <Animated.View style={[styles.taglineWrap, { opacity: subOpacity, transform: [{ translateY: subSlide }] }]}>
          <Text style={styles.tagline}>Congés · Bulletins · Pointages</Text>
        </Animated.View>

      </View>

      {/* ── Bouton bas ── */}
      <Animated.View style={[styles.footer, { opacity: btnOpacity, transform: [{ translateY: btnSlide }] }]}>
        <TouchableOpacity
          style={styles.loginBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginBtnText}>Se connecter</Text>
        </TouchableOpacity>
        <Text style={styles.copyright}>© {new Date().getFullYear()} Camusat Sénégal</Text>
      </Animated.View>

    </SafeAreaView>
  );
}

const RING1 = 164;
const RING2 = 220;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },

  bgGradient: {
    backgroundColor: COLORS.primary,
  },

  // Cercles décoratifs en arrière-plan
  circle: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  circleTop: {
    width: width * 1.4, height: width * 1.4,
    top: -width * 0.7, left: -width * 0.2,
  },
  circleBottom: {
    width: width * 1.2, height: width * 1.2,
    bottom: -width * 0.6, right: -width * 0.2,
  },

  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },

  // Anneaux autour du logo
  logoArea: {
    width: RING2, height: RING2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring2: {
    position: 'absolute',
    width: RING2, height: RING2,
    borderRadius: RING2 / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ring1: {
    position: 'absolute',
    width: RING1, height: RING1,
    borderRadius: RING1 / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  logoWrap: {
    width: 104, height: 104,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },

  // Textes
  textBlock: { alignItems: 'center' },
  brand: {
    fontSize: 30, fontWeight: '800', color: COLORS.white,
    letterSpacing: 0.5,
  },
  taglineWrap: { alignItems: 'center' },
  tagline: {
    fontSize: 13, color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginTop: 2,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 14,
    alignItems: 'center',
    width: '100%',
  },
  loginBtn: {
    backgroundColor: COLORS.white,
    width: '100%',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  loginBtnText: {
    fontSize: 17, fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  copyright: {
    fontSize: 11, color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.5,
  },
});
