// Road Yatra design tokens. Shared design language with the driver app — keep the two in sync.
import { Platform, TextStyle, ViewStyle } from 'react-native';

export const colors = {
  brand: '#0B5ED7',
  brandDark: '#0847A6',
  brandLight: '#E8F1FF',
  accent: '#FF6D38',
  accentLight: '#FFF1EA',
  accentGradient: ['#FF8A3D', '#FF5A36'] as const,
  brandGradient: ['#0B5ED7', '#0847A6'] as const,
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  text: '#0F172A',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  border: '#E2E8F0',
  background: '#F1F5F9',
  surface: '#F8FAFC',
  card: '#FFFFFF',
  white: '#FFFFFF',
  onBrandMuted: '#C7DBFF',
  seatTaken: '#E2E8F0',
  overlay: 'rgba(15, 23, 42, 0.45)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { input: 8, card: 14, pill: 999 } as const;

/** Inter font family names, loaded in the root layout. Android needs one family per weight. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;
export type FontWeight = keyof typeof fonts;

export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 } as const;

/** Text style helper: `type('md', 'bold')`. */
export const type = (size: keyof typeof fontSize = 'sm', weight: FontWeight = 'regular', color: string = colors.text): TextStyle => ({
  fontFamily: fonts[weight],
  fontSize: fontSize[size],
  color,
  // Inter renders a little tall; explicit line heights keep rows aligned.
  lineHeight: Math.round(fontSize[size] * 1.35),
});

/** Fixed-width digits so times and prices line up. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const shadow: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  default: { elevation: 3, shadowColor: '#0F172A' },
})!;

export const shadowSoft: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  default: { elevation: 2, shadowColor: '#0F172A' },
})!;

export const theme = { colors, spacing, radius, fonts, fontSize, shadow, shadowSoft, type, tabular };
export default theme;
