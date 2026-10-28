// Jai Shree Shyam Tour & Travels brand for the driver app: business facts, logo mark, devotional line.
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

const LOGO_MARK = require('../assets/images/logo-mark.png');

/** The logo mark (an "S" drawn as a road with a gold sun), same as the customer app and website. */
export function LogoMark({ size = 48, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[{ width: size, height: size, borderRadius: size * 0.24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' }, style]}
      accessibilityRole="image"
      accessibilityLabel={BRAND.name}
    >
      <Image source={LOGO_MARK} style={{ width: '100%', height: '100%' }} />
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
