// Flat SVG illustrations: side-view vehicles (or the vehicle's photo) and the empty-state pictures. Neutral colours on purpose,
// so they sit well on white cards next to the blue brand colour.
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import { useState, type ReactElement } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { API_URL, type VehicleType } from './api';

const C = {
  body: '#E3E9F1',
  lower: '#CBD5E1',
  line: '#AEBBCB',
  glass: '#9DB4CF',
  glassHi: '#C3D3E6',
  tyre: '#1E293B',
  rim: '#CBD5E1',
  hub: '#64748B',
  shadow: '#E9EEF4',
  head: '#FCD34D',
  tail: '#F87171',
};

function Wheel({ cx, cy, r = 7.5 }: { cx: number; cy: number; r?: number }) {
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r + 1.8} fill={C.line} />
      <Circle cx={cx} cy={cy} r={r} fill={C.tyre} />
      <Circle cx={cx} cy={cy} r={r * 0.5} fill={C.rim} />
      <Circle cx={cx} cy={cy} r={r * 0.18} fill={C.hub} />
    </G>
  );
}

type Art = 'sedan' | 'hatchback' | 'muv' | 'suv' | 'traveller';
const ART_FOR: Record<VehicleType, Art> = {
  SEDAN: 'sedan',
  HATCHBACK: 'hatchback',
  ERTIGA: 'muv',
  SUV: 'suv',
  INNOVA_CRYSTA: 'suv',
  TEMPO_TRAVELLER: 'traveller',
  BUS: 'traveller',
  OTHER: 'sedan',
};

function Sedan() {
  return (
    <G>
      <Path
        d="M8 36 L8 29.5 Q8 25 13 24.2 L29 22 L41 13.2 Q43.5 11.5 47 11.5 L75 11.5 Q78.5 11.5 81 13.4 L93.5 22 L107 23.8 Q113 24.8 113 30 L113 36 Q113 38 111 38 L10 38 Q8 38 8 36 Z"
        fill={C.body}
      />
      <Path d="M8 31 L113 31 L113 36 Q113 38 111 38 L10 38 Q8 38 8 36 Z" fill={C.lower} />
      <Path d="M45 14.2 L59.5 14.2 L59.5 22 L34 22 Z" fill={C.glass} />
      <Path d="M63.5 14.2 L79 14.2 L90 22 L63.5 22 Z" fill={C.glass} />
      <Path d="M66 15.5 L70 15.5 L67 21 L65 21 Z" fill={C.glassHi} />
      <Line x1="61.5" y1="22" x2="61.5" y2="34" stroke={C.line} strokeWidth={0.8} />
      <Rect x="108.5" y="26" width="4.5" height="2.6" rx="1.2" fill={C.head} />
      <Rect x="8" y="26" width="3.5" height="2.6" rx="1.2" fill={C.tail} />
      <Wheel cx={31} cy={37} />
      <Wheel cx={92} cy={37} />
    </G>
  );
}

/** Premium hatchback (Tata Altroz): short tail, steep rear glass, long sloping windscreen. */
function Hatchback() {
  return (
    <G>
      <Path
        d="M12 36 L12 26 Q12 21.5 14.6 18.8 L21.6 11.6 Q23.4 10 26.4 10 L69 10 Q72.6 10 75.2 12 L88 21.6 L102 23.4 Q108 24.4 108 29.5 L108 36 Q108 38 106 38 L14 38 Q12 38 12 36 Z"
        fill={C.body}
      />
      <Path d="M12 31 L108 31 L108 36 Q108 38 106 38 L14 38 Q12 38 12 36 Z" fill={C.lower} />
      <Path d="M24 13 L40.5 13 L40.5 21.6 L17 21.6 Z" fill={C.glass} />
      <Path d="M43.5 13 L68.5 13 L83.5 21.6 L43.5 21.6 Z" fill={C.glass} />
      <Path d="M47 14.2 L51 14.2 L48 20.6 L46 20.6 Z" fill={C.glassHi} />
      <Line x1="42" y1="21.6" x2="42" y2="34" stroke={C.line} strokeWidth={0.8} />
      <Line x1="64" y1="21.6" x2="64" y2="34" stroke={C.line} strokeWidth={0.8} />
      <Rect x="103.5" y="25.6" width="4.5" height="2.6" rx="1.2" fill={C.head} />
      <Rect x="12" y="23" width="3.5" height="3.2" rx="1.2" fill={C.tail} />
      <Wheel cx={30} cy={37} />
      <Wheel cx={89} cy={37} />
    </G>
  );
}

