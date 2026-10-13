// Jai Shree Shyam Tour & Travels brand for the driver app: business facts, round emblem, devotional line.
import { Image, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors } from './theme';

export const BRAND = {
  name: 'Jai Shree Shyam Tour & Travels',
  short: 'JSS Travels',
  wordmark: 'Jai Shree Shyam',
  wordmarkSub: 'Tour & Travels',
  devotional: '॥ जय श्री श्याम ॥',
  tagline: 'Your Journey Our Priority',
  /** Office number, used until the server's configured support number arrives. */
  phone: '+91 99976 81790',
} as const;

const EMBLEM = require('../assets/images/emblem.png');

/** Round Khatu Shyam ji emblem with a gold ring. */
export function Emblem({ size = 48, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const border = Math.max(2, Math.round(size * 0.05));
  const inner = size - border * 2;
  return (
    <View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.gold, padding: border, overflow: 'hidden' }, style]}
      accessibilityRole="image"
      accessibilityLabel={BRAND.name}
    >
      <Image source={EMBLEM} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
    </View>
  );
}

/** "॥ जय श्री श्याम ॥" in gold (system font carries the Devanagari glyphs). */
export function Devotional({ size = 13, color = colors.gold, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[{ fontSize: size, lineHeight: Math.round(size * 1.5), fontWeight: '700', color, letterSpacing: 0.5, textAlign: 'center' }, style]} numberOfLines={1}>
      {BRAND.devotional}
    </Text>
  );
}
