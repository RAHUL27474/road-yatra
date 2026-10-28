import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { AdminTrip, DriverBrief, isoToYmd, RouteBrief, useAdmin, VehicleBrief } from '../../../admin/api';
import { AdminScreen, DriverLine, HeaderAction, Pill, tripTone } from '../../../admin/components';
import { fmtTime, fmtYmd, fmtYmdShort, inr, relativeDay } from '../../../format';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../../../theme';
import { Button, Chip, EmptyState, ErrorBanner, SkeletonList } from '../../../ui';

type Resp = {
  trips: AdminTrip[];
  routes: RouteBrief[];
  vehicles: VehicleBrief[];
  drivers: DriverBrief[];
  today: string;
};

/** "Today", "Tomorrow" or "Fri, 30 Oct". */
const dayLabel = (ymd: string) => {
  const r = relativeDay(ymd);
  return r === 'Today' || r === 'Tomorrow' ? r : fmtYmdShort(ymd);
};

export default function AdminTrips() {
  const { data, error, refreshing, refresh, reload } = useAdmin<Resp>('/api/admin/trips');
  const [day, setDay] = useState<string>('ALL');
  const [route, setRoute] = useState<string>('ALL');

  const days = useMemo(() => [...new Set((data?.trips ?? []).map((t) => isoToYmd(t.departAt)))].sort(), [data]);
  const routes = useMemo(() => [...new Set((data?.trips ?? []).map((t) => `${t.fromCity} → ${t.toCity}`))].sort(), [data]);
  const sections = useMemo(() => {
    const list = (data?.trips ?? []).filter(
      (t) => (day === 'ALL' || isoToYmd(t.departAt) === day) && (route === 'ALL' || `${t.fromCity} → ${t.toCity}` === route),
    );
    const byDay = new Map<string, AdminTrip[]>();
    for (const t of list) {
      const k = isoToYmd(t.departAt);
      byDay.set(k, [...(byDay.get(k) ?? []), t]);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, trips]) => ({ title: k, data: trips }));
  }, [data, day, route]);

  return (
    <AdminScreen
      title="Trips & schedule"
      subtitle={data ? `${data.trips.length} upcoming and running trips` : 'Loading…'}
      right={<HeaderAction icon="add" label="Schedule trips" onPress={() => router.push('/admin/trips/schedule')} />}
    >
      {data ? (
        <View style={st.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
            <Chip label="All days" selected={day === 'ALL'} onPress={() => setDay('ALL')} />
            {days.map((d) => (
              <Chip key={d} label={dayLabel(d)} selected={day === d} onPress={() => setDay(d)} />
            ))}
          </ScrollView>
          {routes.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[st.chips, { paddingTop: 0 }]}>
              <Chip label="All routes" selected={route === 'ALL'} onPress={() => setRoute('ALL')} />
              {routes.map((r) => (
                <Chip key={r} label={r} selected={route === r} onPress={() => setRoute(r)} />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}
      {!data ? (
        <View>
          <ErrorBanner message={error} onRetry={reload} style={{ margin: spacing.lg }} />
          <SkeletonList count={4} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: 0,
            flexGrow: 1,
          }}
          refreshing={refreshing}
          onRefresh={refresh}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={<ErrorBanner message={error} onRetry={reload} style={{ marginTop: spacing.lg }} />}
          renderSectionHeader={({ section }) => (
            <Text style={st.dayHead}>
              {fmtYmd(section.title).toUpperCase()} · {relativeDay(section.title).toUpperCase()}
            </Text>
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No trips scheduled"
              text="Schedule daily departures for a route and vehicle."
              action={<Button title="Schedule trips" icon="add" onPress={() => router.push('/admin/trips/schedule')} />}
            />
          }
          renderItem={({ item }) => <TripCard t={item} />}
        />
      )}
    </AdminScreen>
  );
}

function TripCard({ t }: { t: AdminTrip }) {
  const pct = t.vehicle.seats ? t.seatsTaken / t.vehicle.seats : 0;
  return (
    <Pressable
      onPress={() => router.push(`/admin/trips/${t.id}`)}
      style={({ pressed }) => [st.card, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
      accessibilityRole="button"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={st.time}>
          <Text style={[type('lg', 'extrabold', colors.brand), tabular]}>{fmtTime(t.departAt)}</Text>
          <Text style={[type('xs', 'medium', colors.textMuted), tabular]}>to {fmtTime(t.arriveAt)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type('md', 'bold')} numberOfLines={1}>
            {t.fromCity} → {t.toCity}
          </Text>
          <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
            {t.vehicle.name} · {t.vehicle.regNumber}
          </Text>
          <DriverLine driver={t.driver} response={t.driverResponse} note={t.driverNote} scheduled={t.status === 'SCHEDULED'} />
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </View>
      <View style={st.foot}>
        <View style={st.bar}>
          <View
            style={[
              st.barFill,
              {
                width: `${Math.round(pct * 100)}%`,
                backgroundColor: pct >= 1 ? colors.success : colors.brand,
              },
            ]}
          />
        </View>
        <Text style={[type('xs', 'bold'), tabular]}>
          {t.seatsTaken}/{t.vehicle.seats} seats
        </Text>
        <Text style={[type('xs', 'semibold', colors.textMuted), tabular]}>{inr(t.fare)}</Text>
        <Pill label={t.status} tone={tripTone(t.status)} />
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  filters: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chips: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dayHead: {
    ...type('xs', 'bold', colors.textMuted),
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...shadowSoft,
  },
  time: {
    alignItems: 'center',
    backgroundColor: colors.brandLight,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  bar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3 },
});
