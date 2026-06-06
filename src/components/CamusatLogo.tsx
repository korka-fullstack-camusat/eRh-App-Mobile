import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';

interface Props {
  size?: number;
  showText?: boolean;
  textColor?: string;
}

export default function CamusatLogo({ size = 48, showText = true, textColor = '#003c71' }: Props) {
  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="grad" cx="38%" cy="32%" r="65%">
            <Stop offset="0%" stopColor="#E53535" />
            <Stop offset="100%" stopColor="#B71C1C" />
          </RadialGradient>
        </Defs>
        {/* Cercle rouge */}
        <Circle cx="50" cy="50" r="49" fill="url(#grad)" />
        {/* V / crochet blanc */}
        <Path
          d="M 17 40
             C 12 54, 18 70, 43 79
             C 46 80, 48 81, 50 81
             C 52 80, 56 77, 64 66
             C 72 55, 79 38, 83 16
             L 76 12
             C 73 30, 66 48, 57 60
             C 53 65, 51 68, 50 71
             L 44 71
             C 35 64, 23 51, 22 40
             Z"
          fill="white"
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
