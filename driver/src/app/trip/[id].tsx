import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { BoardResult, Passenger, post, Stop, TripDuty } from '../../api';
import { useDuties } from '../../duties';
import { bookedSeats, fmtTime, fmtWhen, inr, routeTitle } from '../../format';
import { postOrQueue } from '../../offline';
import { RespondBar } from '../../respond';
import { Scanner } from '../../Scanner';
import { SosButton } from '../../sos';
import { colors, fonts, radius, space } from '../../theme';
import {
  Badge,
  BottomBar,
  Button,
  callPhone,
  Card,
  confirm,
  EmptyState,
  haptic,
  Header,
  IconButton,
  Ionicons,
  Loading,
  Money,
  navigateToStop,
  Notice,
  OtpInput,
  Plate,
  Screen,
  Sheet,
  showError,
  StatusPill,
  T,
  whatsApp,
} from '../../ui';

const SAVED_OFFLINE = 'Saved on the phone — no internet. It will be sent automatically when the network is back.';

const seatText = (seats: number[] | string) => `Seat ${Array.isArray(seats) ? seats.join(', ') : seats}`;

function SeatBadges({ seats }: { seats: number[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {seats.map((n) => (
        <View key={n} style={st.seat}>
          <T style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.brand }}>{n}</T>
        </View>
      ))}
    </View>
  );
}

function Stat({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <View style={[st.stat, !last && { borderRightWidth: 1, borderRightColor: colors.border }]}>
      <T v="caption" color={colors.textMuted} numberOfLines={1}>
        {label}
      </T>
      {children}
    </View>
  );
}

