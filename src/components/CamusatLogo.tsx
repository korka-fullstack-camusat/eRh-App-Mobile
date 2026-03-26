import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
  size?: number;
  showText?: boolean;
  textColor?: string;
}

export default function CamusatLogo({ size = 48, showText = true, textColor = '#003c71' }: Props) {
  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Red sphere */}
        <Circle cx="50" cy="50" r="48" fill="#E30613" />
        {/* White swoosh accent */}
        <Path
          d="M25 70 C30 40, 55 25, 75 30 C55 35, 40 50, 35 70 Z"
          fill="white"
          opacity={0.9}
        />
        <Path
          d="M30 75 C40 55, 60 45, 78 55 C60 50, 45 60, 38 78 Z"
          fill="white"
          opacity={0.7}
        />
      </Svg>
      {showText && (
        <Text style={[styles.brandText, { color: textColor, fontSize: size * 0.5 }]}>
          camusat
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
