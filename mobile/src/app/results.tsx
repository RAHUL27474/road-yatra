import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage, TripSummary } from '../api';
import { dayDiff, fmtDuration, fmtTime, fmtYmdShort, inr, nextDays, VEHICLE_TYPE } from '../format';
import { VehicleArt } from '../illustrations';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../theme';
import { amenityIcon, Button, EmptyState, ErrorBanner, hapticSelect, Header, HeaderButton, Screen, Skeleton } from '../ui';

type Sort = 'early' | 'cheap';
const PRICE_DAYS = 14;

/** Departure-time filters (IST hours, end exclusive), as on redBus. */
type Slot = 'morning' | 'afternoon' | 'evening' | 'night';
const SLOTS: { key: Slot; label: string; icon: 'partly-sunny-outline' | 'sunny-outline' | 'cloudy-night-outline' | 'moon-outline'; from: number; to: number }[] = [
  { key: 'morning', label: 'Morning', icon: 'partly-sunny-outline', from: 6, to: 12 },
  { key: 'afternoon', label: 'Afternoon', icon: 'sunny-outline', from: 12, to: 17 },
  { key: 'evening', label: 'Evening', icon: 'cloudy-night-outline', from: 17, to: 21 },
  { key: 'night', label: 'Night', icon: 'moon-outline', from: 21, to: 30 },
];
const istHour = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3_600_000).getUTCHours();
const inSlot = (iso: string, s: Slot) => {
  const slot = SLOTS.find((x) => x.key === s)!;
  const h = istHour(iso);
  // Night runs 21:00-06:00, so early hours count as 24+.
  const hh = h < 6 ? h + 24 : h;
  return hh >= slot.from && hh < slot.to;
};

/** Lowest open fare per day for a route (null = no trips), cached for the session. */
const priceCache = new Map<string, number | null>();
const priceKey = (from: string, to: string, ymd: string) => `${from}|${to}|${ymd}`;
const lowestFare = (trips: TripSummary[]) => {
  const open = trips.filter((t) => t.seatsLeft > 0);
  return open.length ? Math.min(...open.map((t) => t.fare)) : null;
};