export default function TripScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { duties, pending, refresh } = useDuties();
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [otpFor, setOtpFor] = useState<Passenger | null>(null);
  const [otp, setOtp] = useState('');

  const found = duties?.find((d): d is TripDuty => d.kind === 'TRIP' && d.id === id);
  // Show actions saved offline as if they had already gone through.
  const trip: TripDuty | undefined = found && {
    ...found,
    passengers: found.passengers.map((p) => {
      const mine = pending.filter((a) => a.effect.bookingId === p.bookingId);
      if (!mine.length) return p;
      return {
        ...p,
        boarded: p.boarded || mine.some((a) => a.effect.kind === 'board'),
        noShow: p.noShow || mine.some((a) => a.effect.kind === 'noShow'),
        amountDue: mine.some((a) => a.effect.kind === 'cash') ? 0 : p.amountDue,
      };
    }),
  };
  if (!duties) return <Loading />;
  if (!trip)
    return (
      <Screen>
        <Header back title="Shared trip" />
        <EmptyState icon="alert-circle-outline" title="Trip not found" subtitle="It may have been reassigned. Go back and pull to refresh." />
      </Screen>
    );

  /** Runs an API action with a busy flag, shows errors, and reloads duties afterwards. */
  const act = async <T,>(key: string, fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(key);
    try {
      return await fn();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const collectCash = (bookingId: string, name: string, amount: number) =>
    confirm('Cash collected?', `Confirm you received ${inr(amount)} in cash from ${name}.`, 'Yes, collected', () =>
      act('cash' + bookingId, async () => {
        const r = await postOrQueue<{ collected: number }>(`/api/driver/bookings/${bookingId}/collect-cash`, undefined, { kind: 'cash', bookingId }, `Cash ${inr(amount)} from ${name}`);
        haptic.success();
        Alert.alert(r.queued ? 'Cash noted' : 'Payment recorded', r.queued ? `${inr(amount)} cash from ${name}.\n\n${SAVED_OFFLINE}` : `${inr(r.result.collected)} cash from ${name}.`);
      }),
    );

  const board = async (body: { qr: string } | { bookingId: string; otp: string }) => {
    // The ticket QR is "RY:<code>:<otp>": find the passenger locally so an offline boarding shows on the list.
    const code = 'qr' in body ? /^RY:([A-Z0-9]+):\d{4}$/.exec(body.qr.trim())?.[1] : undefined;
    const p = 'bookingId' in body ? trip.passengers.find((x) => x.bookingId === body.bookingId) : trip.passengers.find((x) => x.code === code);
    const out = await act('board', () => postOrQueue<BoardResult>('/api/driver/board', body, { kind: 'board', bookingId: p?.bookingId ?? '' }, `Board ${p?.name ?? code ?? 'passenger'}`));
    if (!out) return;
    setOtpFor(null);
    haptic.success();
    if (out.queued) {
      Alert.alert(p ? `${p.name} boarded` : 'Boarding saved', `${p ? `${seatText(p.seatNos)}${p.amountDue > 0 ? `\nCollect ${inr(p.amountDue)} cash` : ''}\n\n` : ''}${SAVED_OFFLINE} The OTP is checked then.`);
      return;
    }
    const r = out.result;
    if (r.amountDue > 0)
      Alert.alert(`${r.name} boarded`, `${seatText(r.seatNos)}\n\nCollect ${inr(r.amountDue)} cash`, [
        { text: 'Later', style: 'cancel' },
        { text: 'Cash collected', onPress: () => collectCash(r.bookingId, r.name, r.amountDue) },
      ]);
    else Alert.alert(`${r.name} boarded`, `${seatText(r.seatNos)} · Paid`);
  };

  const start = () =>
    confirm('Start trip?', `${routeTitle(trip)} at ${fmtTime(trip.startAt)}. Location sharing will start.`, 'Start trip', () =>
      act('trip', () => post(`/api/driver/trips/${trip.id}/start`)),
    );

  const end = () => {
    const waiting = trip.passengers.filter((p) => !p.boarded && !p.noShow);
    const msg = waiting.length
      ? `${waiting.length} passenger${waiting.length > 1 ? 's have' : ' has'} not boarded (${waiting.map((p) => p.name).join(', ')}). They will be marked as no-show.`
      : 'All passengers are marked. Location sharing will stop.';
    if (waiting.length) haptic.warning();
    confirm(waiting.length ? 'End trip anyway?' : 'End trip?', msg, 'End trip', () => act('trip', () => post(`/api/driver/trips/${trip.id}/end`)), true);
  };

  const noShow = (p: Passenger) =>
    confirm(
      'Mark no-show?',
      `${p.name} (${seatText(p.seatNos)}) did not turn up.`,
      'No-show',
      () =>
        act('ns' + p.bookingId, async () => {
          const r = await postOrQueue(`/api/driver/bookings/${p.bookingId}/no-show`, undefined, { kind: 'noShow', bookingId: p.bookingId }, `No-show ${p.name}`);
          if (r.queued) Alert.alert('No-show noted', SAVED_OFFLINE);
        }),
      true,
    );

  // Manifest grouped by pickup stop, in booking order.
  const groups = new Map<string, { stop: Stop | null; list: Passenger[] }>();
  for (const p of trip.passengers) {
    const key = p.pickupStop ? p.pickupStop.name : 'Pickup not chosen';
    const g = groups.get(key) ?? { stop: p.pickupStop, list: [] };
    g.list.push(p);
    groups.set(key, g);
  }
  const boarded = trip.passengers.filter((p) => p.boarded).length;
  const cashDue = trip.passengers.reduce((n, p) => n + (p.amountDue > 0 ? p.amountDue : 0), 0);
  const done = trip.status === 'COMPLETED';

  return (
    <Screen>
      <Header back title={routeTitle(trip)} subtitle={`${fmtWhen(trip.startAt)} · arrives ${fmtTime(trip.endAt)}`} overlap={36} right={<SosButton />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: space.md, paddingLeft: 56 }}>
          <Plate reg={trip.vehicle.regNumber} />
          <T v="label" color={colors.onBrandMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
            {trip.vehicle.name}
          </T>
          <View style={{ marginLeft: 'auto' }}>
            <StatusPill status={trip.status} />
          </View>
        </View>
      </Header>

      {/* Summary strip: overlaps the header and stays visible while the manifest scrolls. */}
      <View style={{ paddingHorizontal: space.lg, zIndex: 1 }}>
        <Card padded={false} style={st.summary}>
          <Stat label="Seats booked">
            <T style={st.statNum}>
              {bookedSeats(trip)}
              <T v="bodyStrong" color={colors.textMuted}>
                /{trip.vehicle.seats}
              </T>
            </T>
          </Stat>
          <Stat label="Boarded">
            <T style={[st.statNum, boarded === trip.passengers.length && trip.passengers.length > 0 && { color: colors.success }]}>
              {boarded}
              <T v="bodyStrong" color={colors.textMuted}>
                /{trip.passengers.length}
              </T>
            </T>
          </Stat>
          <Stat label="Cash due" last>
            <Money amount={cashDue} size={20} color={cashDue > 0 ? '#B45309' : colors.success} />
          </Stat>
        </Card>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[colors.brand]}
            tintColor={colors.brand}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
          />
        }
      >
        <RespondBar duty={trip} />
        {!done && (
          <Button
            title="Scan ticket"
            mci="qrcode-scan"
            onPress={() => setScanning(true)}
            loading={busy === 'board' && !otpFor}
            style={{ marginTop: space.lg, height: 64 }}
          />
        )}

        {trip.blockedSeats.length || trip.boardingPoint ? (
          <View style={{ gap: space.sm, marginTop: space.lg }}>
            {trip.blockedSeats.length ? (
              <Notice
                tone="neutral"
                icon="lock-closed"
                text={`Blocked seats: ${trip.blockedSeats.map((b) => `${b.seatNo}${b.reason ? ` (${b.reason})` : ''}`).join(', ')}`}
              />
            ) : null}
            {trip.boardingPoint ? <Notice tone="brand" icon="information-circle" text={`Note: ${trip.boardingPoint}`} /> : null}
          </View>
        ) : null}

        <View style={st.manifestHead}>
          <T v="overline" color={colors.textMuted}>
            Passengers
          </T>
          <T v="caption" color={colors.textMuted}>
            {trip.passengers.length} booking{trip.passengers.length === 1 ? '' : 's'}
          </T>
        </View>
        {!trip.passengers.length && (
          <Card>
            <EmptyState icon="people-outline" title="No bookings yet" subtitle="Passengers who book this trip will appear here." />
          </Card>
        )}

        {[...groups].map(([name, { stop, list }]) => (
          <View key={name} style={{ marginBottom: space.lg }}>
            <View style={st.groupHead}>
              <View style={st.pin}>
                <Ionicons name="location" size={18} color={colors.white} />
              </View>
              <T v="h2" numberOfLines={1} style={{ flex: 1 }}>
                {name}
              </T>
              <Badge label={`${list.length}`} tone="brand" icon="person" />
              {stop && !done ? <IconButton icon="navigate" tone="brand" size={40} label={`Navigate to ${name}`} onPress={() => navigateToStop(stop)} /> : null}
            </View>

            <View style={{ gap: space.md }}>
              {list.map((p) => (
                <Card key={p.bookingId} padded={false} style={[st.pax, p.boarded && st.paxBoarded, p.noShow && !p.boarded && { opacity: 0.7 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <SeatBadges seats={p.seatNos} />
                      <T v="h2" numberOfLines={1}>
                        {p.name}
                      </T>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
                        <T v="label" color={colors.textMuted} numberOfLines={1} style={{ flex: 1, fontFamily: fonts.medium }}>
                          Drop: {p.dropStop?.name ?? '—'} · {p.code}
                        </T>
                      </View>
                    </View>
                    <View style={{ gap: space.sm }}>
                      <IconButton icon="call" tone="success" solid size={52} label={`Call ${p.name}`} onPress={() => callPhone(p.phone)} />
                      <IconButton
                        icon="logo-whatsapp"
                        tone="success"
                        size={52}
                        label={`WhatsApp ${p.name}`}
                        onPress={() => whatsApp(p.phone, `Namaste ${p.name}, this is your JSS Travels driver for ${routeTitle(trip)} (${fmtWhen(trip.startAt)}).`)}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
                    {p.boarded ? (
                      <Badge label="Boarded" tone="success" icon="checkmark-circle" large />
                    ) : p.noShow ? (
                      <Badge label="No-show" tone="danger" icon="close-circle" large />
                    ) : (
                      <Badge label="Waiting" tone="neutral" icon="time-outline" large />
                    )}
                    {p.amountDue > 0 ? (
                      <Badge label={`Collect ${inr(p.amountDue)}`} tone="warning" icon="cash-outline" large />
                    ) : (
                      <Badge label="Paid" tone="success" icon="card-outline" large />
                    )}
                  </View>

                  {!done && !p.boarded ? (
                    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
                      <Button
                        small
                        variant="outline"
                        icon="keypad-outline"
                        title="OTP"
                        style={{ flex: 1 }}
                        onPress={() => {
                          setOtp('');
                          setOtpFor(p);
                        }}
                      />
                      {!p.noShow && (
                        <Button
                          small
                          variant="outlineDanger"
                          icon="person-remove-outline"
                          title="No-show"
                          style={{ flex: 1 }}
                          loading={busy === 'ns' + p.bookingId}
                          onPress={() => noShow(p)}
                        />
                      )}
                    </View>
                  ) : null}
                  {p.amountDue > 0 && (
                    <Button
                      small
                      variant="success"
                      icon="cash"
                      title={`Cash received · ${inr(p.amountDue)}`}
                      style={{ marginTop: space.sm }}
                      loading={busy === 'cash' + p.bookingId}
                      onPress={() => collectCash(p.bookingId, p.name, p.amountDue)}
                    />
                  )}
                </Card>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <BottomBar>
        {trip.status === 'SCHEDULED' ? (
          <Button title="Start trip" icon="play" variant="success" onPress={start} loading={busy === 'trip'} />
        ) : trip.status === 'STARTED' ? (
          <Button title="End trip" icon="stop" variant="danger" onPress={end} loading={busy === 'trip'} />
        ) : (
          <View style={st.completed}>
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            <View style={{ flex: 1 }}>
              <T v="h2" color="#15803D">
                Trip completed
              </T>
              <T v="label" color={colors.textMuted}>
                {boarded} of {trip.passengers.length} passengers boarded
              </T>
            </View>
          </View>
        )}
      </BottomBar>

      <Scanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onScan={(qr) => {
          setScanning(false);
          board({ qr });
        }}
      />
      <Sheet
        visible={!!otpFor}
        icon="keypad"
        title="Boarding OTP"
        subtitle={otpFor ? `${otpFor.name} · ${seatText(otpFor.seatNos)}` : undefined}
        onClose={() => setOtpFor(null)}
      >
        <T v="body" color={colors.textMuted} center style={{ marginBottom: space.md }}>
          Ask the passenger for the 4-digit OTP on their ticket.
        </T>
        <OtpInput value={otp} onChange={setOtp} length={4} autoFocus />
        <Button
          title="Board passenger"
          icon="checkmark-circle"
          variant="success"
          loading={busy === 'board'}
          disabled={otp.length !== 4}
          onPress={() => otpFor && board({ bookingId: otpFor.bookingId, otp })}
          style={{ marginTop: space.xl }}
        />
      </Sheet>
    </Screen>
  );
}

const st = StyleSheet.create({
  summary: { flexDirection: 'row', marginTop: -36, paddingVertical: space.md },
  stat: { flex: 1, paddingHorizontal: space.md, gap: 2 },
  statNum: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 30, color: colors.text, fontVariant: ['tabular-nums'] },
  manifestHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xxl, marginBottom: space.md },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  pin: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  pax: { padding: space.lg },
  paxBoarded: { borderColor: colors.success, borderWidth: 2, backgroundColor: '#F7FEF9' },
  seat: { minWidth: 34, height: 30, paddingHorizontal: 6, borderRadius: radius.input, backgroundColor: colors.brandLight, borderWidth: 1.5, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  completed: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, backgroundColor: colors.successLight, borderRadius: radius.card, paddingHorizontal: space.lg },
});
