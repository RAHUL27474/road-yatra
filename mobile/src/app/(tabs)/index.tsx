import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Config, errorMessage, getConfig, QuoteResponse, RentalRequest, RentalType, Stop, TripSummary } from '../../api';
import { currentPosition, nearest } from '../../geo';
import { useAuth } from '../../auth';
import { BRAND, Logo, supportPhone, telUrl } from '../../brand';
import { DateTimeField } from '../../DateTimeField';
import { cityRegion, fmtDuration, fmtYmdShort, inr, nextDays, relativeDay, ymdIST } from '../../format';
import { VehicleArt } from '../../illustrations';
import { rentalCache } from '../../store';
import { openWhatsApp, PilgrimageSection, WhatsAppBookCard } from '../../pilgrimage';
import { OurDrivers } from '../../OurDrivers';
import { loadRecentSearches, RecentSearch, saveRecentSearch } from '../../recent';
import { colors, radius, shadow, shadowSoft, spacing, tabular, type } from '../../theme';
import { Button, Card, Chip, ErrorBanner, hapticSelect, hapticTap, IonName, MciName, Notice, OptionSheet, Skeleton } from '../../ui';

const RENTAL_TYPES: { key: RentalType; label: string; icon: IonName }[] = [
  { key: 'ONE_WAY', label: 'One way', icon: 'arrow-forward' },
  { key: 'ROUND_TRIP', label: 'Round trip', icon: 'repeat' },
  { key: 'LOCAL', label: 'Local', icon: 'time-outline' },
  { key: 'AIRPORT', label: 'Airport', icon: 'airplane-outline' },
];

const DEFAULT_FROM = 'Khatima';
const DEFAULT_TO = 'Delhi';
/** Second daily shared-taxi route featured on Home. */
const SECOND_TO = 'Haridwar';
const HILL_STATIONS = ['Nainital', 'Mussoorie', 'Rishikesh', 'Auli'];
const OVERLAP = 56;

/** Tomorrow (IST) at the given hour. */
const tomorrowAt = (hour: number, plusDays = 1) =>
  new Date(`${ymdIST(new Date(Date.now() + plusDays * 86_400_000))}T${String(hour).padStart(2, '0')}:00:00+05:30`);

type PickerKind = 'from' | 'to' | 'date' | 'pickup' | 'drop';

/**
 * Picker state for one screen. Pickers always start closed, close whenever the screen loses focus,
 * and ignore taps that arrive while the screen is still settling (first launch layout / tab switch),
 * so a stray launch-time touch can no longer leave the city list open.
 */
function usePicker() {
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const focusedAt = useRef(0);
  useFocusEffect(
    useCallback(() => {
      focusedAt.current = Date.now();
      setPicker(null);
      return () => setPicker(null);
    }, []),
  );
  const open = useCallback((k: PickerKind) => {
    if (Date.now() - focusedAt.current < 450) return;
    setPicker(k);
  }, []);
  const close = useCallback(() => setPicker(null), []);
  return { picker, open, close };
}

type RouteInfo = { from: string; to: string; minFare: number | null; durationMins: number | null };

