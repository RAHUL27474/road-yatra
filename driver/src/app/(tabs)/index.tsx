import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import type { Duty, TripDuty } from '../../api';
import { useAuth } from '../../auth';
import { useDuties } from '../../duties';
import { bookedSeats, fmtDayLabel, fmtLongDate, fmtTime, RENTAL_TYPE, routeTitle, ymdIST } from '../../format';
import { colors, fonts, radius, space } from '../../theme';
import { needsAnswer, RespondBar } from '../../respond';
import { SosButton } from '../../sos';
import { Badge, Button, Card, EmptyState, haptic, Header, Ionicons, Notice, Plate, PulseDot, Skeleton, StatusPill, T } from '../../ui';

function group(duties: Duty[]) {
  const today = ymdIST(new Date());
  const scheduled = duties.filter((d) => d.status === 'SCHEDULED');
  return [
    // Past days that were never started: the driver (or the office) has to sort these out.
    { title: 'Not started', data: scheduled.filter((d) => ymdIST(new Date(d.startAt)) < today) },
    { title: 'Today', data: scheduled.filter((d) => ymdIST(new Date(d.startAt)) === today) },
    { title: 'Upcoming', data: scheduled.filter((d) => ymdIST(new Date(d.startAt)) > today) },
    { title: 'Recent', data: duties.filter((d) => d.status === 'COMPLETED').reverse() },
  ].filter((sec) => sec.data.length);
}

const openDuty = (d: Duty) => {
  haptic.tap();
  router.push({ pathname: d.kind === 'TRIP' ? '/trip/[id]' : '/rental/[id]', params: { id: d.id } });
};

function SharingPill({ sharing }: { sharing: boolean }) {
  return (
    <View style={[st.sharePill, { backgroundColor: sharing ? colors.successLight : 'rgba(255,255,255,0.18)' }]}>
      {sharing ? <PulseDot size={8} color={colors.success} /> : <Ionicons name="location-outline" size={16} color={colors.onBrandMuted} />}
      <T v="label" color={sharing ? '#15803D' : colors.onBrand} style={{ fontFamily: fonts.bold }}>
        {sharing ? 'Sharing location' : 'Not sharing'}
      </T>
    </View>
  );
}

/** Prominent card for a duty that is in progress. */
function OnTripHero({ d }: { d: Duty }) {
  const trip = d.kind === 'TRIP' ? (d as TripDuty) : null;
  const boarded = trip ? trip.passengers.filter((p) => p.boarded).length : 0;
  return (
    <Card padded={false} style={st.hero}>
      <View style={st.heroTop}>
        <PulseDot size={8} color={colors.success} />
        <T v="overline" color="#15803D">
          On trip · {d.kind === 'TRIP' ? 'Shared' : 'Full cab'}
        </T>
      </View>
      <View style={{ padding: space.lg, paddingTop: space.md }}>
        <T v="title" numberOfLines={2}>
          {routeTitle(d)}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          {d.vehicle ? <Plate reg={d.vehicle.regNumber} /> : null}
          <T v="label" color={colors.textMuted}>
            Started {fmtTime(d.startAt)}
          </T>
        </View>
        <View style={st.heroStats}>
          <View style={{ flex: 1 }}>
            <T v="caption" color={colors.textMuted}>
              {trip ? 'Boarded' : 'Customer'}
            </T>
            {trip ? (
              <T style={st.heroNum}>
                {boarded}
                <T v="h2" color={colors.textMuted}>
                  {' '}
                  / {trip.passengers.length}
                </T>
              </T>
            ) : (
              <T v="h2" numberOfLines={1}>
                {d.kind === 'RENTAL' ? d.customer.name : ''}
              </T>
            )}
          </View>
          {trip ? (
            <View style={{ flex: 1 }}>
              <T v="caption" color={colors.textMuted}>
                Seats booked
              </T>
              <T style={st.heroNum}>
                {bookedSeats(trip)}
                <T v="h2" color={colors.textMuted}>
                  {' '}
                  / {trip.vehicle.seats}
                </T>
              </T>
            </View>
          ) : null}
        </View>
        <Button title="Open trip" icon="arrow-forward-circle" variant="success" onPress={() => openDuty(d)} haptics={false} />
      </View>
    </Card>
  );
}

