import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ReactNode, useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { api, errorMessage, TripDetail } from '../../api';
import { fmtDateShort, fmtDuration, fmtTime, inr, VEHICLE_TYPE } from '../../format';
import { VehicleArt } from '../../illustrations';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../../theme';
import { amenityIcon, Button, ErrorBanner, hapticSelect, Header, Screen, Skeleton } from '../../ui';

const MAX_SEATS = 10;
const AISLE = 22;
const GAP = 8;

type SeatState = 'free' | 'sel' | 'taken';
const SEAT_COLORS: Record<SeatState, { fill: string; stroke: string; back: string; fg: string }> = {
  free: { fill: colors.white, stroke: '#7FA3D6', back: '#EAF1FB', fg: colors.text },
  sel: { fill: colors.brand, stroke: colors.brandDark, back: '#2F7BE6', fg: colors.white },
  taken: { fill: '#E5E9EF', stroke: '#CFD6DF', back: '#D9DEE6', fg: colors.textSubtle },
};

export default function SeatSelection() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { width } = useWindowDimensions();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);

  const load = useCallback(() => {
    setError(null);
    api<{ trip: TripDetail }>(`/api/trips/${tripId}`)
      .then(({ trip: t }) => {
        setTrip(t);
        setSelected((sel) => sel.filter((n) => !t.takenSeats.includes(n)));
      })
      .catch((e) => setError(errorMessage(e)));
  }, [tripId]);

  // Reload whenever the screen is shown, so seats taken meanwhile turn grey.
  useFocusEffect(load);

  if (!trip)
    return (
      <Screen>
        <Header title="Select seats" />
        {error ? (
          <View style={{ padding: spacing.lg }}>
            <ErrorBanner message={error} onRetry={load} />
          </View>
        ) : (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={[st.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}>
              <Skeleton width={80} height={32} r={8} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="60%" height={16} />
                <Skeleton width="40%" height={12} />
              </View>
              <Skeleton width={52} height={22} />
            </View>
            <View style={[st.card, { alignItems: 'center', gap: spacing.lg }]}>
              <Skeleton width={260} height={28} r={14} />
              <Skeleton width={220} height={300} r={36} />
            </View>
          </View>
        )}
      </Screen>
    );

  const { seats, seatsPerRow, aisleAfter } = trip.vehicle;
  const perRow = Math.max(1, seatsPerRow);
  const rows: number[][] = [];
  for (let n = 1; n <= seats; n += perRow) rows.push(Array.from({ length: Math.min(perRow, seats - n + 1) }, (_, i) => n + i));
  const taken = new Set(trip.takenSeats);
  const hasAisle = aisleAfter > 0 && aisleAfter < perRow;
  // Fit the seat map inside the screen: screen padding, card padding and the vehicle body padding.
  const room = width - spacing.lg * 2 - spacing.lg * 2 - spacing.xl * 2 - 4 - (hasAisle ? AISLE : 0);
  const seat = Math.max(36, Math.min(52, Math.floor((room - GAP * (perRow - 1)) / perRow)));
  const free = seats - taken.size;

  const toggle = (n: number) => {
    hapticSelect();
    setSelected((sel) => {
      if (sel.includes(n)) return sel.filter((x) => x !== n);
      if (sel.length >= MAX_SEATS) {
        Alert.alert('Limit reached', `You can book up to ${MAX_SEATS} seats at a time.`);
        return sel;
      }
      return [...sel, n].sort((a, b) => a - b);
    });
  };

  const total = trip.fare * selected.length;

  return (
    <Screen>
      <Header title="Select seats" subtitle={`${trip.fromCity} → ${trip.toCity} · ${fmtDateShort(trip.departAt)}`} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <View style={st.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={[type('lg', 'extrabold'), tabular]}>{fmtTime(trip.departAt)}</Text>
                <View style={st.miniLine} />
                <Text style={[type('xs', 'semibold', colors.textMuted), tabular]}>
                  {fmtDuration(Math.round((Date.parse(trip.arriveAt) - Date.parse(trip.departAt)) / 60000))}
                </Text>
                <View style={st.miniLine} />
                <Text style={[type('lg', 'extrabold'), tabular]}>{fmtTime(trip.arriveAt)}</Text>
              </View>
              <Text style={[type('sm', 'bold'), { marginTop: spacing.sm }]} numberOfLines={1}>
                {trip.vehicle.name}
              </Text>
              <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
                {VEHICLE_TYPE[trip.vehicle.type]} · {free} of {seats} seats free
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <VehicleArt type={trip.vehicle.type} width={84} />
              <Text style={[type('md', 'extrabold'), tabular, { marginTop: 4 }]}>
                {inr(trip.fare)}
                <Text style={type('xs', 'regular', colors.textMuted)}> /seat</Text>
              </Text>
            </View>
          </View>
          {trip.vehicle.amenities.length ? (
            <View style={st.amenities}>
              {trip.vehicle.amenities.map((a) => (
                <View key={a} style={st.amenity}>
                  <MaterialCommunityIcons name={amenityIcon(a)} size={14} color={colors.brand} />
                  <Text style={type('xs', 'semibold')} numberOfLines={1}>
                    {a}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={[st.card, { alignItems: 'center', paddingHorizontal: spacing.lg }]}>
          <View style={st.legend}>
            <Legend kind="free" label="Available" />
            <Legend kind="sel" label="Selected" />
            <Legend kind="taken" label="Booked" />
          </View>

          <View style={st.body}>
            {/* side mirrors */}
            <View style={[st.mirror, { left: -9 }]} />
            <View style={[st.mirror, { right: -9 }]} />
            <View style={st.windshield}>
              <Svg width="100%" height={18} viewBox="0 0 200 18" preserveAspectRatio="none">
                <Path d="M6 16 Q100 -6 194 16" stroke="#C9D6E6" strokeWidth={3} fill="none" strokeLinecap="round" />
              </Svg>
            </View>
            <View style={st.front}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialCommunityIcons name="car-door" size={18} color={colors.textSubtle} />
                <Text style={type('xs', 'semibold', colors.textSubtle)}>Entry</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <SteeringWheel />
                <Text style={[type('xs', 'semibold', colors.textSubtle), { marginTop: 2 }]}>Driver</Text>
              </View>
            </View>
            <View style={{ gap: GAP + 2 }}>
              {rows.map((row, r) => (
                <View key={r} style={{ flexDirection: 'row', justifyContent: 'center', gap: GAP }}>
                  {row.map((n, i) => {
                    const isTaken = taken.has(n);
                    const isSel = selected.includes(n);
                    return (
                      <View key={n} style={{ flexDirection: 'row' }}>
                        <SeatTile n={n} size={seat} state={isTaken ? 'taken' : isSel ? 'sel' : 'free'} onPress={() => toggle(n)} />
                        {hasAisle && i + 1 === aisleAfter && i < row.length - 1 ? <View style={{ width: AISLE }} /> : null}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
            <View style={st.rear} />
          </View>
        </View>

        <View style={[st.card, { gap: spacing.md }]}>
          <InfoLine icon="radio-button-on" color={colors.brand} label="Pickup points" text={trip.pickupStops.map((p) => p.name).join(', ') || trip.fromCity} />
          <InfoLine icon="location" color={colors.accent} label="Drop points" text={trip.dropStops.map((p) => p.name).join(', ') || trip.toCity} />
          {trip.boardingPoint ? <InfoLine icon="information-circle-outline" color={colors.textMuted} label="Note" text={trip.boardingPoint} /> : null}
          <Text style={type('xs', 'regular', colors.textMuted)}>You choose your exact pickup and drop point on the next step.</Text>
        </View>
      </ScrollView>

      <SeatBar count={selected.length} seatNos={selected} total={total} onContinue={() => router.push({ pathname: '/passenger', params: { kind: 'SEAT', tripId: trip.id, seats: selected.join(',') } })} />
    </Screen>
  );
}

function SeatBar({ count, seatNos, total, onContinue }: { count: number; seatNos: number[]; total: number; onContinue: () => void }) {
  return (
    <View style={st.bar}>
      <BottomSafe>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {count ? (
              <>
                <Text style={type('xs', 'semibold', colors.textMuted)} numberOfLines={1}>
                  {count} seat{count > 1 ? 's' : ''} · No. {seatNos.join(', ')}
                </Text>
                <Text style={[type('xl', 'extrabold'), tabular]}>
                  {inr(total)}
                  <Text style={type('xs', 'medium', colors.textMuted)}> + GST</Text>
                </Text>
              </>
            ) : (
              <>
                <Text style={type('sm', 'bold')}>Choose your seats</Text>
                <Text style={type('xs', 'regular', colors.textMuted)}>Tap a seat on the map</Text>
              </>
            )}
          </View>
          <Button title="Continue" disabled={!count} onPress={onContinue} fullWidth={false} style={{ minWidth: 150 }} />
        </View>
      </BottomSafe>
    </View>
  );
}

/** Pads its children by the bottom safe-area inset. */
function BottomSafe({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={{ paddingBottom: Math.max(insets.bottom, spacing.md) }}>{children}</View>;
}

function SteeringWheel() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Circle cx="15" cy="15" r="12" stroke={colors.textMuted} strokeWidth={2.6} fill="none" />
      <Circle cx="15" cy="15" r="3.6" fill={colors.textMuted} />
      <Line x1="3.5" y1="13.5" x2="11.6" y2="14.4" stroke={colors.textMuted} strokeWidth={2.6} strokeLinecap="round" />
      <Line x1="26.5" y1="13.5" x2="18.4" y2="14.4" stroke={colors.textMuted} strokeWidth={2.6} strokeLinecap="round" />
      <Line x1="15" y1="18.6" x2="15" y2="26.5" stroke={colors.textMuted} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

/** A seat drawn from above: seat back across the top, cushion below, armrests on the sides. */
function SeatShape({ w, h, state }: { w: number; h: number; state: SeatState }) {
  const c = SEAT_COLORS[state];
  return (
    <Svg width={w} height={h} viewBox="0 0 40 44" style={StyleSheet.absoluteFill}>
      <Rect x="1.5" y="9" width="5" height="26" rx="2.5" fill={c.back} stroke={c.stroke} strokeWidth={1.4} />
      <Rect x="33.5" y="9" width="5" height="26" rx="2.5" fill={c.back} stroke={c.stroke} strokeWidth={1.4} />
      <Rect x="5" y="2" width="30" height="38" rx="7" fill={c.fill} stroke={c.stroke} strokeWidth={1.6} />
      <Rect x="9" y="33.5" width="22" height="5" rx="2.5" fill={c.back} />
    </Svg>
  );
}

function SeatTile({ n, size, state, onPress }: { n: number; size: number; state: SeatState; onPress: () => void }) {
  const h = Math.round(size * 1.1);
  return (
    <Pressable
      disabled={state === 'taken'}
      onPress={onPress}
      hitSlop={3}
      accessibilityRole="checkbox"
      accessibilityLabel={`Seat ${n}${state === 'taken' ? ', booked' : ''}`}
      accessibilityState={{ checked: state === 'sel', disabled: state === 'taken' }}
      style={({ pressed }) => [{ width: size, height: h, alignItems: 'center', justifyContent: 'center', paddingBottom: h * 0.12 }, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <SeatShape w={size} h={h} state={state} />
      {state === 'taken' ? (
        <Ionicons name="person" size={16} color={SEAT_COLORS.taken.fg} />
      ) : (
        <Text style={[type('sm', 'bold', SEAT_COLORS[state].fg), tabular]}>{n}</Text>
      )}
    </Pressable>
  );
}

function Legend({ kind, label }: { kind: SeatState; label: string }) {
  return (
    <View style={st.legendChip}>
      <View style={{ width: 16, height: 18 }}>
        <SeatShape w={16} h={18} state={kind} />
      </View>
      <Text style={type('xs', 'semibold', colors.text)}>{label}</Text>
    </View>
  );
}

function InfoLine({ icon, color, label, text }: { icon: 'radio-button-on' | 'location' | 'information-circle-outline'; color: string; label: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Ionicons name={icon} size={18} color={color} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={type('xs', 'medium', colors.textMuted)}>{label}</Text>
        <Text style={type('sm', 'medium')} numberOfLines={3}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, ...shadowSoft },
  miniLine: { flex: 1, maxWidth: 28, height: 1.5, backgroundColor: colors.border },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  amenity: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brandLight, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    minHeight: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: {
    borderWidth: 2,
    borderColor: '#D5DEE9',
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    minWidth: 230,
  },
  mirror: { position: 'absolute', top: 54, width: 9, height: 20, borderRadius: 4, backgroundColor: '#D5DEE9' },
  windshield: { marginHorizontal: spacing.sm, marginBottom: spacing.sm },
  front: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.md,
    marginBottom: spacing.lg,
    borderBottomWidth: 1.5,
    borderBottomColor: '#DFE6EF',
    borderStyle: 'dashed',
  },
  rear: { alignSelf: 'center', width: '60%', height: 4, borderRadius: 2, backgroundColor: '#DFE6EF', marginTop: spacing.lg },
  bar: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    ...shadowSoft,
  },
});
