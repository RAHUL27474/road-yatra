import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { api, Booking, Config, errorMessage, getConfig, TripDetail } from '../../api';
import { fmtDateShort, fmtDuration, fmtTime, inr, VEHICLE_TYPE } from '../../format';
import { seatRows } from '../../seats';
import { VehicleArt } from '../../illustrations';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../../theme';
import { amenityIcon, Button, ErrorBanner, hapticSelect, Header, Screen, Skeleton } from '../../ui';

const MAX_SEATS = 10;
const AISLE = 22;
const GAP = 8;

/** women: free seat next to a woman (women only); takenF: booked by a woman. */
type SeatState = 'free' | 'sel' | 'taken' | 'women' | 'takenF';
const PINK = '#DB2777';
const SEAT_COLORS: Record<SeatState, { fill: string; stroke: string; back: string; fg: string }> = {
  free: { fill: colors.white, stroke: '#7FA3D6', back: '#EAF1FB', fg: colors.text },
  sel: { fill: colors.brand, stroke: colors.brandDark, back: '#3A5BB8', fg: colors.white },
  taken: { fill: '#E5E9EF', stroke: '#CFD6DF', back: '#D9DEE6', fg: colors.textSubtle },
  women: { fill: '#FDF2F8', stroke: '#F472B6', back: '#FCE7F3', fg: PINK },
  takenF: { fill: '#FCE7F3', stroke: '#F9A8D4', back: '#FBCFE8', fg: PINK },
};