function Muv() {
  return (
    <G>
      <Path
        d="M7 36 L7 27 Q7 23 11 22.2 L14.5 21.6 L21.5 11.6 Q23.2 10 26 10 L80 10 Q83.4 10 85.6 11.8 L97 21 L108.5 22.8 Q114 23.8 114 29 L114 36 Q114 38 112 38 L9 38 Q7 38 7 36 Z"
        fill={C.body}
      />
      <Path d="M7 30.5 L114 30.5 L114 36 Q114 38 112 38 L9 38 Q7 38 7 36 Z" fill={C.lower} />
      <Path d="M24.5 13 L38 13 L38 21 L17.6 21 Z" fill={C.glass} />
      <Path d="M41 13 L60 13 L60 21 L41 21 Z" fill={C.glass} />
      <Path d="M63 13 L82 13 L93 21 L63 21 Z" fill={C.glass} />
      <Path d="M66 14.2 L70 14.2 L67 20 L65 20 Z" fill={C.glassHi} />
      <Line x1="61.5" y1="21" x2="61.5" y2="34" stroke={C.line} strokeWidth={0.8} />
      <Line x1="39.5" y1="21" x2="39.5" y2="34" stroke={C.line} strokeWidth={0.8} />
      <Rect x="109.5" y="25" width="4.5" height="2.6" rx="1.2" fill={C.head} />
      <Rect x="7" y="24.5" width="3.5" height="3" rx="1.2" fill={C.tail} />
      <Wheel cx={28} cy={37} />
      <Wheel cx={93} cy={37} />
    </G>
  );
}

function Suv() {
  return (
    <G>
      <Line x1="27" y1="5.4" x2="78" y2="5.4" stroke={C.hub} strokeWidth={1.6} strokeLinecap="round" />
      <Path
        d="M6 34 L6 24 Q6 20 10 19.4 L14 18.8 L19 9 Q20.5 7 23.5 7 L82 7 Q85.2 7 87.4 9 L98 18.8 L110 20.6 Q115 21.6 115 26.6 L115 34 Q115 36 113 36 L8 36 Q6 36 6 34 Z"
        fill={C.body}
      />
      <Path d="M6 28.5 L115 28.5 L115 34 Q115 36 113 36 L8 36 Q6 36 6 34 Z" fill={C.lower} />
      <Path d="M21.5 10 L36.5 10 L36.5 18.8 L15.8 18.8 Z" fill={C.glass} />
      <Path d="M39.5 10 L60 10 L60 18.8 L39.5 18.8 Z" fill={C.glass} />
      <Path d="M63 10 L84 10 L95 18.8 L63 18.8 Z" fill={C.glass} />
      <Path d="M66 11.2 L70.5 11.2 L67.4 17.8 L65 17.8 Z" fill={C.glassHi} />
      <Line x1="61.5" y1="18.8" x2="61.5" y2="32" stroke={C.line} strokeWidth={0.8} />
      <Line x1="38" y1="18.8" x2="38" y2="32" stroke={C.line} strokeWidth={0.8} />
      <Rect x="110.5" y="23" width="4.5" height="3" rx="1.3" fill={C.head} />
      <Rect x="6" y="22" width="3.5" height="3.6" rx="1.3" fill={C.tail} />
      <Wheel cx={29} cy={36} r={8.2} />
      <Wheel cx={92} cy={36} r={8.2} />
    </G>
  );
}

function Traveller() {
  return (
    <G>
      <Path
        d="M5 36 L5 9 Q5 5 9 5 L91 5 Q95.4 5 97.6 8.6 L105.5 20.5 L110.5 22 Q115 23.5 115 28 L115 36 Q115 38 113 38 L7 38 Q5 38 5 36 Z"
        fill={C.body}
      />
      <Path d="M5 30 L115 30 L115 36 Q115 38 113 38 L7 38 Q5 38 5 36 Z" fill={C.lower} />
      {[9.5, 25.5, 41.5, 57.5].map((x) => (
        <Rect key={x} x={x} y="9.5" width="13.5" height="10.5" rx="1.8" fill={C.glass} />
      ))}
      <Rect x="75" y="9.5" width="13" height="10.5" rx="1.8" fill={C.glass} />
      <Path d="M92 9.5 L95.2 9.5 L102.5 20 L92 20 Z" fill={C.glass} />
      <Line x1="73" y1="9" x2="73" y2="34" stroke={C.line} strokeWidth={0.8} />
      <Line x1="90" y1="9" x2="90" y2="34" stroke={C.line} strokeWidth={0.8} />
      <Rect x="5" y="23.5" width="68" height="1.6" fill={C.line} />
      <Rect x="110.5" y="25" width="4.5" height="2.6" rx="1.2" fill={C.head} />
      <Rect x="5" y="24.5" width="3" height="3.4" rx="1.2" fill={C.tail} />
      <Wheel cx={24} cy={37} />
      <Wheel cx={95} cy={37} />
    </G>
  );
}

const ARTS: Record<Art, () => ReactElement> = { sedan: Sedan, hatchback: Hatchback, muv: Muv, suv: Suv, traveller: Traveller };

/**
 * The vehicle's photo when there is one (the office's upload or our own photo of the model, from the server),
 * else a side-view drawing (120 x 48 artboard) for its type. The photo keeps the drawing's width, a little taller.
 */
