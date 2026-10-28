import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminBooking, DriverBrief, useAdmin } from '../../../admin/api';
import { AdminScreen, bookingTitle, HeaderAction, Pill, payTone } from '../../../admin/components';
import { fmtDateShort, fmtTime, inr } from '../../../format';
import { colors, fonts, radius, shadowSoft, spacing, tabular, type } from '../../../theme';
import { Chip, EmptyState, ErrorBanner, SkeletonList, StatusBadge } from '../../../ui';

const STATUSES = ['ALL', 'CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as const;
const KINDS = [
  ['ALL', 'All'],
  ['SEAT', 'Shared seats'],
  ['RENTAL', 'Full cab'],
] as const;

type Resp = {
  bookings: AdminBooking[];
  drivers: DriverBrief[];
  statuses: string[];
};

export default function AdminBookings() {
  const [status, setStatus] = useState<string>('ALL');
  const [kind, setKind] = useState<string>('ALL');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  // Search after the admin stops typing.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);
  const path = `/api/admin/bookings?status=${status}&kind=${kind}&q=${encodeURIComponent(query)}`;
  const { data, error, refreshing, refresh, reload } = useAdmin<Resp>(path);
  const list = data?.bookings ?? null;

  return (
    <AdminScreen
      title="Bookings"
      subtitle={list ? `${list.length} shown · newest first` : 'Loading…'}
      right={<HeaderAction icon="add" label="New phone booking" onPress={() => router.push('/admin/new-booking')} />}
    >
      <View style={st.filters}>
        <View style={st.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Booking ID, name or mobile"
            placeholderTextColor={colors.textSubtle}
            style={st.searchInput}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
          {KINDS.map(([k, label]) => (
            <Chip key={k} label={label} selected={kind === k} onPress={() => setKind(k)} />
          ))}
          <View style={st.sep} />
          {STATUSES.map((s) => (
            <Chip key={s} label={s === 'ALL' ? 'Any status' : s.charAt(0) + s.slice(1).toLowerCase()} selected={status === s} onPress={() => setStatus(s)} />
          ))}
        </ScrollView>
      </View>
      {list === null ? (
        <SkeletonList count={5} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            flexGrow: 1,
          }}
          refreshing={refreshing}
          onRefresh={refresh}
          ListHeaderComponent={<ErrorBanner message={error} onRetry={reload} />}
          ListEmptyComponent={<EmptyState icon="ticket-outline" title="No bookings found" text="Try another search or filter." />}
          renderItem={({ item }) => <BookingCard b={item} />}
        />
      )}
    </AdminScreen>
  );
}

function BookingCard({ b }: { b: AdminBooking }) {
  const when = b.trip?.departAt ?? b.startAt;
  return (
    <Pressable
      onPress={() => router.push(`/admin/bookings/${b.id}`)}
      style={({ pressed }) => [st.card, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
      accessibilityRole="button"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={[type('sm', 'extrabold', colors.brand), tabular]}>{b.code}</Text>
        <Pill label={b.kind === 'SEAT' ? 'Seat' : 'Full cab'} tone={b.kind === 'SEAT' ? 'brand' : 'warning'} />
        {b.source === 'OFFLINE' ? <Pill label="Phone" /> : null}
        <View style={{ flex: 1 }} />
        <StatusBadge status={b.status} tripStatus={b.tripStatus} />
      </View>
      <Text style={[type('md', 'bold'), { marginTop: spacing.sm }]} numberOfLines={1}>
        {bookingTitle(b)}
      </Text>
      <Text style={[type('xs', 'medium', colors.textMuted), tabular]} numberOfLines={1}>
        {when ? `${fmtDateShort(when)} · ${fmtTime(when)}` : '—'}
        {b.seatNos.length ? ` · Seat ${b.seatNos.join(', ')}` : ''}
        {b.vehicleReg ? ` · ${b.vehicleReg}` : ''}
      </Text>
      <View style={st.foot}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type('sm', 'semibold')} numberOfLines={1}>
            {b.passengerName}
          </Text>
          <Text style={[type('xs', 'regular', colors.textMuted), tabular]}>{b.passengerPhone}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={[type('md', 'extrabold'), tabular]}>{inr(b.totalAmount)}</Text>
          <Pill label={b.paymentStatus.replace('_', ' ')} tone={payTone(b.paymentStatus)} />
        </View>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  filters: {
    backgroundColor: colors.card,
    paddingTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 8,
  },
  chips: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  sep: { width: 1, height: 24, backgroundColor: colors.border },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...shadowSoft,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
