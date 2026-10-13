import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Config, errorMessage, getConfig, QuoteResponse, RentalRequest, RentalType, TripSummary } from '../../api';
import { useAuth } from '../../auth';
import { Logo } from '../../brand';
import { DateTimeField } from '../../DateTimeField';
import { cityRegion, fmtDuration, fmtYmdShort, inr, nextDays, relativeDay, ymdIST } from '../../format';
import { VehicleArt } from '../../illustrations';
import { rentalCache } from '../../store';
import { colors, radius, shadow, shadowSoft, spacing, tabular, type } from '../../theme';
import { Button, Card, Chip, ErrorBanner, hapticSelect, hapticTap, IonName, Notice, OptionSheet, Skeleton } from '../../ui';

const RENTAL_TYPES: { key: RentalType; label: string; icon: IonName }[] = [
  { key: 'ONE_WAY', label: 'One way', icon: 'arrow-forward' },
  { key: 'ROUND_TRIP', label: 'Round trip', icon: 'repeat' },
  { key: 'LOCAL', label: 'Local', icon: 'time-outline' },
  { key: 'AIRPORT', label: 'Airport', icon: 'airplane-outline' },
];

const DEFAULT_FROM = 'Khatima';
const DEFAULT_TO = 'Delhi';
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
  const tomorrow = useMemo(() => nextDays(2)[1].ymd, []);

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
      [DEFAULT_TO, DEFAULT_FROM],
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
  const callSupport = () => config && Linking.openURL(`tel:${config.supportPhone.replace(/[^\d+]/g, '')}`).catch(() => {});
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
          <View style={st.decor1} />
          <View style={st.decor2} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Logo light size={34} style={{ flex: 1 }} />
            {config ? (
              <Pressable
                onPress={callSupport}
                hitSlop={6}
                style={({ pressed }) => [st.headerIcon, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="Call customer support"
              >
                <Ionicons name="headset" size={20} color={colors.white} />
              </Pressable>
            ) : null}
          </View>
          <Text style={[type('xl', 'extrabold', colors.white), { marginTop: spacing.xl, letterSpacing: -0.3 }]} numberOfLines={1}>
            {firstName ? `Namaste, ${firstName}` : 'Namaste'}
          </Text>
          <Text style={[type('sm', 'medium', colors.onBrandMuted), { marginTop: 2 }]} numberOfLines={1}>
            Khatima ↔ Delhi · Shared seats and private cabs
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
              {tab === 'seats' ? <SeatSearch cities={cities} hasDefaultRoute={hasDefaultRoute} /> : <HireSearch cities={cities} />}
            </View>
          </View>

          <SectionHeader title="Why travel with us" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
            style={{ marginHorizontal: -spacing.lg }}
          >
            <WhyTile icon="shield-checkmark" tint={colors.success} bg={colors.successLight} title="Verified drivers" text="Licence-checked and approved" />
            <WhyTile icon="navigate" tint={colors.brand} bg={colors.brandLight} title="Live tracking" text="Share your trip with family" />
            <WhyTile icon="grid" tint="#7C3AED" bg="#EDE9FE" title="Pick your seat" text="Choose the exact seat you like" />
            <WhyTile
              icon="wallet"
              tint={colors.accent}
              bg={colors.accentLight}
              title="Pay your way"
              text={config?.allowCash ? 'UPI, card or cash to driver' : 'UPI, cards and net banking'}
            />
            <WhyTile icon="receipt" tint={colors.warning} bg={colors.warningLight} title="Clear fares" text="GST invoice with every trip" />
          </ScrollView>

          {hasDefaultRoute || routes === null ? (
            <>
              <SectionHeader title="Popular routes" />
              <View style={{ gap: spacing.md }}>
                {routes === null
                  ? [0, 1].map((i) => (
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
                        key={r.from}
                        info={r}
                        onPress={() => router.push({ pathname: '/results', params: { from: r.from, to: r.to, date: tomorrow } })}
                      />
                    ))}
              </View>
            </>
          ) : null}

          <Pressable
            onPress={() => {
              hapticTap();
              setTab('hire');
              scroll.current?.scrollTo({ y: 0, animated: true });
            }}
            style={({ pressed }) => [st.promo, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Book a full cab"
          >
            <LinearGradient colors={['#FFF4EC', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.promoInner}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[type('xs', 'bold', colors.accent), { letterSpacing: 0.6 }]}>PRIVATE CAB</Text>
                <Text style={[type('lg', 'extrabold'), { marginTop: 2 }]}>Book a full cab</Text>
                <Text style={[type('xs', 'regular', colors.textMuted), { marginTop: 2 }]} numberOfLines={2}>
                  One way, round trip, local or airport. Your own car with a driver.
                </Text>
                <View style={st.promoCta}>
                  <Text style={type('sm', 'bold', colors.white)}>Get prices</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.white} />
                </View>
              </View>
              <VehicleArt type="INNOVA_CRYSTA" width={124} style={{ marginRight: -spacing.sm, marginTop: spacing.xl }} />
            </LinearGradient>
          </Pressable>

          <View style={st.trustRow}>
            <TrustItem icon="shield-checkmark-outline" label="Verified drivers" />
            <View style={st.trustDot} />
            <TrustItem icon="locate-outline" label="Live tracking" />
            <View style={st.trustDot} />
            <TrustItem icon="headset-outline" label="24×7 support" />
          </View>

          {config ? (
            <View style={st.support}>
              <View style={st.supportIcon}>
                <Ionicons name="headset" size={22} color={colors.brand} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={type('md', 'bold')} numberOfLines={1}>
                  Need help?
                </Text>
                <Text style={[type('sm', 'medium', colors.textMuted), tabular]} numberOfLines={1}>
                  Call us on {config.supportPhone}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  hapticTap();
                  callSupport();
                }}
                style={({ pressed }) => [st.callBtn, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={`Call ${config.supportPhone}`}
              >
                <Ionicons name="call" size={16} color={colors.white} />
                <Text style={type('sm', 'bold', colors.white)}>Call</Text>
              </Pressable>
            </View>
          ) : null}
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

/** Big city name with a small region caption, MakeMyTrip style. */
function CityBlock({ caption, city, placeholder, onPress }: { caption: string; city: string; placeholder: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${caption}: ${city || placeholder}`}
      style={({ pressed }) => [st.cityBlock, pressed && { opacity: 0.6 }]}
    >
      <Text style={[type('xs', 'semibold', colors.textMuted), { letterSpacing: 0.6 }]}>{caption}</Text>
      <Text
        style={[city ? type('xl', 'extrabold') : type('xl', 'semibold', colors.textSubtle), { letterSpacing: -0.3, marginTop: 2, paddingRight: 56 }]}
        numberOfLines={1}
      >
        {city || placeholder}
      </Text>
      <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
        {city ? cityRegion(city) || 'India' : 'Tap to choose'}
      </Text>
    </Pressable>
  );
}

function SwapButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={st.swapLine}>
      <View style={st.divider} />
      <Pressable
        style={({ pressed }) => [st.swap, pressed && { transform: [{ rotate: '180deg' }], backgroundColor: colors.brandLight }]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Swap cities"
        onPress={() => {
          hapticSelect();
          onPress();
        }}
      >
        <Ionicons name="swap-vertical" size={20} color={colors.brand} />
      </Pressable>
    </View>
  );
}

function SeatSearch({ cities, hasDefaultRoute }: { cities: string[]; hasDefaultRoute: boolean }) {
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
    router.push({ pathname: '/results', params: { from, to, date } });
  };

  return (
    <View>
      <CityBlock caption="FROM" city={from} placeholder="Select city" onPress={() => open('from')} />
      <SwapButton
        onPress={() => {
          setFrom(to);
          setTo(from);
        }}
      />
      <CityBlock caption="TO" city={to} placeholder="Select city" onPress={() => open('to')} />
      <View style={st.divider} />

      <Pressable
        onPress={() => open('date')}
        accessibilityRole="button"
        accessibilityLabel={`Departure date: ${fmtYmdShort(date)}`}
        style={({ pressed }) => [st.dateRow, pressed && { opacity: 0.6 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[type('xs', 'semibold', colors.textMuted), { letterSpacing: 0.6 }]}>DEPARTURE DATE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: 2 }}>
            <Text style={[type('xl', 'extrabold'), { letterSpacing: -0.3 }]}>{fmtYmdShort(date)}</Text>
            <Text style={type('xs', 'semibold', colors.textMuted)}>{relativeDay(date)}</Text>
          </View>
        </View>
        <Ionicons name="calendar-outline" size={22} color={colors.brand} />
      </Pressable>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        <Chip label="Today" selected={quick === 'today'} onPress={() => setDate(days[0].ymd)} />
        <Chip label="Tomorrow" selected={quick === 'tomorrow'} onPress={() => setDate(days[1].ymd)} />
        <Chip label={quick === 'other' ? fmtYmdShort(date) : 'Pick date'} icon="calendar-outline" selected={quick === 'other'} onPress={() => open('date')} />
      </View>

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

function HireSearch({ cities }: { cities: string[] }) {
  const { picker, open, close } = usePicker();
  const [rentalType, setRentalType] = useState<RentalType>('ONE_WAY');
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
      <CityBlock caption="PICKUP CITY" city={pickupCity} placeholder="Select city" onPress={() => open('pickup')} />
      {needsDrop ? (
        <>
          <SwapButton
            onPress={() => {
              setPickupCity(dropCity);
              setDropCity(pickupCity);
            }}
          />
          <CityBlock caption="DROP CITY" city={dropCity} placeholder="Select city" onPress={() => open('drop')} />
        </>
      ) : null}
      <View style={st.divider} />
      <DateTimeField label="Pickup date & time" mode="datetime" value={startAt} onChange={setStartAt} minimumDate={new Date()} icon="time-outline" />
      {rentalType === 'ROUND_TRIP' ? (
        <>
          <View style={st.divider} />
          <DateTimeField label="Return date" mode="date" value={returnAt} onChange={setReturnAt} minimumDate={startAt} icon="return-down-back-outline" />
        </>
      ) : null}
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

function WhyTile({ icon, tint, bg, title, text }: { icon: IonName; tint: string; bg: string; title: string; text: string }) {
  return (
    <View style={st.why}>
      <View style={[st.whyIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={[type('sm', 'bold'), { marginTop: spacing.md }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[type('xs', 'regular', colors.textMuted), { marginTop: 2 }]} numberOfLines={2}>
        {text}
      </Text>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={type('md', 'bold')} numberOfLines={1}>
            {info.from}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
          <Text style={[type('md', 'bold'), { flexShrink: 1 }]} numberOfLines={1}>
            {info.to}
          </Text>
        </View>
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

function TrustItem({ icon, label }: { icon: IonName; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
      <Ionicons name={icon} size={16} color={colors.success} />
      <Text style={type('xs', 'semibold', colors.textMuted)} numberOfLines={1}>
        {label}
      </Text>
    </View>
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
  decor1: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.06)', top: -90, right: -70 },
  decor2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)', bottom: 20, left: -60 },
  searchCard: { backgroundColor: colors.card, borderRadius: 18, ...shadow },
  tabs: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 64 },
  tabSep: { width: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  tabIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  tabBar: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: -1, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: colors.brand },
  cityBlock: { paddingVertical: 10 },
  swapLine: { height: 1, justifyContent: 'center' },
  divider: { height: 1, backgroundColor: colors.border },
  swap: {
    position: 'absolute',
    right: spacing.sm,
    top: -21,
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
  why: { width: 148, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md, ...shadowSoft },
  whyIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  routeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.card, borderRadius: radius.card },
  routeIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  promo: { marginTop: spacing.xxl, borderRadius: radius.card, ...shadowSoft },
  promoInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#FFE1CF',
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
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  trustDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textSubtle },
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
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    minHeight: 40,
  },
});
