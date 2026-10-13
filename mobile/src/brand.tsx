// Road Yatra logo: a winding road running up to a destination pin, in a rounded square, plus the wordmark.
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors, fonts } from './theme';

const ROAD = 'M13 48 C14 34 31 31 27.4 16 L30.6 16 C36 32 19 36 31 48 Z';
const LANE = 'M22 46.5 C21 35 32.5 31 29 18';

/**
 * The logo mark. `tone="brand"` is the blue tile (for light backgrounds),
 * `tone="light"` is a white tile with a blue road (for the blue gradient headers).
 */
export function LogoMark({ size = 40, tone = 'brand' }: { size?: number; tone?: 'brand' | 'light' }) {
  const light = tone === 'light';
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Road Yatra">
      <Defs>
        <LinearGradient id="ryTile" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1C74F0" />
          <Stop offset="1" stopColor={colors.brandDark} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="48" height="48" rx="13" fill={light ? colors.white : 'url(#ryTile)'} />
      {/* road (narrowing into the distance), dashed centre line, destination pin */}
      <Path d={ROAD} fill={light ? colors.brand : colors.white} />
      <Path d={LANE} stroke={light ? colors.white : colors.accent} strokeWidth={1.7} strokeDasharray="2.8 2.4" strokeLinecap="round" fill="none" />
      <Circle cx="29" cy="10.5" r="4.6" fill={colors.accent} />
      <Circle cx="29" cy="10.5" r="1.7" fill={colors.white} />
    </Svg>
  );
}

/** Logo mark + "Road Yatra" wordmark. `light` is for dark (blue) backgrounds. */
export function Logo({
  size = 36,
  light,
  tagline,
  style,
}: {
  size?: number;
  light?: boolean;
  tagline?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const fs = Math.round(size * 0.58);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: Math.round(size * 0.28) }, style]}>
      <LogoMark size={size} tone={light ? 'light' : 'brand'} />
      <View>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: fs, lineHeight: Math.round(fs * 1.15), letterSpacing: -0.4 }} numberOfLines={1}>
          <Text style={{ color: light ? colors.white : colors.brandDark }}>Road</Text>
          <Text style={{ color: light ? '#FFB98A' : colors.accent }}> Yatra</Text>
        </Text>
        {tagline ? (
          <Text
            style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: light ? colors.onBrandMuted : colors.textMuted }}
            numberOfLines={1}
          >
            {tagline}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