function useDayPrices(from: string, to: string, days: { ymd: string }[]) {
  const [, bump] = useState(0);
  useEffect(() => {
    let alive = true;
    days.slice(0, PRICE_DAYS).forEach((d) => {
      const k = priceKey(from, to, d.ymd);
      if (priceCache.has(k)) return;
      api<{ trips: TripSummary[] }>(`/api/trips/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${d.ymd}`)
        .then((r) => {
          priceCache.set(k, lowestFare(r.trips));
          if (alive) bump((n) => n + 1);
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, [from, to, days]);
  return (ymd: string) => priceCache.get(priceKey(from, to, ymd));
}

export default function Results() {
  // changeFor / need / exclude: choosing a new trip for an existing booking (free date change).
  const { from, to, date, changeFor, need, exclude } = useLocalSearchParams<{ from: string; to: string; date: string; changeFor?: string; need?: string; exclude?: string }>();
  const change = changeFor ? { changeFor, need: Number(need) || 1, exclude: exclude ?? '' } : null;
  const days = useMemo(() => nextDays(30), []);
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<Sort>('early');
  const [slot, setSlot] = useState<Slot | null>(null);
  const priceOf = useDayPrices(from, to, days);

  const load = useCallback(async () => {
    try {
      const q = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}`;
      const list = (await api<{ trips: TripSummary[] }>(`/api/trips/search?${q}`)).trips;
      priceCache.set(priceKey(from, to, date), lowestFare(list));
      setError(null);
      setTrips(change ? list.filter((t) => t.id !== change.exclude && t.seatsLeft >= change.need) : list);
    } catch (e) {
      setError(errorMessage(e));
      setTrips((t) => t ?? []);
    }
  }, [from, to, date]);

  useEffect(() => {
    load();
  }, [load]);

  const changeDate = (ymd: string) => {
    if (ymd === date) return;
    hapticSelect();
    setTrips(null);
    router.setParams({ date: ymd });
  };

  const sorted = useMemo(() => {
    if (!trips) return null;
    const list = slot ? trips.filter((t) => inSlot(t.departAt, slot)) : [...trips];
    // Sold-out trips always go last.
    list.sort(
      (a, b) =>
        Number(a.seatsLeft <= 0) - Number(b.seatsLeft <= 0) ||
        (sort === 'cheap' ? a.fare - b.fare : 0) ||
        a.departAt.localeCompare(b.departAt),
    );
    return list;
  }, [trips, sort, slot]);

  const failed = !!error && !trips?.length;
  const count = failed ? 'Could not load trips' : trips ? `${trips.length} trip${trips.length === 1 ? '' : 's'}` : 'Searching…';
  const modify = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen>
      <Header
        title={change ? `Change date · ${from} → ${to}` : `${from} → ${to}`}
        subtitle={`${fmtYmdShort(date)} · ${count}`}
        right={<HeaderButton icon="create-outline" label="Modify" onPress={modify} accessibilityLabel="Modify search" />}
      />
      <DateStrip days={days} value={date} onChange={changeDate} priceOf={priceOf} />
      {trips === null || trips.length ? (
        <View style={st.sortRow}>
          <Text style={[type('xs', 'semibold', colors.textMuted), { flex: 1 }]} numberOfLines={1}>
            {trips ? `${trips.length} ${trips.length === 1 ? 'trip' : 'trips'} found` : 'Looking for trips…'}
          </Text>
          <SortPill label="Earliest" icon="time-outline" on={sort === 'early'} onPress={() => setSort('early')} />
          <SortPill label="Cheapest" icon="pricetag-outline" on={sort === 'cheap'} onPress={() => setSort('cheap')} />
        </View>
      ) : null}
      {trips && trips.length > 1 ? (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.slotRow}>
            {SLOTS.map((s) => {
              const on = slot === s.key;
              const n = trips.filter((t) => inSlot(t.departAt, s.key)).length;
              return (
                <Pressable
                  key={s.key}
                  disabled={!n && !on}
                  onPress={() => {
                    hapticSelect();
                    setSlot(on ? null : s.key);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: !n && !on }}
                  style={({ pressed }) => [st.slot, on && st.slotOn, !n && !on && { opacity: 0.45 }, pressed && { opacity: 0.75 }]}
                >
                  <Ionicons name={s.icon} size={15} color={on ? colors.brand : colors.textMuted} />
                  <Text style={type('xs', 'bold', on ? colors.brand : colors.text)}>{s.label}</Text>
                  <Text style={[type('xs', 'semibold', on ? colors.brand : colors.textSubtle), tabular]}>{n}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      {sorted === null ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2].map((i) => (
            <TripCardSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: spacing.lg, flexGrow: 1, gap: spacing.md }}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          ListHeaderComponent={failed ? null : <ErrorBanner message={error} onRetry={load} />}
          ListEmptyComponent={
            slot && trips?.length ? (
              <EmptyState
                art="noTrips"
                title="No trips at this time"
                text="Clear the time filter to see every trip on this date."
                action={<Button title="Show all trips" variant="outline" icon="close" onPress={() => setSlot(null)} />}
              />
            ) : failed ? (
              <EmptyState
                art="error"
                title="Couldn't load trips"
                text={error ?? undefined}
                action={<Button title="Try again" icon="refresh" onPress={load} />}
              />
            ) : (
              <EmptyState
                art="noTrips"
                title="No trips on this date"
                text={`We have no scheduled trips from ${from} to ${to} on ${fmtYmdShort(date)}. Try another date above, or book a full cab.`}
                action={
                  <View style={{ gap: spacing.sm }}>
                    <Button title="Book a full cab" icon="car-sport-outline" onPress={() => router.dismissTo({ pathname: '/', params: { tab: 'hire' } })} />
                    <Button title="Change search" variant="outline" icon="search" onPress={modify} />
                  </View>
                }
              />
            )
          }
          renderItem={({ item }) => <TripCard trip={item} change={change} />}
        />
      )}
    </Screen>
  );
}

function SortPill({ label, icon, on, onPress }: { label: string; icon: 'time-outline' | 'pricetag-outline'; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        if (!on) hapticSelect();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [st.pill, on && st.pillOn, pressed && { opacity: 0.75 }]}
    >
      <Ionicons name={on ? 'checkmark' : icon} size={14} color={on ? colors.white : colors.textMuted} />
      <Text style={type('xs', 'bold', on ? colors.white : colors.text)}>{label}</Text>
    </Pressable>
  );
}

/** White strip of the next 30 days, each with the lowest fare (first two weeks). */
function DateStrip({
  days,
  value,
  onChange,
  priceOf,
}: {
  days: ReturnType<typeof nextDays>;
  value: string;
  onChange: (ymd: string) => void;
  priceOf: (ymd: string) => number | null | undefined;
}) {
  const ref = useRef<FlatList>(null);
  const index = Math.max(0, days.findIndex((d) => d.ymd === value));
  const W = 72;
  return (
    <View style={st.strip}>
      <FlatList
        ref={ref}
        horizontal
        data={days}
        keyExtractor={(d) => d.ymd}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.sm }}
        getItemLayout={(_, i) => ({ length: W + spacing.sm, offset: spacing.lg + i * (W + spacing.sm), index: i })}
        initialScrollIndex={index > 2 ? index - 2 : 0}
        renderItem={({ item, index: i }) => {
          const on = item.ymd === value;
          const price = i < PRICE_DAYS ? priceOf(item.ymd) : undefined;
          return (
            <Pressable
              onPress={() => onChange(item.ymd)}
              style={({ pressed }) => [st.day, { width: W }, on && st.dayOn, pressed && !on && { backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${fmtYmdShort(item.ymd)}${price ? `, from ${inr(price)}` : ''}`}
            >
              <Text style={type('xs', 'semibold', on ? colors.brand : colors.textMuted)} numberOfLines={1}>
                {item.day === 'Tomorrow' ? 'Tmrw' : item.day}
              </Text>
              <Text style={[type('sm', 'extrabold', on ? colors.brand : colors.text), tabular]} numberOfLines={1}>
                {item.date}
              </Text>
              <Text
                style={[type('xs', 'semibold', price ? colors.success : colors.textSubtle), tabular, { lineHeight: 15 }]}
                numberOfLines={1}
              >
                {price ? inr(price) : price === null ? 'No trips' : ' '}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function TripCard({ trip, change }: { trip: TripSummary; change?: { changeFor: string; need: number } | null }) {
  const soldOut = trip.seatsLeft <= 0;
  const few = !soldOut && trip.seatsLeft <= 3;
  const plusDays = dayDiff(trip.departAt, trip.arriveAt);
  return (
    <Pressable
      disabled={soldOut}
      onPress={() =>
        router.push({ pathname: '/seats/[tripId]', params: change ? { tripId: trip.id, changeFor: change.changeFor, need: String(change.need) } : { tripId: trip.id } })
      }
      android_ripple={{ color: colors.brandRipple }}
      accessibilityRole="button"
      accessibilityLabel={`${fmtTime(trip.departAt)} to ${fmtTime(trip.arriveAt)}, ${trip.vehicle.name}, ${inr(trip.fare)} per seat${soldOut ? ', sold out' : ''}`}
      style={({ pressed }) => [st.card, soldOut && { opacity: 0.6 }, pressed && { transform: [{ scale: 0.985 }], opacity: 0.96 }]}
    >
      <View style={st.cardBody}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <View>
              <Text style={[type('xl', 'extrabold'), tabular]}>{fmtTime(trip.departAt)}</Text>
              <Text style={type('xs', 'medium', colors.textMuted)} numberOfLines={1}>
                {trip.fromCity}
              </Text>
            </View>
            <View style={st.duration}>
              <Text style={[type('xs', 'semibold', colors.textMuted), tabular]}>{fmtDuration(trip.durationMins)}</Text>
              <View style={st.durLine}>
                <View style={st.durDot} />
                <View style={st.durDash} />
                <View style={[st.durDot, { backgroundColor: colors.accent, borderColor: colors.accent }]} />
              </View>
            </View>
            <View>
              <Text style={[type('xl', 'extrabold'), tabular]}>
                {fmtTime(trip.arriveAt)}
                {plusDays > 0 ? <Text style={type('xs', 'bold', colors.accent)}>{` +${plusDays}`}</Text> : null}
              </Text>
              <Text style={type('xs', 'medium', colors.textMuted)} numberOfLines={1}>
                {trip.toCity}
              </Text>
            </View>
          </View>
          <View style={st.price}>
            <Text style={[type('xl', 'extrabold'), tabular]}>{inr(trip.fare)}</Text>
            <Text style={type('xs', 'regular', colors.textMuted)}>per seat</Text>
          </View>
        </View>

        <View style={st.divider} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <VehicleArt type={trip.vehicle.type} width={72} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={type('sm', 'bold')} numberOfLines={1}>
              {trip.vehicle.name}
            </Text>
            <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
              {VEHICLE_TYPE[trip.vehicle.type]} · {trip.vehicle.seats} seats
            </Text>
            {trip.vehicle.amenities.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: 2, marginTop: 4 }}>
                {trip.vehicle.amenities.slice(0, 3).map((a) => (
                  <View key={a} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <MaterialCommunityIcons name={amenityIcon(a)} size={14} color={colors.textMuted} />
                    <Text style={type('xs', 'medium', colors.textMuted)} numberOfLines={1}>
                      {a}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={st.footer}>
        {soldOut ? (
          <View style={st.seatsLeft}>
            <Ionicons name="close-circle" size={16} color={colors.danger} />
            <Text style={type('xs', 'bold', colors.danger)}>Sold out</Text>
          </View>
        ) : (
          <View style={st.seatsLeft}>
            <MaterialCommunityIcons name={few ? 'fire' : 'seat-passenger'} size={16} color={few ? colors.danger : colors.success} />
            <Text style={type('xs', 'bold', few ? colors.danger : colors.success)}>
              {few ? `Only ${trip.seatsLeft} seat${trip.seatsLeft === 1 ? '' : 's'} left` : `${trip.seatsLeft} seats left`}
            </Text>
          </View>
        )}
        {!soldOut ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={type('sm', 'bold', colors.brand)}>Select seats</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.brand} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function TripCardSkeleton() {
  return (
    <View style={st.card}>
      <View style={st.cardBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ gap: 6 }}>
            <Skeleton width={58} height={22} />
            <Skeleton width={50} height={12} />
          </View>
          <Skeleton width={60} height={8} style={{ flex: 1 }} />
          <View style={{ gap: 6 }}>
            <Skeleton width={58} height={22} />
            <Skeleton width={40} height={12} />
          </View>
          <View style={{ gap: 6, alignItems: 'flex-end', marginLeft: spacing.md }}>
            <Skeleton width={56} height={22} />
            <Skeleton width={44} height={12} />
          </View>
        </View>
        <View style={st.divider} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Skeleton width={72} height={30} r={8} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      </View>
      <View style={st.footer}>
        <Skeleton width={96} height={14} />
        <Skeleton width={84} height={14} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  modify: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    minHeight: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  strip: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  day: {
    minHeight: 60,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
  },
  dayOn: { borderColor: colors.brand, borderWidth: 1.5, backgroundColor: colors.brandLight },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    minHeight: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillOn: { backgroundColor: colors.text, borderColor: colors.text },
  slotRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  slotOn: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  card: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', ...shadowSoft },
  cardBody: { padding: spacing.lg },
  duration: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm, minWidth: 56 },
  durLine: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: 3 },
  durDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: colors.card },
  durDash: { flex: 1, height: 0, borderTopWidth: 1.5, borderColor: colors.textSubtle, borderStyle: 'dashed' },
  price: { alignItems: 'flex-end', marginLeft: spacing.md, paddingLeft: spacing.md, borderLeftWidth: 1, borderLeftColor: colors.border },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  seatsLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
