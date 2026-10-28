import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ManifestRow, TripControl, useAdmin } from '../../../admin/api';
import {
  AdminScreen,
  ContactButtons,
  DriverLine,
  GroupLabel,
  Kpi,
  Panel,
  Pill,
  payTone,
  runAction,
  SeatCell,
  SeatMap,
  tripTone,
} from '../../../admin/components';
import { fmtDateTime, fmtTime, inr } from '../../../format';
import { colors, spacing, tabular, type } from '../../../theme';
import { BottomBar, Button, ErrorBanner, Notice, OptionSheet, SkeletonList } from '../../../ui';

export default function AdminTripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, refreshing, refresh, reload } = useAdmin<TripControl>(`/api/admin/trips/${id}`);
  const [selected, setSelected] = useState<number[]>([]);
  const [sheet, setSheet] = useState<null | 'driver' | 'reason'>(null);
  const t = data?.trip;

  const groups = useMemo(() => {
    const m = new Map<string, ManifestRow[]>();
    for (const r of data?.manifest ?? []) m.set(r.pickup || 'Pickup not chosen', [...(m.get(r.pickup || 'Pickup not chosen') ?? []), r]);
    return [...m.entries()];
  }, [data]);

  const onSeat = async (s: SeatCell) => {
    if (!data) return;
    if (s.state === 'BOOKED') {
      const seat = data.seats.find((x) => x.seatNo === s.seatNo);
      if (seat?.bookingId) router.push(`/admin/bookings/${seat.bookingId}`);
      return;
    }
    if (!data.editable) return;
    if (s.state === 'BLOCKED') {
      const r = await runAction(
        'unblockSeat',
        { tripId: id, seatNo: s.seatNo },
        {
          confirm: {
            title: `Unblock seat ${s.seatNo}?`,
            message: `Blocked for: ${s.blockReason ?? 'office'}. It goes back on sale.`,
            ok: 'Unblock',
          },
        },
      );
      if (r) reload();
      return;
    }
    setSelected((cur) => (cur.includes(s.seatNo) ? cur.filter((n) => n !== s.seatNo) : [...cur, s.seatNo].sort((a, b) => a - b)));
  };

  const block = async (reason: string) => {
    const r = await runAction('blockSeats', {
      tripId: id,
      seatNos: selected,
      reason,
    });
    if (r) {
      setSelected([]);
      reload();
    }
  };

  return (
    <AdminScreen title={t ? `${t.fromCity} → ${t.toCity}` : 'Trip'} subtitle={t ? `${fmtDateTime(t.departAt)} · ${t.vehicle.regNumber}` : undefined}>
      {!data || !t ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorBanner message={error} onRetry={reload} />
          {!error ? <SkeletonList count={3} style={{ padding: 0 }} /> : null}
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{
              padding: spacing.lg,
              paddingBottom: spacing.xxxl,
            }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.brand]} />}
          >
            <ErrorBanner message={error} onRetry={reload} style={{ marginBottom: spacing.md }} />
            <Panel>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Pill label={t.status} tone={tripTone(t.status)} />
                <Text style={[type('sm', 'semibold', colors.textMuted), tabular, { flex: 1 }]}>
                  {fmtTime(t.departAt)} → {fmtTime(t.arriveAt)} · {inr(t.fare)}
                  /seat
                </Text>
              </View>
              <Text style={[type('md', 'bold'), { marginTop: spacing.sm }]}>{t.vehicle.name}</Text>
              <DriverLine driver={t.driver} response={t.driverResponse} note={t.driverNote} scheduled={t.status === 'SCHEDULED'} />
              {t.boardingPoint ? <Text style={[type('xs', 'regular', colors.textMuted), { marginTop: 4 }]}>{t.boardingPoint}</Text> : null}
              {data.editable ? (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: spacing.sm,
                    marginTop: spacing.md,
                  }}
                >
                  <Button
                    title={t.driver ? 'Change driver' : 'Assign driver'}
                    icon="person-add-outline"
                    variant="outline"
                    size="md"
                    style={{ flex: 1 }}
                    onPress={() => setSheet('driver')}
                  />
                  {t.driver ? <ContactButtons phone={t.driver.phone} /> : null}
                </View>
              ) : null}
            </Panel>

            <View style={st.kpis}>
              <Kpi label="Sold" value={`${data.summary.sold}/${data.summary.seats}`} icon="seat-passenger" style={st.kpi} />
              <Kpi label="Blocked" value={String(data.summary.blocked)} icon="seat-outline" tone="warning" style={st.kpi} />
              <Kpi label="Cash to collect" value={inr(data.summary.cashToCollect)} icon="hand-coin-outline" tone="success" style={st.kpi} />
            </View>

            <GroupLabel>Seats</GroupLabel>
            <Panel>
              <SeatMap seats={data.seats} seatsPerRow={t.seatsPerRow} seatLayout={t.seatLayout} selected={selected} onPress={onSeat} />
              <Text style={[type('xs', 'regular', colors.textMuted), { textAlign: 'center', marginTop: spacing.md }]}>
                {data.editable
                  ? 'Tap free seats to select them, a blocked seat to unblock it, or a booked seat to open the booking.'
                  : 'This trip can no longer be changed.'}
              </Text>
            </Panel>

            <GroupLabel>{`Passenger manifest (${data.manifest.length})`}</GroupLabel>
            {groups.length === 0 ? (
              <Panel>
                <Text style={type('sm', 'regular', colors.textMuted)}>No bookings on this trip yet.</Text>
              </Panel>
            ) : (
              groups.map(([pickup, rows]) => (
                <View key={pickup} style={{ marginBottom: spacing.md }}>
                  <Text style={st.pickup}>{pickup}</Text>
                  <Panel flush>
                    {rows.map((r, i) => (
                      <Pressable key={r.id} onPress={() => router.push(`/admin/bookings/${r.id}`)} style={[st.mRow, i < rows.length - 1 && st.mBorder]}>
                        <View style={st.seatBadge}>
                          <Text style={[type('xs', 'extrabold', colors.brand), tabular]}>{r.seatNos.join(',')}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={type('sm', 'bold')} numberOfLines={1}>
                            {r.passengerName}
                          </Text>
                          <Text style={[type('xs', 'regular', colors.textMuted), tabular]} numberOfLines={1}>
                            {r.code} · to {r.drop || '—'}
                            {r.cashDue ? ` · collect ${inr(r.cashDue)}` : ''}
                          </Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              gap: 6,
                              marginTop: 4,
                            }}
                          >
                            <Pill label={r.paymentStatus.replace('_', ' ')} tone={payTone(r.paymentStatus)} />
                            {r.boardedAt ? <Pill label="Boarded" tone="success" /> : null}
                            {r.noShow ? <Pill label="No-show" tone="danger" /> : null}
                            {r.source === 'OFFLINE' ? <Pill label="Phone" /> : null}
                          </View>
                        </View>
                        <ContactButtons phone={r.passengerPhone} />
                      </Pressable>
                    ))}
                  </Panel>
                </View>
              ))
            )}

            {data.editable ? (
              <>
                <GroupLabel>Trip actions</GroupLabel>
                <View style={{ gap: spacing.sm }}>
                  <Button
                    title="Phone booking on this trip"
                    icon="call-outline"
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: '/admin/new-booking',
                        params: { tripId: id },
                      })
                    }
                  />
                  <Button
                    title="Cancel trip"
                    icon="close-circle-outline"
                    variant="dangerOutline"
                    onPress={async () => {
                      const r = await runAction(
                        'cancelTrip',
                        { id },
                        {
                          confirm: {
                            title: 'Cancel this trip?',
                            message: `All ${data.manifest.length} booking(s) are cancelled with a full refund and passengers are told. This can't be undone.`,
                            ok: 'Cancel trip',
                            destructive: true,
                          },
                        },
                      );
                      if (r) router.back();
                    }}
                  />
                </View>
              </>
            ) : (
              <Notice tone="info" style={{ marginTop: spacing.md }}>{`This trip is ${t.status.toLowerCase()}: seats and bookings can't be changed.`}</Notice>
            )}
          </ScrollView>
          {selected.length ? (
            <BottomBar caption={`${selected.length} seat${selected.length > 1 ? 's' : ''} selected`} note={`Seat ${selected.join(', ')}`}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="Block" icon="lock-closed-outline" variant="outline" size="md" fullWidth={false} onPress={() => setSheet('reason')} />
                <Button
                  title="Book"
                  icon="call-outline"
                  size="md"
                  fullWidth={false}
                  onPress={() => {
                    const seats = selected.join(',');
                    setSelected([]);
                    router.push({
                      pathname: '/admin/new-booking',
                      params: { tripId: id, seats },
                    });
                  }}
                />
              </View>
            </BottomBar>
          ) : null}
          <OptionSheet
            visible={sheet === 'reason'}
            title="Block seats for"
            icon="lock-closed-outline"
            options={data.blockReasons.map((r) => ({
              key: r,
              label: r.charAt(0) + r.slice(1).toLowerCase(),
            }))}
            onSelect={block}
            onClose={() => setSheet(null)}
          />
          <OptionSheet
            visible={sheet === 'driver'}
            title="Assign driver"
            icon="person-outline"
            value={t.driver?.id ?? ''}
            options={[
              { key: '', label: 'No driver', sub: 'Remove the current driver' },
              ...data.drivers.map((d) => ({
                key: d.id,
                label: d.name,
                sub: d.phone,
              })),
            ]}
            onSelect={async (driverId) => {
              if (await runAction('assignTripDriver', { id, driverId })) reload();
            }}
            onClose={() => setSheet(null)}
          />
        </>
      )}
    </AdminScreen>
  );
}

const st = StyleSheet.create({
  kpis: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  kpi: { flex: 1 },
  pickup: {
    ...type('sm', 'bold', colors.brand),
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  mRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  mBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: colors.border,
  },
  seatBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