function DutyCard({ d }: { d: Duty }) {
  const done = d.status === 'COMPLETED';
  return (
    <Pressable onPress={() => openDuty(d)} style={({ pressed }) => pressed && { transform: [{ scale: 0.985 }], opacity: 0.92 }}>
      <Card padded={false} style={[st.dutyCard, done && { opacity: 0.8 }]}>
        <View style={st.timeBlock}>
          <T style={st.time}>{fmtTime(d.startAt)}</T>
          <T v="caption" color={colors.textMuted} numberOfLines={1} style={{ marginTop: 2 }}>
            {fmtDayLabel(d.startAt)}
          </T>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <T v="h2" numberOfLines={2}>
            {routeTitle(d)}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {needsAnswer(d) ? <Badge label="New" tone="warning" icon="notifications" /> : null}
            <Badge label={d.kind === 'TRIP' ? 'Shared' : 'Full cab'} tone={d.kind === 'TRIP' ? 'brand' : 'accent'} />
            {d.vehicle ? <Plate reg={d.vehicle.regNumber} small /> : <Badge label="No vehicle" tone="warning" />}
          </View>
          <StatusPill status={d.status} />
        </View>
        <View style={st.right}>
          {d.kind === 'TRIP' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="people" size={18} color={colors.text} />
                <T style={st.count}>{d.passengers.length}</T>
              </View>
              <T v="caption" color={colors.textMuted} numberOfLines={1}>
                {bookedSeats(d)}/{d.vehicle.seats} seats
              </T>
            </>
          ) : (
            <>
              <Ionicons name="person-circle" size={22} color={colors.text} />
              <T v="label" numberOfLines={2} style={{ textAlign: 'right' }}>
                {d.customer.name}
              </T>
              {d.rentalType ? (
                <T v="caption" color={colors.textMuted} numberOfLines={1}>
                  {RENTAL_TYPE[d.rentalType] ?? d.rentalType}
                </T>
              ) : null}
            </>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginTop: 'auto' }} />
        </View>
      </Card>
      {needsAnswer(d) ? (
        <View style={st.respond}>
          <RespondBar duty={d} compact />
        </View>
      ) : null}
    </Pressable>
  );
}

function DutySkeleton() {
  return (
    <View style={{ padding: space.lg, gap: space.md }}>
      <Skeleton width={90} height={12} style={{ marginTop: space.sm }} />
      {[0, 1, 2].map((i) => (
        <Card key={i} style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ width: 64, gap: 6 }}>
            <Skeleton height={24} />
            <Skeleton width={48} height={12} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="80%" height={18} />
            <Skeleton width="55%" height={20} r={999} />
            <Skeleton width="40%" height={20} r={999} />
          </View>
        </Card>
      ))}
    </View>
  );
}

export default function Duties() {
  const { user } = useAuth();
  const { driver, duties, error, offline, pending, sharing, refresh } = useDuties();
  const [refreshing, setRefreshing] = useState(false);
  const firstName = (driver?.name ?? user?.name ?? '').trim().split(/\s+/)[0];
  const onTrip = (duties ?? []).filter((d) => d.status === 'STARTED');
  const loading = !duties && !error;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <T v="title" color={colors.onBrand} numberOfLines={1} style={{ fontSize: 24, lineHeight: 30 }}>
              Namaste{firstName ? `, ${firstName}` : ''}
            </T>
            <T v="label" color={colors.onBrandMuted} style={{ marginTop: 2 }}>
              {fmtLongDate(new Date())}
            </T>
          </View>
          <SosButton />
        </View>
        <View style={{ marginTop: space.md }}>
          <SharingPill sharing={sharing} />
        </View>
      </Header>

      {loading ? (
        <DutySkeleton />
      ) : (
        <SectionList
          sections={group(duties ?? [])}
          keyExtractor={(d) => d.kind + d.id}
          contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl, flexGrow: 1 }}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.brand]} tintColor={colors.brand} />}
          ListHeaderComponent={
            <View style={{ gap: space.md }}>
              {offline ? (
                <Notice tone="neutral" icon="cloud-offline-outline" text="No internet. Showing your last saved duties — boarding and cash still work and will sync later." />
              ) : null}
              {pending.length ? <Notice tone="warning" icon="sync" text={`${pending.length} action${pending.length > 1 ? 's' : ''} saved offline, waiting to sync.`} /> : null}
              {error ? <Notice tone="danger" text={`${error} Pull down to retry.`} /> : null}
              {onTrip.map((d) => (
                <OnTripHero key={d.kind + d.id} d={d} />
              ))}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={st.sectionHead}>
              <T v="overline" color={colors.textMuted}>
                {section.title}
              </T>
              <View style={st.countBubble}>
                <T v="caption" color={colors.textMuted} style={{ fontFamily: fonts.bold }}>
                  {section.data.length}
                </T>
              </View>
            </View>
          )}
          renderItem={({ item }) => <DutyCard d={item} />}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          ListEmptyComponent={
            onTrip.length ? null : (
              <EmptyState icon="calendar-clear-outline" title="No duties assigned" subtitle="Your trips for the next 7 days will show here. Pull down to refresh." />
            )
          }
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  sharePill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingLeft: 8, paddingRight: 14, minHeight: 34, borderRadius: radius.pill },
  hero: { borderColor: colors.success, borderWidth: 2, overflow: 'hidden', marginTop: space.xs },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successLight, paddingHorizontal: space.md, paddingVertical: 6 },
  heroStats: { flexDirection: 'row', gap: space.lg, marginVertical: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  heroNum: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, color: colors.text },
  dutyCard: { flexDirection: 'row', gap: space.md, padding: space.lg },
  respond: {
    marginTop: -space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    paddingTop: space.sm + space.xs,
    backgroundColor: colors.warningLight,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
  },
  timeBlock: { width: 74, borderRightWidth: 1, borderRightColor: colors.border, paddingRight: space.sm },
  time: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 28, color: colors.text, fontVariant: ['tabular-nums'] },
  right: { alignItems: 'flex-end', maxWidth: 84, gap: 2 },
  count: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 28, color: colors.text },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl, marginBottom: space.md },
  countBubble: { minWidth: 24, height: 22, paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});

