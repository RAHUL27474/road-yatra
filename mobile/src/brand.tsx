// Jai Shree Shyam Tour & Travels brand: business facts, the logo (feather, car and road) and the wordmark.
import { Image, ImageStyle, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts } from './theme';

/** Business facts shown in the app. Keep in sync with the website. */
export const BRAND = {
  name: 'Jai Shree Shyam Tour & Travels',
  short: 'JSS Travels',
  wordmark: 'Jai Shree Shyam',
  wordmarkSub: 'Tour & Travels',
  devotional: '॥ जय श्री श्याम ॥',
  hindiName: 'जय श्री श्याम टूर्स एंड ट्रैवल्स',
  tagline: 'Your Journey Our Priority',
  values: 'Safe · Comfortable · Reliable',
  phone: '+91 99976 81790',
  contactPerson: 'Ajeet Kushwaha',
  email: 'info@jaishreeshyamtravels.com',
  website: 'jaishreeshyamtravels.com',
  address: '17 Meel, Pachpeda, Khatima, Udham Singh Nagar, Uttarakhand',
  gstin: '05GFGPK7444D1ZH',
  proprietor: 'Sanjeev Singh Kushwaha',
  whatsapp: 'https://wa.me/919997681790',
} as const;

/** Support number: the server's configured number, falling back to the office number. */
export const supportPhone = (configured?: string | null) => configured || BRAND.phone;
export const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

const LOGO_MARK = require('../assets/images/logo-mark.png');
const LOGO_FULL = require('../assets/images/logo-full.png');

/**
 * The logo mark: the peacock feather, car and road from the client's logo on a white tile.
 * Same picture as the app icon and the website's browser icon.
 * `ring` adds a hairline light edge so the tile stands out on the navy headers.
 */
export function Emblem({ size = 40, ring = false, style }: { size?: number; ring?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[{ width: size, height: size, borderRadius: size * 0.24, overflow: 'hidden', backgroundColor: colors.white }, ring && { borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }, style]}
      accessibilityRole="image"
      accessibilityLabel={BRAND.name}
    >
      <Image source={LOGO_MARK} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

/** The full logo with "Jai Shree Shyam / Tour and Travels" (transparent background; best on white). */
export function FullLogo({ width = 220, style }: { width?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={LOGO_FULL} style={[{ width, height: width * 0.926 }, style]} resizeMode="contain" accessibilityLabel={BRAND.name} />;
}

/** Kept for existing call sites: the brand mark. */
export function LogoMark({ size = 40 }: { size?: number; tone?: 'brand' | 'light' }) {
  return <Emblem size={size} />;
}

/** "॥ जय श्री श्याम ॥" in gold. Uses the system font, which carries the Devanagari glyphs. */
export function Devotional({ size = 12, color = colors.gold, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[{ fontSize: size, lineHeight: Math.round(size * 1.5), fontWeight: '700', color, letterSpacing: 0.5 }, style]} numberOfLines={1}>
      {BRAND.devotional}
    </Text>
  );
}

/** Small route motif: a winding dashed road ending in a pin. */
export function RouteMotif({ width = 64, color = colors.gold }: { width?: number; color?: string }) {
  return (
    <Svg width={width} height={(width * 16) / 64} viewBox="0 0 64 16" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M2 12 C14 2 24 14 36 8 S52 4 56 7" stroke={color} strokeWidth={1.8} strokeDasharray="3 3" strokeLinecap="round" fill="none" />
      <Circle cx="58.5" cy="7" r="3.6" fill={color} />
      <Circle cx="58.5" cy="7" r="1.3" fill={colors.brandDark} />
    </Svg>
  );
}

/** Emblem + "Jai Shree Shyam / TOUR & TRAVELS" wordmark. `light` is for the blue gradient headers. */
export function Logo({
  size = 36,
  light,
  tagline,
  devotional,
  style,
}: {
  size?: number;
  light?: boolean;
  tagline?: string;
  /** Show the small gold ॥ जय श्री श्याम ॥ line above the name. */
  devotional?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const fs = Math.round(size * 0.5);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: Math.round(size * 0.3) }, style]}>
      <Emblem size={size} ring={light} />
      <View style={{ flexShrink: 1 }}>
        {devotional ? <Devotional size={11} color={light ? colors.gold : colors.accent} style={{ marginBottom: -1 }} /> : null}
        <Text
          style={{ fontFamily: fonts.extrabold, fontSize: fs, lineHeight: Math.round(fs * 1.2), letterSpacing: -0.3, color: light ? colors.white : colors.brandDark }}
          numberOfLines={1}
        >
          {BRAND.wordmark}
        </Text>
        <Text
          style={{ fontFamily: fonts.bold, fontSize: Math.max(9, Math.round(size * 0.27)), lineHeight: Math.round(size * 0.38), letterSpacing: 1.6, color: light ? colors.gold : colors.accent }}
          numberOfLines={1}
        >
          {BRAND.wordmarkSub.toUpperCase()}
        </Text>
        {tagline ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: light ? colors.onBrandMuted : colors.textMuted }} numberOfLines={1}>
            {tagline}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
