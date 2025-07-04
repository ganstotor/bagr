import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View, GestureResponderEvent, Platform } from 'react-native';
import Svg, { Path, Defs, RadialGradient, Stop, G } from 'react-native-svg';

interface GoldButtonProps {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  style?: any;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 306;
const DEFAULT_HEIGHT = 83;

const GoldButton: React.FC<GoldButtonProps> = ({ title, onPress, style, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT }) => {
  // Масштаб для SVG и текста
  const scaleW = width / DEFAULT_WIDTH;
  const scaleH = height / DEFAULT_HEIGHT;
  const fontSize = 24 * scaleH;
  const lineHeight = 30 * scaleH;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[{ width, height }, style]}>
      <View style={styles.outerShadow(scaleW, scaleH)}>
        <Svg viewBox={`0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}`} style={{ width: '100%', height: '100%' }} fill="none">
          <Defs>
            <RadialGradient
              id="paint0_radial_263_246"
              cx={0}
              cy={0}
              r={1}
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(153 41.5) scale(137 25.5)"
            >
              <Stop stopColor="#074B47" />
              <Stop offset={1} stopColor="#00030F" />
            </RadialGradient>
          </Defs>
          {/* Внутренняя заливка и рамка */}
          <G>
            <Path
              d="M25.6508 16L16 27.3066L16.2098 55.934L26.0704 67H280.139L290 55.6934V27.3066L280.139 16H25.6508Z"
              fill="url(#paint0_radial_263_246)"
            />
            <Path
              d="M25.6508 16L16 27.3066L16.2098 55.934L26.0704 67H280.139L290 55.6934V27.3066L280.139 16H25.6508Z"
              stroke="#F1AF07"
              strokeWidth={2}
            />
          </G>
          {/* Внешняя рамка */}
          <G>
            <Path
              d="M24.3795 12L12 26.2782V26.7464V57.1754L24.3795 70.7514H281.411L294 56.9413V25.8101L281.621 12H24.3795Z"
              stroke="#FDEA35"
            />
          </G>
        </Svg>
        <View style={[styles.textWrap(width, height)]} pointerEvents="none">
          <Text style={[styles.buttonText, { fontSize, lineHeight }]}>{title}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = {
  outerShadow: (scaleW: number, scaleH: number) => ({
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...Platform.select({
      ios: {
        shadowColor: '#FDEA35',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 10 * scaleH,
      },
      android: {
        elevation: 8 * scaleH,
      },
    }),
  }),
  textWrap: (width: number, height: number) => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width,
    height,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 1,
    pointerEvents: 'none' as const,
  }),
  buttonText: {
    color: '#FDEA35',
    textAlign: 'center' as const,
    fontFamily: 'KantumruyPro-Bold',
    fontStyle: 'normal' as const,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    zIndex: 1,
  },
};

export default GoldButton; 