import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';

interface Props {
  size?: number;
  showText?: boolean;
  textColor?: string;
}

export default function CamusatLogo({ size = 48, showText = true, textColor = '#003c71' }: Props) {
  const r = size / 2;
  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="grad" cx="40%" cy="35%" r="60%">
            <Stop offset="0%" stopColor="#EF4444" />
            <Stop offset="100%" stopColor="#B91C1C" />
          </RadialGradient>
        </Defs>
        {/* Fond rouge */}
        <Circle cx="50" cy="50" r="49" fill="url(#grad)" />
        {/* Forme blanche – swoosh Camusat */}
        <Path
          d="M 68 18
             C 78 28, 80 44, 72 58
             C 64 72, 50 80, 36 78
             L 28 70
             C 36 72, 48 66, 56 52
             C 48 54, 38 50, 30 40
             L 38 32
             C 46 44, 56 46, 64 40
             C 68 34, 66 24, 62 20
             Z"
          fill="white"
          opacity="0.95"
        />
        <Path
          d="M 38 72 L 28 84 L 22 76 L 34 64 Z"
          fill="white"
          opacity="0.95"
        />
      </Svg>
      {showText && (
        <Text style={[styles.brandText, { color: textColor, fontSize: size * 0.45 }]}>
          camusat
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontWeight: '700', letterSpacing: -0.5 },
});
