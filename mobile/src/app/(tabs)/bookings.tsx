import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, Booking, errorMessage } from '../../api';
import { useAuth } from '../../auth';
import { fmtDateShort, fmtTime, inr, RENTAL_TYPE } from '../../format';
import { VehicleArt } from '../../illustrations';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../../theme';
import { Button, EmptyState, ErrorBanner, Header, isOnTrip, Screen, SegmentedControl, Skeleton, StatusBadge } from '../../ui';

/** Upcoming = active booking whose journey hasn't finished: in the future, or under way right now. */
function isUpcoming(b: Booking, now: number) {
  if (isOnTrip(b)) return true;
  if (b.status !== 'PENDING' && b.status !== 'CONFIRMED') return false;
  if (b.tripStatus === 'COMPLETED' || b.tripStatus === 'CANCELLED') return false;
  const end = b.endAt ?? b.startAt;
  return !end || new Date(end).getTime() > now;
}

export default function MyBookings() {
  const { user, ready } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState(0);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const load = useCallback(async () => {
    setError(null);
    try {
      setBookings((await api<{ bookings: Booking[] }>('/api/bookings')).bookings);
      setLoadedAt(Date.now());
    } catch (e) {
      setError(errorMessage(e));
      setBookings((b) => b ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) load();
      else setBookings(null);
    }, [user, load]),
  );

  const header = <Header title="My Bookings" subtitle={user ? 'Tickets and cab bookings' : undefined} back={false} />;

  if (!ready)
    return (
      <Screen>
        {header}
        <ListSkeleton />
      </Screen>
    );
  if (!user)
    return (
      <Screen>
        {header}
        <EmptyState
          art="login"
          title="Log in to see your bookings"
          text="Your seat tickets and cab bookings will appear here."
          action={<Button title="Log in" onPress={() => router.push('/login')} />}
        />
      </Screen>
    );

  const upcoming = (bookings ?? []).filter((b) => isUpcoming(b, loadedAt));
  const past = (bookings ?? []).filter((b) => !isUpcoming(b, loadedAt));
  // Ongoing trips first, then the soonest departure.
  upcoming.sort((a, b) => Number(isOnTrip(b)) - Number(isOnTrip(a)) || (a.startAt ?? '').localeCompare(b.startAt ?? ''));
  const data = tab === 'upcoming' ? upcoming : past;

  return (
    <Screen>
      {header}
      <View style={st.tabsWrap}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { key: 'upcoming', label: `Upcoming${bookings ? ` (${upcoming.length})` : ''}`, icon: 'time-outline' },
            { key: 'past', label: `Past${bookings ? ` (${past.length})` : ''}`, icon: 'checkmark-done-outline' },
          ]}
        />
      </View>
      {!bookings ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: spacing.lg, flexGrow: 1, gap: spacing.md }}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          ListHeaderComponent={<ErrorBanner message={error} onRetry={load} />}
          ListEmptyComponent={
            error ? null : tab === 'upcoming' ? (
              <EmptyState
                art="tickets"
                title={bookings.length ? 'No upcoming trips' : 'No bookings yet'}
                text="Book a shared seat or a full cab and your ticket will show up here."
                action={<Button title="Book a trip" icon="search" onPress={() => router.navigate('/')} />}
              />
            ) : (
              <EmptyState art="tickets" title="No past bookings" text="Completed and cancelled bookings will show up here." />
            )
          }
          renderItem={({ item }) => <BookingCard b={item} />}
        />
      )}
    </Screen>
  );
}

function BookingCard({ b }: { b: Booking }) {
  const from = b.trip?.fromCity ?? b.pickupCity ?? '';
  const to = b.trip?.toCity ?? b.dropCity ?? (b.rentalType ? RENTAL_TYPE[b.rentalType] : 'Hire');
  const dim = b.status === 'CANCELLED' || b.status === 'EXPIRED';
  const when = b.trip?.departAt ?? b.startAt;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}
      android_ripple={{ color: colors.brandRipple }}
      accessibilityRole="button"
      accessibilityLabel={`${from} to ${to}, ${b.code}`}
      style={({ pressed }) => [st.card, pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] }]}
    >
      <View style={st.top}>
        <View style={[st.kind, b.kind === 'RENTAL' && { backgroundColor: colors.accentLight }]}>
          <Text style={type('xs', 'bold', b.kind === 'RENTAL' ? colors.accent : colors.brand)}>{b.kind === 'SEAT' ? 'SHARED SEAT' : 'FULL CAB'}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <StatusBadge status={b.status} tripStatus={b.tripStatus} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={type('lg', 'extrabold', dim ? colors.textMuted : colors.text)} numberOfLines={1}>
              {from}
            </Text>
            <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
            <Text style={[type('lg', 'extrabold', dim ? colors.textMuted : colors.text), { flexShrink: 1 }]} numberOfLines={1}>
              {to}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <Text style={[type('sm', 'semibold', colors.textMuted), tabular]} numberOfLines={1}>
              {when ? `${fmtDateShort(when)} · ${fmtTime(when)}` : '—'}
            </Text>
          </View>
          <Text style={[type('xs', 'regular', colors.textMuted), { marginTop: 2 }]} numberOfLines={1}>
            {b.kind === 'SEAT' ? `Seat${b.seatNos.length > 1 ? 's' : ''} ${b.seatNos.join(', ')}` : `${b.passengers} passenger${b.passengers > 1 ? 's' : ''}`}
            {b.vehicle ? ` · ${b.vehicle.name}` : ''}
          </Text>
        </View>
        <View style={dim && { opacity: 0.5 }}>
          <VehicleArt type={b.vehicle?.type} width={76} />
        </View>
      </View>
      <View style={st.perf}>
        <View style={[st.notch, { left: -9 }]} />
        <View style={st.perfLine} />
        <View style={[st.notch, { right: -9 }]} />
      </View>
      <View style={st.bottom}>
        <View>
          <Text style={type('xs', 'medium', colors.textMuted)}>PNR</Text>
          <Text style={[type('sm', 'bold'), { letterSpacing: 0.6 }]} numberOfLines={1}>
            {b.code}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={[type('lg', 'extrabold', dim ? colors.textMuted : colors.text), tabular]}>{inr(b.totalAmount)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </View>
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.md }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[st.card, { padding: spacing.lg, gap: spacing.md }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={90} height={20} r={10} />
            <Skeleton width={84} height={20} r={10} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="70%" height={20} />
              <Skeleton width="45%" height={14} />
            </View>
            <Skeleton width={76} height={30} r={8} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={80} height={16} />
            <Skeleton width={64} height={20} />
          </View>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  tabsWrap: { backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  card: { backgroundColor: colors.card, borderRadius: radius.card, ...shadowSoft },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  kind: { backgroundColor: colors.brandLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  perf: { height: 18, justifyContent: 'center' },
  perfLine: { marginHorizontal: spacing.lg, height: 0, borderTopWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed' },
  notch: { position: 'absolute', top: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.background },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.md },
});
