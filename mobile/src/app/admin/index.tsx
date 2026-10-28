import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminTrip, Dashboard, useAdmin } from '../../admin/api';
import { AdminScreen, callPhone, DriverLine, GroupLabel, HeaderAction, Kpi, Panel, Pill, runAction, tripTone } from '../../admin/components';
import { fmtDateShort, fmtTime, inr, RENTAL_TYPE } from '../../format';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../../theme';
import { ErrorBanner, MciName, Notice, SkeletonList, StatusBadge, Tone } from '../../ui';

const KPI_META: Record<string, { icon: MciName; tone: Tone }> = {
  collectedToday: { icon: 'cash-check', tone: 'success' },
  collectedMonth: { icon: 'calendar-month', tone: 'brand' },
  bookingsToday: { icon: 'ticket-confirmation-outline', tone: 'brand' },
  occupancyToday: { icon: 'seat-passenger', tone: 'brand' },
  cashToCollect: { icon: 'hand-coin-outline', tone: 'warning' },
  cashWithDrivers: { icon: 'account-cash-outline', tone: 'warning' },
  refundsPending: { icon: 'cash-refund', tone: 'danger' },
};

const MENU: {
  href: string;
  label: string;
  icon: MciName;
  tint: string;
  bg: string;
}[] = [
  {
    href: '/admin/bookings',
    label: 'Bookings',
    icon: 'ticket-confirmation-outline',
    tint: colors.brand,
    bg: colors.brandLight,
  },
  {
    href: '/admin/new-booking',
    label: 'Phone booking',
    icon: 'phone-plus-outline',
    tint: colors.success,
    bg: colors.successLight,
  },
  {
    href: '/admin/trips',
    label: 'Trips & schedule',
    icon: 'calendar-clock',
    tint: '#7C3AED',
    bg: '#EDE9FE',
  },
  {
    href: '/admin/fleet',
    label: 'Fleet on routes',
    icon: 'map-marker-path',
    tint: colors.accent,
    bg: colors.accentLight,
  },
  {
    href: '/admin/vehicles',
    label: 'Vehicles',
    icon: 'car-multiple',
    tint: colors.brand,
    bg: colors.brandLight,
  },
  {
    href: '/admin/drivers',
    label: 'Drivers',
    icon: 'card-account-details-outline',
    tint: colors.success,
    bg: colors.successLight,
  },
  {
    href: '/admin/routes',
    label: 'Routes & fares',
    icon: 'routes',
    tint: '#0E7490',
    bg: '#CFFAFE',
  },
  {
    href: '/admin/stops',
    label: 'Pickup points',
    icon: 'map-marker-radius-outline',
    tint: colors.danger,
    bg: colors.dangerLight,
  },
  {
    href: '/admin/reports',
    label: 'Reports',
    icon: 'chart-box-outline',
    tint: '#7C3AED',
    bg: '#EDE9FE',
  },
  {
    href: '/admin/feedback',
    label: 'Feedback',
    icon: 'star-outline',
    tint: colors.warning,
    bg: colors.warningLight,
  },
  {
    href: '/admin/messages',
    label: 'WhatsApp log',
    icon: 'whatsapp',
    tint: '#1FAF54',
    bg: '#E7F8EE',
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    icon: 'cog-outline',
    tint: colors.textMuted,
    bg: colors.background,
  },
];