export default function Home() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const scroll = useRef<ScrollView>(null);
  // Other screens can open Home on the Full cab tab with `?tab=hire`.
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'seats' | 'hire'>(tabParam === 'hire' ? 'hire' : 'seats');
  const [seenTabParam, setSeenTabParam] = useState(tabParam);
  if (tabParam !== seenTabParam) {
    setSeenTabParam(tabParam);
    if (tabParam === 'hire' || tabParam === 'seats') setTab(tabParam);
  }
  const [cities, setCities] = useState<string[]>([]);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [routes, setRoutes] = useState<RouteInfo[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  // Service tiles open the Full cab tab on a given type; the key remounts the form with it.
  const [hireType, setHireType] = useState<{ type: RentalType; key: number }>({ type: 'ONE_WAY', key: 0 });
  const tomorrow = useMemo(() => nextDays(2)[1].ymd, []);
  const today = useMemo(() => nextDays(1)[0].ymd, []);

  useEffect(() => {
    loadRecentSearches().then(setRecents);
  }, []);
  const onSearched = (s: RecentSearch) => {
    saveRecentSearch(s).then(setRecents);
  };

  const loadCities = useCallback(async () => {
    try {
      setCities((await api<{ cities: string[] }>('/api/cities')).cities);
      setCitiesError(null);
    } catch (e) {
      setCitiesError(errorMessage(e));
    }
  }, []);

  // Popular routes: tomorrow's lowest fare and the trip length, straight from the search API.
  const loadRoutes = useCallback(async () => {
    const pairs: [string, string][] = [
      [DEFAULT_FROM, DEFAULT_TO],
      [DEFAULT_FROM, SECOND_TO],
    ];
    const infos = await Promise.all(
      pairs.map(async ([from, to]) => {
        try {
          const { trips } = await api<{ trips: TripSummary[] }>(`/api/trips/search?from=${from}&to=${to}&date=${tomorrow}`);
          const open = trips.filter((t) => t.seatsLeft > 0);
          return {
            from,
            to,
            minFare: open.length ? Math.min(...open.map((t) => t.fare)) : null,
            durationMins: trips.length ? Math.min(...trips.map((t) => t.durationMins)) : null,
          };
        } catch {
          return { from, to, minFare: null, durationMins: null };
        }
      }),
    );
    setRoutes(infos);
  }, [tomorrow]);

  useEffect(() => {
    loadCities();
    loadRoutes();
    getConfig().then(setConfig).catch(() => {});
  }, [loadCities, loadRoutes]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCities(), loadRoutes(), getConfig().then(setConfig).catch(() => {})]);
    setRefreshing(false);
  };

  const hasDefaultRoute = cities.includes(DEFAULT_FROM) && cities.includes(DEFAULT_TO);
  const phone = supportPhone(config?.supportPhone);
  const callSupport = () => Linking.openURL(telUrl(phone)).catch(() => {});
  const openHire = (type?: RentalType) => {
    hapticTap();
    if (type) setHireType((h) => ({ type, key: h.key + 1 }));
    setTab('hire');
    scroll.current?.scrollTo({ y: 0, animated: true });
  };
  const openSeats = () => {
    hapticTap();
    setTab('seats');
    scroll.current?.scrollTo({ y: 0, animated: true });
  };
  const firstName = user?.name.split(/\s+/)[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.white} colors={[colors.brand]} />}
      >
        <LinearGradient
          colors={colors.brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + spacing.md, paddingBottom: OVERLAP + spacing.lg, paddingHorizontal: spacing.lg }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Logo light size={40} style={{ flex: 1, marginRight: spacing.sm }} />
            <Pressable
                onPress={callSupport}
                hitSlop={6}
                style={({ pressed }) => [st.headerIcon, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="Call customer support"
              >
                <Ionicons name="headset" size={20} color={colors.white} />
              </Pressable>
          </View>
          <Text style={[type('xl', 'extrabold', colors.white), { marginTop: spacing.xl, letterSpacing: -0.3 }]} numberOfLines={1}>
            {firstName ? `Namaste, ${firstName}` : 'Namaste'}
          </Text>
          <Text style={[type('sm', 'medium', colors.onBrandMuted), { marginTop: 2 }]} numberOfLines={1}>
            Delhi · Haridwar · Hill stations · 24×7 taxi
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -OVERLAP }}>
          <View style={st.searchCard}>
            <View style={st.tabs} accessibilityRole="tablist">
              <SearchTab label="Shared seat" sub="Pay per seat" icon="seat-passenger" on={tab === 'seats'} onPress={() => setTab('seats')} />
              <View style={st.tabSep} />
              <SearchTab label="Full cab" sub="Whole vehicle" icon="car-side" on={tab === 'hire'} onPress={() => setTab('hire')} />
            </View>
            <View style={{ padding: spacing.lg, paddingTop: spacing.sm }}>
              <ErrorBanner message={citiesError} onRetry={loadCities} style={{ marginTop: spacing.sm, marginBottom: spacing.xs }} />
              {tab === 'seats' ? (
                <SeatSearch cities={cities} hasDefaultRoute={hasDefaultRoute} onSearched={onSearched} />
              ) : (
                <HireSearch key={hireType.key} cities={cities} initialType={hireType.type} />
              )}
            </View>
          </View>

          {user?.role === 'ADMIN' ? (
            <Pressable
              onPress={() => {
                hapticTap();
                router.push('/admin');
              }}
              style={({ pressed }) => [st.adminCard, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel="Open the office dashboard"
            >
              <LinearGradient colors={['#0F172A', '#1E293B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.adminInner}>
                <View style={st.adminIcon}>
                  <Ionicons name="speedometer" size={22} color={colors.gold} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={type('md', 'bold', colors.white)}>Office dashboard</Text>
                  <Text style={type('xs', 'regular', '#CBD5E1')} numberOfLines={1}>
                    Bookings, trips, drivers, fleet and reports
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </LinearGradient>
            </Pressable>
          ) : null}

          {tab === 'seats' && recents.length ? (
            <>
              <SectionHeader title="Recent searches" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
                style={{ marginHorizontal: -spacing.lg }}
              >
                {recents.map((r) => {
                  // An old date moves up to today so the search still finds trips.
                  const date = r.date < today ? today : r.date;
                  return (
                    <Pressable
                      key={`${r.from}-${r.to}`}
                      onPress={() => {
                        hapticTap();
                        onSearched({ ...r, date });
                        router.push({ pathname: '/results', params: { from: r.from, to: r.to, date } });
                      }}
                      style={({ pressed }) => [st.recent, pressed && { opacity: 0.8 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Search ${r.from} to ${r.to} on ${fmtYmdShort(date)}`}
                    >
                      <View style={st.recentIcon}>
                        <Ionicons name="time-outline" size={16} color={colors.brand} />
                      </View>
                      <View style={{ minWidth: 0 }}>
                        <Text style={type('sm', 'bold')} numberOfLines={1}>
                          {r.from} → {r.to}
                        </Text>
                        <Text style={type('xs', 'medium', colors.textMuted)} numberOfLines={1}>
                          {fmtYmdShort(date)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          <SectionHeader title="Our services" />
          <View style={st.services}>
            <ServiceTile mci="seat-passenger" label="Shared seat" sub="from ₹800" onPress={openSeats} />
            <ServiceTile mci="car-side" label="One-way cab" sub="Any city" onPress={() => openHire('ONE_WAY')} />
            <ServiceTile mci="swap-horizontal" label="Round trip" sub="Driver waits" onPress={() => openHire('ROUND_TRIP')} />
            <ServiceTile mci="airplane" label="Airport" sub="Pickup / drop" onPress={() => openHire('AIRPORT')} />
            <ServiceTile mci="city-variant-outline" label="Local hire" sub="8 hr · 80 km" onPress={() => openHire('LOCAL')} />
            <ServiceTile
              mci="whatsapp"
              label="WhatsApp"
              sub="Chat to book"
              tint="#128C7E"
              bg="#E7F7EF"
              onPress={() => openWhatsApp('Namaste, I want to book a trip.\nFrom: \nTo: \nDate: \nSeats / people: ', config?.whatsapp)}
            />
          </View>

          {config?.returnDiscountPercent ? (
            <View style={st.offer}>
              <View style={st.offerBadge}>
                <Text style={[type('lg', 'extrabold', colors.white), tabular]}>{config.returnDiscountPercent}%</Text>
                <Text style={type('xs', 'bold', colors.white)}>OFF</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={type('md', 'bold')}>Return trip discount</Text>
                <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={2}>
                  Book your return journey after a trip with us and save {config.returnDiscountPercent}% on the fare.
                </Text>
              </View>
            </View>
          ) : null}

          {hasDefaultRoute || routes === null ? (
            <>
              <SectionHeader title="Popular routes" />
              <View style={{ gap: spacing.md }}>
                {routes === null
                  ? [0, 1, 2].map((i) => (
                      <View key={i} style={[st.routeCard, { gap: spacing.md }]}>
                        <Skeleton width={44} height={44} r={12} />
                        <View style={{ flex: 1, gap: 8 }}>
                          <Skeleton width="60%" height={16} />
                          <Skeleton width="40%" height={12} />
                        </View>
                        <Skeleton width={64} height={28} />
                      </View>
                    ))
                  : routes.map((r) => (
                      <RouteCard
                        key={`${r.from}-${r.to}`}
                        info={r}
                        onPress={() => router.push({ pathname: '/results', params: { from: r.from, to: r.to, date: tomorrow } })}
                      />
                    ))}
                {routes !== null ? <HillStationsCard onPress={() => openHire()} /> : null}
              </View>
            </>
          ) : null}

          <Pressable
            onPress={() => openHire()}
            style={({ pressed }) => [st.promo, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Book a full cab"
          >
            <View style={st.promoInner}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[type('xs', 'bold', colors.accent), { letterSpacing: 0.6 }]}>PRIVATE CAB</Text>
                <Text style={[type('lg', 'extrabold'), { marginTop: 2 }]}>Book a full cab</Text>
                <Text style={[type('xs', 'regular', colors.textMuted), { marginTop: 2 }]} numberOfLines={2}>
                  Ertiga, Dzire or Altroz with a driver. One way or round trip, day and night.
                </Text>
                <View style={st.promoCta}>
                  <Text style={type('sm', 'bold', colors.white)}>Get prices</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.white} />
                </View>
              </View>
              <VehicleArt type="ERTIGA" width={124} style={{ marginRight: -spacing.sm, marginTop: spacing.xl }} />
            </View>
          </Pressable>

          <WhatsAppBookCard phone={config?.whatsapp} />
          <PilgrimageSection phone={config?.whatsapp} />
          <OurDrivers />

          <SectionHeader title="Why travel with us" />
          <View style={st.whyCard}>
            <WhyRow icon="shield-checkmark-outline" title="Verified drivers" text="Licence-checked and approved by our office" />
            <WhyRow icon="navigate-outline" title="Live tracking" text="Share your trip with family in one tap" />
            <WhyRow icon="grid-outline" title="Pick your seat" text="Choose the exact seat you want" />
            <WhyRow icon="wallet-outline" title="Pay your way" text={config?.allowCash ? 'UPI, card or cash to the driver' : 'UPI, cards and net banking'} />
            <WhyRow icon="receipt-outline" title="Clear fares" text="No hidden charges · GST invoice with every trip" last />
          </View>

          <View style={st.support}>
              <View style={st.supportIcon}>
                <Ionicons name="headset" size={22} color={colors.brand} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={type('md', 'bold')} numberOfLines={1}>
                  Need help?
                </Text>
                <Text style={[type('sm', 'medium', colors.textMuted), tabular]} numberOfLines={1}>
                  Call us on {phone}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  hapticTap();
                  callSupport();
                }}
                style={({ pressed }) => [st.callBtn, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={`Call ${phone}`}
              >
                <Ionicons name="call" size={16} color={colors.white} />
                <Text style={type('sm', 'bold', colors.white)}>Call</Text>
              </Pressable>
          </View>
          <Text style={[type('xs', 'semibold', colors.textSubtle), { textAlign: 'center', marginTop: spacing.lg }]} numberOfLines={1}>
            {BRAND.name} · {BRAND.values}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md }}>
      <Text style={type('lg', 'bold')}>{title}</Text>
      {right}
    </View>
  );
}

function SearchTab({ label, sub, icon, on, onPress }: { label: string; sub: string; icon: 'seat-passenger' | 'car-side'; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        if (!on) hapticSelect();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [st.tab, pressed && !on && { backgroundColor: colors.surface }]}
    >
      <View style={[st.tabIcon, on && { backgroundColor: colors.brand }]}>
        <MaterialCommunityIcons name={icon} size={20} color={on ? colors.white : colors.textMuted} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={type('sm', 'bold', on ? colors.brand : colors.text)} numberOfLines={1}>
          {label}
        </Text>
        <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {on ? <View style={st.tabBar} /> : null}
    </Pressable>
  );
}

/** One line of the route box: caption, big city name and its region. */
function RouteLine({ caption, city, onPress }: { caption: string; city: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${caption}: ${city || 'Select city'}`}
      style={({ pressed }) => [st.routeLine, pressed && { backgroundColor: colors.surface }]}
    >
      <Text style={[type('xs', 'semibold', colors.textMuted), { letterSpacing: 0.6 }]}>{caption}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, paddingRight: 52 }}>
        <Text style={[city ? type('lg', 'extrabold') : type('lg', 'semibold', colors.textSubtle), { letterSpacing: -0.2, flexShrink: 1 }]} numberOfLines={1}>
          {city || 'Select city'}
        </Text>
        <Text style={[type('xs', 'regular', colors.textMuted), { flexShrink: 0 }]} numberOfLines={1}>
          {city ? cityRegion(city) : 'Tap to choose'}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * redBus-style route box: a green origin dot and a red destination pin joined by a dotted line, with a
 * swap button floating on the right. `to` is omitted for single-city searches (local / airport cabs).
 */
function RoutePicker({
  from,
  to,
  fromCaption = 'FROM',
  toCaption = 'TO',
  onFrom,
  onTo,
  onSwap,
}: {
  from: string;
  to?: string;
  fromCaption?: string;
  toCaption?: string;
  onFrom: () => void;
  onTo?: () => void;
  onSwap?: () => void;
}) {
  const two = to !== undefined && !!onTo;
  return (
    <View style={st.routeBox}>
      <View style={st.routeRail}>
        <View style={st.originDot} />
        {two ? (
          <>
            <View style={st.railDots} />
            <Ionicons name="location" size={18} color={colors.danger} />
          </>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <RouteLine caption={fromCaption} city={from} onPress={onFrom} />
        {two ? (
          <>
            <View style={st.routeSep} />
            <RouteLine caption={toCaption} city={to} onPress={onTo} />
          </>
        ) : null}
      </View>
      {two && onSwap ? (
        <Pressable
          style={({ pressed }) => [st.swap, pressed && { transform: [{ rotate: '180deg' }], backgroundColor: colors.brandLight }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Swap cities"
          onPress={() => {
            hapticSelect();
            onSwap();
          }}
        >
          <Ionicons name="swap-vertical" size={20} color={colors.brand} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** "Near me": sets From to the city of the pickup point closest to the customer. */
function NearMe({ cities, onCity }: { cities: string[]; onCity: (city: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const find = async () => {
    setBusy(true);
    setNote(null);
    try {
      const [here, res] = await Promise.all([currentPosition(), api<{ stops: Stop[] }>('/api/stops')]);
      const best = nearest(here, res.stops.filter((s) => cities.includes(s.city)));
      if (!best) throw new Error("Couldn't match your location to a city we serve.");
      onCity(best.item.city);
      setNote(best.km > 60 ? `Nearest city we serve: ${best.item.city} (${Math.round(best.km)} km)` : `From ${best.item.city}`);
    } catch (e) {
      setNote(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable onPress={find} disabled={busy} hitSlop={6} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md }}>
      <Ionicons name="locate" size={16} color={colors.brand} />
      <Text style={type('sm', 'semibold', colors.brand)}>{busy ? 'Finding you…' : 'Near me'}</Text>
      {note ? (
        <Text style={[type('xs', 'regular', colors.textMuted), { flexShrink: 1 }]} numberOfLines={1}>
          · {note}
        </Text>
      ) : null}
    </Pressable>
  );
}

function SeatSearch({ cities, hasDefaultRoute, onSearched }: { cities: string[]; hasDefaultRoute: boolean; onSearched: (s: RecentSearch) => void }) {
  const days = useMemo(() => nextDays(30), []);
  const { picker, open, close } = usePicker();
  // null = not chosen yet. Until the user picks, default to our main route Khatima → Delhi (if both are served).
  const [fromSel, setFrom] = useState<string | null>(null);
  const [toSel, setTo] = useState<string | null>(null);
  const [date, setDate] = useState(days[0].ymd);
  const from = fromSel ?? (hasDefaultRoute ? DEFAULT_FROM : '');
  const to = toSel ?? (hasDefaultRoute ? DEFAULT_TO : '');
  const cityOptions = cities.map((c) => ({ key: c, label: c, sub: cityRegion(c) || undefined }));
  const quick = date === days[0].ymd ? 'today' : date === days[1].ymd ? 'tomorrow' : 'other';

  const search = () => {
    if (!from || !to) return Alert.alert('Choose cities', 'Please select both From and To cities.');
    if (from === to) return Alert.alert('Choose cities', 'From and To cities must be different.');
    onSearched({ from, to, date });
    router.push({ pathname: '/results', params: { from, to, date } });
  };

  return (
    <View>
      <RoutePicker
        from={from}
        to={to}
        onFrom={() => open('from')}
        onTo={() => open('to')}
        onSwap={() => {
          setFrom(to);
          setTo(from);
        }}
      />

      <Pressable
        onPress={() => open('date')}
        accessibilityRole="button"
        accessibilityLabel={`Departure date: ${fmtYmdShort(date)}`}
        style={({ pressed }) => [st.dateBox, pressed && { backgroundColor: colors.surface }]}
      >
        <View style={st.dateIcon}>
          <Ionicons name="calendar" size={18} color={colors.brand} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[type('xs', 'semibold', colors.textMuted), { letterSpacing: 0.6 }]}>DATE OF JOURNEY</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
            <Text style={[type('lg', 'extrabold'), { letterSpacing: -0.2 }]} numberOfLines={1}>
              {fmtYmdShort(date)}
            </Text>
            <Text style={type('xs', 'semibold', colors.accent)}>{relativeDay(date)}</Text>
          </View>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.textSubtle} />
      </Pressable>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <Chip label="Today" selected={quick === 'today'} onPress={() => setDate(days[0].ymd)} />
        <Chip label="Tomorrow" selected={quick === 'tomorrow'} onPress={() => setDate(days[1].ymd)} />
        <Chip label={quick === 'other' ? fmtYmdShort(date) : 'Other date'} icon="calendar-outline" selected={quick === 'other'} onPress={() => open('date')} />
      </View>
      <NearMe
        cities={cities}
        onCity={(c) => {
          if (c === to) setTo(from);
          setFrom(c);
        }}
      />

      <Button title="Search trips" icon="search" onPress={search} style={{ marginTop: spacing.lg, height: 54 }} />

      <OptionSheet visible={picker === 'from'} title="Travelling from" options={cityOptions} value={from} onSelect={setFrom} onClose={close} icon="radio-button-on" />
      <OptionSheet visible={picker === 'to'} title="Going to" options={cityOptions} value={to} onSelect={setTo} onClose={close} icon="location" />
      <DateSheet visible={picker === 'date'} days={days} value={date} onSelect={setDate} onClose={close} />
    </View>
  );
}

/** Bottom sheet with the next 30 days as a grid of date tiles. */
function DateSheet({
  visible,
  days,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  days: ReturnType<typeof nextDays>;
  value: string;
  onSelect: (ymd: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        <View style={[st.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={st.sheetHandle} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={type('lg', 'bold')}>Departure date</Text>
            <Pressable onPress={onClose} hitSlop={10} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -8 }} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {days.map((d) => {
              const on = d.ymd === value;
              const [dd, mon] = d.date.split(' ');
              return (
                <Pressable
                  key={d.ymd}
                  onPress={() => {
                    hapticSelect();
                    onSelect(d.ymd);
                    onClose();
                  }}
                  style={({ pressed }) => [st.dayTile, on && st.dayTileOn, pressed && { opacity: 0.7 }]}
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={fmtYmdShort(d.ymd)}
                >
                  <Text style={type('xs', 'semibold', on ? colors.white : colors.textMuted)} numberOfLines={1}>
                    {d.day === 'Tomorrow' ? 'Tmrw' : d.day}
                  </Text>
                  <Text style={[type('lg', 'extrabold', on ? colors.white : colors.text), tabular]}>{dd}</Text>
                  <Text style={type('xs', 'medium', on ? colors.onBrandMuted : colors.textMuted)}>{mon}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function HireSearch({ cities, initialType = 'ONE_WAY' }: { cities: string[]; initialType?: RentalType }) {
  const { picker, open, close } = usePicker();
  const [rentalType, setRentalType] = useState<RentalType>(initialType);
  const [pickupCity, setPickupCity] = useState('');
  const [dropCity, setDropCity] = useState('');
  const [startAt, setStartAt] = useState(() => tomorrowAt(9));
  const [returnAt, setReturnAt] = useState(() => tomorrowAt(18, 2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsDrop = rentalType === 'ONE_WAY' || rentalType === 'ROUND_TRIP';
  const cityOptions = cities.map((c) => ({ key: c, label: c, sub: cityRegion(c) || undefined }));

  const getQuote = async () => {
    setError(null);
    if (!pickupCity) return setError('Please choose a pickup city.');
    if (needsDrop && !dropCity) return setError('Please choose a drop city.');
    if (needsDrop && dropCity === pickupCity) return setError('Pickup and drop city must be different.');
    if (rentalType === 'ROUND_TRIP' && returnAt <= startAt) return setError('Return must be after pickup.');
    const req: RentalRequest = {
      rentalType,
      pickupCity,
      startAt: startAt.toISOString(),
      ...(needsDrop ? { dropCity } : {}),
      ...(rentalType === 'ROUND_TRIP' ? { returnAt: returnAt.toISOString() } : {}),
    };
    setLoading(true);
    try {
      const data = await api<QuoteResponse>('/api/rentals/quote', { body: req });
      rentalCache.req = req;
      rentalCache.data = data;
      router.push({ pathname: '/rentals', params: req });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <View style={st.typeRow} accessibilityRole="radiogroup">
        {RENTAL_TYPES.map((t) => {
          const on = rentalType === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                if (!on) hapticSelect();
                setRentalType(t.key);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [st.typeBtn, on && st.typeOn, pressed && !on && { opacity: 0.7 }]}
            >
              <Ionicons name={t.icon} size={18} color={on ? colors.brand : colors.textMuted} />
              <Text style={type('xs', on ? 'bold' : 'semibold', on ? colors.brand : colors.text)} numberOfLines={1}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <RoutePicker
        from={pickupCity}
        fromCaption="PICKUP CITY"
        onFrom={() => open('pickup')}
        {...(needsDrop
          ? {
              to: dropCity,
              toCaption: 'DROP CITY',
              onTo: () => open('drop'),
              onSwap: () => {
                setPickupCity(dropCity);
                setDropCity(pickupCity);
              },
            }
          : {})}
      />
      <View style={st.fieldBox}>
        <DateTimeField label="Pickup date & time" mode="datetime" value={startAt} onChange={setStartAt} minimumDate={new Date()} icon="time-outline" />
        {rentalType === 'ROUND_TRIP' ? (
          <>
            <View style={st.divider} />
            <DateTimeField label="Return date" mode="date" value={returnAt} onChange={setReturnAt} minimumDate={startAt} icon="return-down-back-outline" />
          </>
        ) : null}
      </View>
      {rentalType === 'LOCAL' ? (
        <Notice tone="info" style={{ marginTop: spacing.sm }}>
          Local package: 8 hours / 80 km within the city.
        </Notice>
      ) : null}
      {rentalType === 'AIRPORT' ? (
        <Notice tone="info" style={{ marginTop: spacing.sm }}>
          Airport pickup or drop within the city (up to 40 km).
        </Notice>
      ) : null}
      <Notice style={{ marginTop: spacing.sm }}>{error}</Notice>
      <Button title="Get prices" icon="search" onPress={getQuote} loading={loading} style={{ marginTop: spacing.lg, height: 54 }} />

      <OptionSheet visible={picker === 'pickup'} title="Pickup city" options={cityOptions} value={pickupCity} onSelect={setPickupCity} onClose={close} icon="radio-button-on" />
      <OptionSheet visible={picker === 'drop'} title="Drop city" options={cityOptions} value={dropCity} onSelect={setDropCity} onClose={close} icon="location" />
    </View>
  );
}

/** Square service shortcut in the 3-column grid (MakeMyTrip-style icon tiles). */
function ServiceTile({
  mci,
  label,
  sub,
  tint = colors.brand,
  bg = colors.brandLight,
  onPress,
}: {
  mci: MciName;
  label: string;
  sub: string;
  tint?: string;
  bg?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${sub}`}
      style={({ pressed }) => [st.service, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
    >
      <View style={[st.serviceIcon, { backgroundColor: bg }]}>
        <MaterialCommunityIcons name={mci} size={24} color={tint} />
      </View>
      <Text style={[type('sm', 'bold'), { marginTop: spacing.sm, textAlign: 'center' }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[type('xs', 'regular', colors.textMuted), { textAlign: 'center' }]} numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
  );
}

/** One line of the "Why travel with us" card: a single-colour icon, a title and a short reason. */
function WhyRow({ icon, title, text, last }: { icon: IonName; title: string; text: string; last?: boolean }) {
  return (
    <View style={[st.whyRow, !last && st.whyRowBorder]}>
      <Ionicons name={icon} size={20} color={colors.brand} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type('sm', 'bold')} numberOfLines={1}>
          {title}
        </Text>
        <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={2}>
          {text}
        </Text>
      </View>
    </View>
  );
}

function RouteCard({ info, onPress }: { info: RouteInfo; onPress: () => void }) {
  return (
    <Card onPress={onPress} padded={false} style={st.routeCard}>
      <View style={st.routeIcon}>
        <MaterialCommunityIcons name="map-marker-path" size={22} color={colors.brand} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type('md', 'bold')} numberOfLines={1}>
          {info.from} → {info.to}
        </Text>
        <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
          Shared seat{info.durationMins ? ` · about ${fmtDuration(info.durationMins)}` : ''}
        </Text>
      </View>
      {info.minFare !== null ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={type('xs', 'medium', colors.textMuted)}>from</Text>
          <Text style={[type('md', 'extrabold'), tabular]}>{inr(info.minFare)}</Text>
        </View>
      ) : (
        <Text style={type('xs', 'semibold', colors.brand)}>See dates</Text>
      )}
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Card>
  );
}

function HillStationsCard({ onPress }: { onPress: () => void }) {
  return (
    <Card onPress={onPress} padded={false} style={st.routeCard}>
      <View style={st.routeIcon}>
        <MaterialCommunityIcons name="image-filter-hdr" size={22} color={colors.brand} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type('md', 'bold')} numberOfLines={1}>
          Hill stations
        </Text>
        <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={2}>
          {HILL_STATIONS.join(' · ')}
        </Text>
        <Text style={type('xs', 'semibold', colors.brand)} numberOfLines={1}>
          Full cab · one way or round trip
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Card>
  );
}


const st = StyleSheet.create({
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCard: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, ...shadow },
  tabs: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 64 },
  tabSep: { width: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  tabIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  tabBar: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: -1, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: colors.brand },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  routeBox: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  routeRail: { width: 34, alignItems: 'center', paddingVertical: 22, justifyContent: 'space-between' },
  originDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: colors.success, backgroundColor: colors.card },
  railDots: { flex: 1, width: 0, borderLeftWidth: 2, borderColor: colors.textSubtle, borderStyle: 'dotted', marginVertical: 4 },
  routeLine: { minHeight: 62, justifyContent: 'center', paddingVertical: spacing.sm, paddingRight: spacing.md },
  routeSep: { height: 1, backgroundColor: colors.border, marginRight: spacing.md },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    minHeight: 62,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  fieldBox: { marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 2, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  dateIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  adminCard: { marginTop: spacing.lg, borderRadius: radius.card, ...shadowSoft },
  adminInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.card },
  adminIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,193,7,0.14)', alignItems: 'center', justifyContent: 'center' },
  recent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  service: {
    width: '31.5%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    ...shadowSoft,
  },
  serviceIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  offerBadge: { width: 60, height: 60, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  swap: {
    position: 'absolute',
    right: spacing.sm,
    top: 41,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowSoft,
  },
  typeRow: { flexDirection: 'row', gap: 6, marginTop: spacing.sm, marginBottom: spacing.xs },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  typeOn: { borderColor: colors.brand, borderWidth: 1.5, backgroundColor: colors.brandLight },
  dateRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: spacing.sm, paddingHorizontal: spacing.lg },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  dayTile: {
    width: '18.5%',
    flexGrow: 1,
    maxWidth: '20%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayTileOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  whyCard: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  whyRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  routeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.card, borderRadius: radius.card },
  routeIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  promo: { marginTop: spacing.xxl, borderRadius: radius.card, ...shadowSoft },
  promoInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  promoCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: 34,
    marginTop: spacing.md,
  },
  support: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  supportIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    minHeight: 40,
  },
});