export function VehicleArt({
  type,
  photo,
  width = 96,
  style,
}: {
  type?: VehicleType | string | null;
  photo?: string | null;
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [broken, setBroken] = useState(false);
  if (photo && !broken) {
    const uri = photo.startsWith('/') ? API_URL + photo : photo;
    return (
      <View style={[{ width, height: Math.round(width * 0.62), borderRadius: 10, overflow: 'hidden', backgroundColor: C.body }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" onError={() => setBroken(true)} />
      </View>
    );
  }
  const Comp = ARTS[ART_FOR[type as VehicleType] ?? 'sedan'];
  return (
    <View style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={(width * 48) / 120} viewBox="0 0 120 48">
        <Ellipse cx="60" cy="44.5" rx="54" ry="2.6" fill={C.shadow} />
        <Comp />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------- empty-state pictures

export type IllustrationKind = 'noTrips' | 'tickets' | 'login' | 'error' | 'noVehicles';

const BLUE = '#1E3A8A';
const BLUE_SOFT = '#E8EEFB';
const BLUE_MID = '#BCCAEB';
const ORANGE = '#F57C00';

/** 160 x 120 spot illustration for empty and error states. */
export function Illustration({ kind, size = 160 }: { kind: IllustrationKind; size?: number }) {
  return (
    <Svg width={size} height={(size * 120) / 160} viewBox="0 0 160 120">
      <Circle cx="80" cy="60" r="54" fill={BLUE_SOFT} />
      {kind === 'noTrips' ? (
        <G>
          {/* road to the horizon with a signpost */}
          <Path d="M66 34 L94 34 L124 106 L36 106 Z" fill={BLUE_MID} />
          <Path d="M80 40 L80 48 M80 56 L80 66 M80 76 L80 90" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
          <Rect x="112" y="40" width="3.5" height="44" rx="1.5" fill="#94A3B8" />
          <Path d="M100 40 L128 40 L133 47 L128 54 L100 54 Z" fill={ORANGE} />
          <Rect x="105" y="45.5" width="16" height="3" rx="1.5" fill="#FFFFFF" />
          <Circle cx="45" cy="30" r="5" fill="#FFFFFF" />
          <Circle cx="38" cy="33" r="4" fill="#FFFFFF" />
        </G>
      ) : null}
      {kind === 'tickets' ? (
        <G>
          <G transform="rotate(-8 80 62)">
            <Path
              d="M42 38 H118 a6 6 0 0 1 6 6 V54 a8 8 0 0 0 0 16 V80 a6 6 0 0 1 -6 6 H42 a6 6 0 0 1 -6 -6 V70 a8 8 0 0 0 0 -16 V44 a6 6 0 0 1 6 -6 Z"
              fill="#FFFFFF"
              stroke={BLUE_MID}
              strokeWidth={2}
            />
            <Line x1="96" y1="42" x2="96" y2="82" stroke={BLUE_MID} strokeWidth={2} strokeDasharray="4 4" />
            <Rect x="48" y="50" width="34" height="6" rx="3" fill={BLUE} />
            <Rect x="48" y="62" width="26" height="5" rx="2.5" fill={BLUE_MID} />
            <Rect x="48" y="72" width="30" height="5" rx="2.5" fill={BLUE_MID} />
            <Circle cx="110" cy="62" r="7" fill={ORANGE} />
          </G>
        </G>
      ) : null}
      {kind === 'login' ? (
        <G>
          <Rect x="52" y="30" width="56" height="70" rx="10" fill="#FFFFFF" stroke={BLUE_MID} strokeWidth={2} />
          <Circle cx="80" cy="56" r="11" fill={BLUE_MID} />
          <Path d="M62 86 Q80 64 98 86 Z" fill={BLUE_MID} />
          <Circle cx="106" cy="88" r="13" fill={BLUE} />
          <Rect x="100" y="86" width="12" height="9" rx="2" fill="#FFFFFF" />
          <Path d="M102.5 86 V83.5 a3.5 3.5 0 0 1 7 0 V86" stroke="#FFFFFF" strokeWidth={2} fill="none" />
        </G>
      ) : null}
      {kind === 'error' ? (
        <G>
          {/* traffic cone */}
          <Rect x="50" y="94" width="60" height="8" rx="3" fill="#94A3B8" />
          <Path d="M72 30 L88 30 L104 94 L56 94 Z" fill={ORANGE} />
          <Path d="M67.5 50 L92.5 50 L95.5 62 L64.5 62 Z" fill="#FFFFFF" />
          <Path d="M61 74 L99 74 L101.5 84 L58.5 84 Z" fill="#FFFFFF" />
          <Rect x="70" y="26" width="20" height="6" rx="3" fill="#D32F2F" />
        </G>
      ) : null}
      {kind === 'noVehicles' ? (
        <G>
          <G transform="translate(20 46)">
            <Ellipse cx="60" cy="44.5" rx="54" ry="2.6" fill="#D3DCF0" />
            <Muv />
          </G>
          <Circle cx="118" cy="40" r="13" fill="#FFFFFF" stroke={BLUE} strokeWidth={4} />
          <Line x1="127" y1="49" x2="136" y2="58" stroke={BLUE} strokeWidth={5} strokeLinecap="round" />
        </G>
      ) : null}
    </Svg>
  );
}