export default function AdminDashboard() {
  const { data, error, refreshing, refresh, reload } = useAdmin<Dashboard>('/api/admin/dashboard');

  return (
    <AdminScreen
      title="Office dashboard"
      subtitle="Bookings, trips and fleet at a glance"
      right={<HeaderAction icon="refresh" label="Refresh" onPress={refresh} />}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxl,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.brand]} />}
      >
        <ErrorBanner message={error} onRetry={reload} style={{ marginBottom: spacing.md }} />
        {!data ? (
          <SkeletonList count={4} style={{ padding: 0 }} />
        ) : (
          <>
            {data.sos.map((a) => (
              <View key={a.id} style={st.sos}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}
                >
                  <MaterialCommunityIcons name="alarm-light" size={22} color={colors.danger} />
                  <Text style={[type('md', 'extrabold', colors.danger), { flex: 1 }]}>SOS · {a.driverName}</Text>
                </View>
                <Text style={[type('sm', 'medium', '#7F1D1D'), { marginTop: 4 }]}>
                  Pressed the emergency button at {fmtTime(a.createdAt)}, {fmtDateShort(a.createdAt)}
                  {a.vehicleReg ? ` · ${a.vehicleReg}` : ''}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: spacing.sm,
                    marginTop: spacing.md,
                  }}
                >
                  <SosBtn icon="call" label="Call" onPress={() => callPhone(a.driverPhone)} />
                  {a.mapUrl ? <SosBtn icon="navigate" label="Location" onPress={() => Linking.openURL(a.mapUrl!).catch(() => {})} /> : null}
                  <SosBtn
                    icon="checkmark-done"
                    label="Resolved"
                    solid
                    onPress={async () => {
                      if (
                        await runAction(
                          'resolveSos',
                          { id: a.id },
                          {
                            confirm: {
                              title: 'Mark SOS resolved?',
                              ok: 'Resolved',
                            },
                          },
                        )
                      )
                        reload();
                    }}
                  />
                </View>
              </View>
            ))}

            <View style={st.grid}>
              {data.stats.map((s) => {
                const meta = KPI_META[s.key] ?? {
                  icon: 'chart-line' as MciName,
                  tone: 'brand' as Tone,
                };
                return <Kpi key={s.key} label={s.label} value={s.value} sub={s.sub} icon={meta.icon} tone={meta.tone} style={st.cell} />;
              })}
            </View>

            {data.pendingDrivers > 0 ? (
              <Pressable onPress={() => router.push('/admin/drivers')} style={({ pressed }) => [st.banner, pressed && { opacity: 0.85 }]}>
                <MaterialCommunityIcons name="account-clock-outline" size={22} color={colors.brand} />
                <Text style={[type('sm', 'bold'), { flex: 1 }]}>
                  {data.pendingDrivers} driver application
                  {data.pendingDrivers > 1 ? 's' : ''} waiting for approval
                </Text>
                <Text style={type('sm', 'bold', colors.brand)}>Review</Text>
              </Pressable>
            ) : null}

            {data.alerts.length ? (
              <>
                <GroupLabel>Documents expiring soon</GroupLabel>
                <Panel>
                  {data.alerts.map((a) => (
                    <View key={a.what} style={st.alertRow}>
                      <Ionicons name={a.expired ? 'alert-circle' : 'time-outline'} size={16} color={a.expired ? colors.danger : colors.warning} />
                      <Text style={[type('sm', a.expired ? 'bold' : 'medium', a.expired ? colors.danger : colors.text), { flex: 1 }]} numberOfLines={1}>
                        {a.what}
                      </Text>
                      <Text style={type('xs', 'semibold', a.expired ? colors.danger : colors.textMuted)}>
                        {a.expired ? 'Expired' : 'Expires'} {fmtDateShort(a.date)}
                      </Text>
                    </View>
                  ))}
                </Panel>
              </>
            ) : null}

            <GroupLabel>Office</GroupLabel>
            <View style={st.menu}>
              {MENU.map((m) => (
                <Pressable
                  key={m.href}
                  onPress={() => router.push(m.href as never)}
                  style={({ pressed }) => [st.menuItem, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                  accessibilityRole="button"
                >
                  <View style={[st.menuIcon, { backgroundColor: m.bg }]}>
                    <MaterialCommunityIcons name={m.icon} size={22} color={m.tint} />
                  </View>
                  <Text style={[type('xs', 'semibold'), { textAlign: 'center' }]} numberOfLines={2}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <GroupLabel right={<LinkText label="All trips" onPress={() => router.push('/admin/trips')} />}>{"Today's shared trips"}</GroupLabel>
            <Panel flush>
              {data.todaysTrips.length === 0 ? (
                <Text style={st.empty}>No trips today.</Text>
              ) : (
                data.todaysTrips.map((t, i) => <TripRow key={t.id} trip={t} last={i === data.todaysTrips.length - 1} />)
              )}
            </Panel>

            <GroupLabel>{"Today's full-cab pickups"}</GroupLabel>
            <Panel flush>
              {data.todaysRentals.length === 0 ? (
                <Text style={st.empty}>No full-cab pickups today.</Text>
              ) : (
                data.todaysRentals.map((b, i) => (
                  <Pressable
                    key={b.id}
                    onPress={() => router.push(`/admin/bookings/${b.id}`)}
                    style={[st.row, i < data.todaysRentals.length - 1 && st.rowBorder]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={type('sm', 'bold')} numberOfLines={1}>
                        {b.startAt ? fmtTime(b.startAt) : '--'} · {b.vehicleReg ?? b.vehicle?.name} · {RENTAL_TYPE[b.rentalType ?? ''] ?? 'Full cab'}
                      </Text>
                      <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
                        {b.passengerName} · {b.passengerPhone} · {b.pickupAddress || b.pickupCity}
                      </Text>
                      <DriverLine driver={b.driver} response={b.driverResponse} note={b.driverNote} />
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
                  </Pressable>
                ))
              )}
            </Panel>

            <GroupLabel right={<LinkText label="View all" onPress={() => router.push('/admin/bookings')} />}>Latest bookings</GroupLabel>
            <Panel flush>
              {data.recent.map((b, i) => (
                <Pressable key={b.id} onPress={() => router.push(`/admin/bookings/${b.id}`)} style={[st.row, i < data.recent.length - 1 && st.rowBorder]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={type('sm', 'bold')} numberOfLines={1}>
                      {b.trip
                        ? `${b.trip.fromCity} → ${b.trip.toCity}`
                        : `${RENTAL_TYPE[b.rentalType ?? ''] ?? 'Full cab'} · ${b.pickupCity ?? ''}${b.dropCity ? ' → ' + b.dropCity : ''}`}
                    </Text>
                    <Text style={[type('xs', 'regular', colors.textMuted), tabular]} numberOfLines={1}>
                      {b.code} · {b.passengerName} · {inr(b.totalAmount)}
                    </Text>
                  </View>
                  <StatusBadge status={b.status} tripStatus={b.tripStatus} />
                </Pressable>
              ))}
              {data.recent.length === 0 ? <Text style={st.empty}>No bookings yet.</Text> : null}
            </Panel>
            <Notice tone="info" style={{ marginTop: spacing.lg }}>
              Pull down to refresh. Changes made here are the same as on the website office panel.
            </Notice>
          </>
        )}
      </ScrollView>
    </AdminScreen>
  );
}

function TripRow({ trip: t, last }: { trip: AdminTrip; last: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(`/admin/trips/${t.id}`)}
      style={({ pressed }) => [st.row, !last && st.rowBorder, pressed && { backgroundColor: colors.surface }]}
    >
      <View style={st.timeBox}>
        <Text style={[type('sm', 'extrabold', colors.brand), tabular]}>{fmtTime(t.departAt)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type('sm', 'bold')} numberOfLines={1}>
          {t.fromCity} → {t.toCity}
        </Text>
        <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
          {t.vehicle.regNumber} · {t.seatsTaken}/{t.vehicle.seats} seats
        </Text>
        <DriverLine driver={t.driver} response={t.driverResponse} note={t.driverNote} scheduled={t.status === 'SCHEDULED'} />
      </View>
      <Pill label={t.status} tone={tripTone(t.status)} />
    </Pressable>
  );
}

function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={type('xs', 'bold', colors.brand)}>{label}</Text>
    </Pressable>
  );
}

function SosBtn({ icon, label, onPress, solid }: { icon: 'call' | 'navigate' | 'checkmark-done'; label: string; onPress: () => void; solid?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.sosBtn, solid && { backgroundColor: colors.danger }, pressed && { opacity: 0.8 }]}>
      <Ionicons name={icon} size={16} color={solid ? colors.white : colors.danger} />
      <Text style={type('sm', 'bold', solid ? colors.white : colors.danger)}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  sos: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  sosBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '47.5%', flexGrow: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand,
    ...shadowSoft,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  menu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    ...shadowSoft,
  },
  menuItem: {
    width: '25%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
  },
  menuIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 60,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: colors.border,
  },
  timeBox: {
    backgroundColor: colors.brandLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  empty: { ...type('sm', 'regular', colors.textMuted), padding: spacing.lg },
});
