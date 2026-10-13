// Jai Shree Shyam Tour & Travels design tokens (same palette as the customer app and website).
// Drivers use this app inside a moving vehicle: high contrast, large type, big touch targets.
import { Platform, TextStyle, ViewStyle } from 'react-native';

export const colors = {
  brand: '#1E3A8A',
  brandDark: '#0B3D91',
  brandLight: '#E8EEFB',
  accent: '#F57C00',
  accentLight: '#FFF3E0',
  /** Golden yellow: devotional line and emblem ring. */
  gold: '#FFC107',
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  background: '#F1F5F9',
  card: '#FFFFFF',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(15, 23, 42, 0.55)',
  skeleton: '#E2E8F0',
  /** Text on the brand gradient. */
  onBrand: '#FFFFFF',
  onBrandMuted: 'rgba(255, 255, 255, 0.82)',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { input: 8, card: 14, pill: 999 } as const;

/** Minimum height of any primary button (driver-safe touch target). */
export const BUTTON_HEIGHT = 56;
export const BUTTON_HEIGHT_SM = 48;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
} as const;

/** Text styles. Body is 16; key numbers are 22-28. */
export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  h2: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17 },
  overline: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const shadow = {
  card: Platform.select<ViewStyle>({
    ios: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
    default: { elevation: 2 },
  }),
  raised: Platform.select<ViewStyle>({
    ios: { shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
    default: { elevation: 6 },
  }),
  bar: Platform.select<ViewStyle>({
    ios: { shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } },
    default: { elevation: 12 },
  }),
};

export const gradient = {
  brand: [colors.brand, colors.brandDark] as const,
  /** Red to saffron, for the few highlight CTAs. */
  accent: ['#D32F2F', '#F57C00'] as const,
};

/** Semantic tones used by badges, pills and icon buttons. */
export type Tone = 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
export const tones: Record<Tone, { fg: string; bg: string }> = {
  brand: { fg: colors.brand, bg: colors.brandLight },
  accent: { fg: '#C2410C', bg: colors.accentLight },
  success: { fg: '#15803D', bg: colors.successLight },
  warning: { fg: '#B45309', bg: colors.warningLight },
  danger: { fg: '#B91C1C', bg: colors.dangerLight },
  neutral: { fg: '#475569', bg: '#E2E8F0' },
};
