// Jai Shree Shyam Tour & Travels design tokens (same palette as the website). Shared design language with the driver app — keep the two in sync.
import { Platform, TextStyle, ViewStyle } from 'react-native';

// Brand palette: royal blue (brand, headers, selection) + orange (the one action colour), neutral greys.
export const colors = {
  /** Royal blue: selected states, links, icons. */
  brand: '#1E4FD8',
  brandDark: '#173FAE',
  brandLight: '#EAF1FF',
  /** Orange: primary buttons and key highlights (the sun in the logo). */
  accent: '#F26A1B',
  accentLight: '#FFF1E8',
  /** Kept for existing call sites; primary buttons are a solid orange fill. */
  accentGradient: ['#F26A1B', '#F26A1B'] as const,
  /** Home / account / login hero: deep blue, same as the logo's background. */
  brandGradient: ['#0F2A75', '#1E4FD8'] as const,
  /** Gold sun from the logo: small highlights. */
  gold: '#F5A524',
  goldLight: '#FFF6E5',
  success: '#15803D',
  successLight: '#E8F6EE',
  warning: '#B45309',
  warningLight: '#FEF4E2',
  danger: '#DC2626',
  dangerLight: '#FDECEC',
  text: '#111827',
  textMuted: '#6B7280',
  textSubtle: '#9CA3AF',
  border: '#E5E7EB',
  background: '#F4F7FC',
  surface: '#F9FAFB',
  card: '#FFFFFF',
  white: '#FFFFFF',
  onBrandMuted: '#BFD0F5',
  seatTaken: '#E5E7EB',
  /** Brand-tinted ripple / focus ring. */
  brandRipple: 'rgba(30,79,216,0.06)',
  brandRing: 'rgba(30,79,216,0.16)',
  overlay: 'rgba(17, 24, 39, 0.5)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { input: 12, card: 16, pill: 999 } as const;

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

// Shadows stay barely-there; cards get their edge from a hairline border (see ui.card) instead.
export const shadow: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#111827', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  default: { elevation: 2, shadowColor: 'rgba(17,24,39,0.35)' },
})!;

export const shadowSoft: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#111827', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  default: { elevation: 1, shadowColor: 'rgba(17,24,39,0.3)' },
})!;

export const theme = { colors, spacing, radius, fonts, fontSize, shadow, shadowSoft, type, tabular };
export default theme;