export default function SeatSelection() {
  // changeFor: moving an existing booking to this trip (free date change) — exactly `need` seats.
  const { tripId, changeFor, need } = useLocalSearchParams<{ tripId: string; changeFor?: string; need?: string }>();
  const needSeats = changeFor ? Math.max(1, Number(need) || 1) : 0;
  const { width } = useWindowDimensions();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {});
  }, []);

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

  const { seats, seatsPerRow, aisleAfter, seatLayout } = trip.vehicle;
  const all = seatRows(seats, seatsPerRow, seatLayout);
  // A single front seat (Ertiga, Dzire) is drawn next to the driver.
  const frontSeat = all.length > 1 && all[0].length === 1 ? all[0][0] : null;
  const rows = frontSeat ? all.slice(1) : all;
  const perRow = Math.max(1, ...rows.map((r) => r.length));
  const taken = new Set(trip.takenSeats);
  const femaleSeats = new Set(trip.femaleSeats ?? []);
  const womenOnly = new Set(trip.womenOnlySeats ?? []);
  const stateOf = (n: number): SeatState =>
    taken.has(n) ? (femaleSeats.has(n) ? 'takenF' : 'taken') : selected.includes(n) ? 'sel' : womenOnly.has(n) ? 'women' : 'free';
  const policy = (config?.travelPolicy ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const hasAisle = aisleAfter > 0 && aisleAfter < perRow;
  // Fit the seat map inside the screen: screen padding, card padding and the vehicle body padding.
  const room = width - spacing.lg * 2 - spacing.lg * 2 - spacing.xl * 2 - 4 - (hasAisle ? AISLE : 0);
  const seat = Math.max(36, Math.min(52, Math.floor((room - GAP * (perRow - 1)) / perRow)));
  const free = seats - taken.size;

  const toggle = (n: number) => {
    hapticSelect();
    setSelected((sel) => {
      if (sel.includes(n)) return sel.filter((x) => x !== n);
      if (needSeats && sel.length >= needSeats) {
        Alert.alert('Seats', `Your booking has ${needSeats} seat${needSeats > 1 ? 's' : ''}. Tap a chosen seat to remove it first.`);
        return sel;
      }
      if (sel.length >= MAX_SEATS) {
        Alert.alert('Limit reached', `You can book up to ${MAX_SEATS} seats at a time.`);
        return sel;
      }
      if (womenOnly.has(n))
        Alert.alert(
          'Women only',
          changeFor
            ? `Seat ${n} is next to a woman passenger, so it can only be taken by a woman. Choose it only if the traveller is a woman.`
            : `Seat ${n} is next to a woman passenger, so it can only be booked for a woman. You will mark the traveller on the next step.`,
        );
      return [...sel, n].sort((a, b) => a - b);
    });
  };

  const total = trip.fare * selected.length;

  // Free date change: move the booking to this trip with the chosen seats.
  const moveHere = async () => {
    setMoving(true);
    try {
      await api<{ booking: Booking }>(`/api/bookings/${changeFor}/change`, {
        // Women-only seats are taken for a woman (the alert said so when they were chosen).
        body: { tripId: trip.id, seatNos: selected, seatPassengers: selected.filter((n) => womenOnly.has(n)).map((seatNo) => ({ seatNo, female: true })) },
      });
      Alert.alert('Booking changed', `Your booking now is on ${fmtDateShort(trip.departAt)} at ${fmtTime(trip.departAt)}, seat ${selected.join(', ')}. Your QR ticket stays the same.`);
      router.dismissTo({ pathname: '/booking/[id]', params: { id: changeFor! } });
    } catch (e) {
      Alert.alert('Could not change', errorMessage(e));
      load();
    } finally {
      setMoving(false);
    }
  };

  return (
    <Screen>
      <Header title={changeFor ? `Choose ${needSeats} new seat${needSeats > 1 ? 's' : ''}` : 'Select seats'} subtitle={`${trip.fromCity} → ${trip.toCity} · ${fmtDateShort(trip.departAt)}`} />
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
            <Legend kind="women" label="Women only" />
          </View>
          {trip.womenBooked ? (
            <View style={st.womenNote}>
              <Ionicons name="woman" size={16} color={PINK} />
              <Text style={[type('xs', 'semibold', PINK), { flex: 1 }]}>
                {trip.womenBooked} wom{trip.womenBooked > 1 ? 'en' : 'an'} already travelling. Seats next to them are for women only.
              </Text>
            </View>
          ) : null}

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
              {frontSeat ? (
                <SeatTile n={frontSeat} size={seat} state={stateOf(frontSeat)} onPress={() => toggle(frontSeat)} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialCommunityIcons name="car-door" size={18} color={colors.textSubtle} />
                  <Text style={type('xs', 'semibold', colors.textSubtle)}>Entry</Text>
                </View>
              )}
              <View style={{ alignItems: 'center' }}>
                <SteeringWheel />
                <Text style={[type('xs', 'semibold', colors.textSubtle), { marginTop: 2 }]}>Driver</Text>
              </View>
            </View>
            <View style={{ gap: GAP + 2 }}>
              {rows.map((row, r) => (
                <View key={r} style={{ flexDirection: 'row', justifyContent: 'center', gap: GAP }}>
                  {row.map((n, i) => {
                    return (
                      <View key={n} style={{ flexDirection: 'row' }}>
                        <SeatTile n={n} size={seat} state={stateOf(n)} onPress={() => toggle(n)} />
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

        {policy.length ? (
          <View style={[st.card, { gap: spacing.sm }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <MaterialCommunityIcons name="bag-suitcase-outline" size={18} color={colors.brand} />
              <Text style={type('sm', 'bold')}>Luggage, children & pets</Text>
            </View>
            {policy.map((p) => (
              <View key={p} style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Text style={type('sm', 'bold', colors.textMuted)}>•</Text>
                <Text style={[type('sm', 'regular'), { flex: 1 }]}>{p}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <SeatBar
        count={selected.length}
        seatNos={selected}
        total={total}
        moving={changeFor ? { need: needSeats, busy: moving } : undefined}
        onContinue={() =>
          changeFor
            ? moveHere()
            : router.push({
                pathname: '/passenger',
                params: { kind: 'SEAT', tripId: trip.id, seats: selected.join(','), womenOnly: selected.filter((n) => womenOnly.has(n)).join(',') },
              })
        }
      />
    </Screen>
  );
}

function SeatBar({
  count,
  seatNos,
  total,
  moving,
  onContinue,
}: {
  count: number;
  seatNos: number[];
  total: number;
  moving?: { need: number; busy: boolean };
  onContinue: () => void;
}) {
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
          <Button
            title={moving ? 'Move booking' : 'Continue'}
            disabled={moving ? count !== moving.need : !count}
            loading={moving?.busy}
            onPress={onContinue}
            fullWidth={false}
            style={{ minWidth: 150 }}
          />
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
      disabled={state === 'taken' || state === 'takenF'}
      onPress={onPress}
      hitSlop={3}
      accessibilityRole="checkbox"
      accessibilityLabel={`Seat ${n}${state === 'taken' || state === 'takenF' ? ', booked' : state === 'women' ? ', women only' : ''}`}
      accessibilityState={{ checked: state === 'sel', disabled: state === 'taken' || state === 'takenF' }}
      style={({ pressed }) => [{ width: size, height: h, alignItems: 'center', justifyContent: 'center', paddingBottom: h * 0.12 }, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <SeatShape w={size} h={h} state={state} />
      {state === 'taken' || state === 'takenF' ? (
        <Ionicons name={state === 'takenF' ? 'woman' : 'person'} size={16} color={SEAT_COLORS[state].fg} />
      ) : (
        <Text style={[type('sm', 'bold', SEAT_COLORS[state].fg), tabular]}>{n}</Text>
      )}
    </Pressable>
  );
}

function Legend({ kind, label }: { kind: SeatState; label: string }) {
  return (
    <View style={st.legendChip}>
      <View style={{ width: 14, height: 16 }}>
        <SeatShape w={14} h={16} state={kind} />
      </View>
      <Text style={type('xs', 'medium', colors.textMuted)}>{label}</Text>
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
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  miniLine: { flex: 1, maxWidth: 28, height: 1.5, backgroundColor: colors.border },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  amenity: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brandLight, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  // One quiet row (redBus style): small seat swatch + label, no pill borders.
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
    rowGap: spacing.sm,
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  legendChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
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
  womenNote: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FDF2F8', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: spacing.md, alignSelf: 'stretch' },
  bar: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    ...shadowSoft,
  },
});
