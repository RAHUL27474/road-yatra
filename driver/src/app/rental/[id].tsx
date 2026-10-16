import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { post, RentalDuty, RentalEndResult } from '../../api';
import { useDuties } from '../../duties';
import { fmtDayLabel, fmtTime, fmtWhen, inr, RENTAL_TYPE, routeTitle } from '../../format';
import { postOrQueue } from '../../offline';
import { RespondBar } from '../../respond';
import { SosButton } from '../../sos';
import { colors, fonts, radius, space } from '../../theme';
import {
  Avatar,
  BottomBar,
  Button,
  callPhone,
  Card,
  confirm,
  EmptyState,
  Field,
  haptic,
  Header,
  IconButton,
  IconName,
  Ionicons,
  Loading,
  Money,
  navigateTo,
  Notice,
  OtpInput,
  Plate,
  Screen,
  Sheet,
  showError,
  StatusPill,
  T,
  TextLink,
  whatsApp,
} from '../../ui';

function AddressRow({ label, address, color, last }: { label: string; address: string | null; color: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <View style={{ alignItems: 'center', width: 18 }}>
        <View style={[st.dot, { borderColor: color }]} />
        {!last ? <View style={st.line} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : space.lg }}>
        <T v="overline" color={colors.textMuted}>
          {label}
        </T>
        <T v="bodyStrong" numberOfLines={3} style={{ marginTop: 2 }} color={address ? colors.text : colors.textMuted}>
          {address ?? 'Not provided'}
        </T>
      </View>
      {address ? <IconButton icon="navigate" tone="brand" size={48} label={`Navigate to ${label.toLowerCase()}`} onPress={() => navigateTo(address)} /> : null}
    </View>
  );
}

function InfoTile({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <View style={st.tile}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
        <T v="caption" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </T>
      </View>
      {children}
    </View>
  );
}

const tileValue = { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 28, color: colors.text } as const;

export default function RentalScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { duties, pending, refresh } = useDuties();
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<'start' | 'end' | null>(null);
  const [otp, setOtp] = useState('');
  const [odo, setOdo] = useState('');
  const [result, setResult] = useState<RentalEndResult | null>(null);

  const found = duties?.find((d): d is RentalDuty => d.kind === 'RENTAL' && d.id === id);
  // Cash noted while offline counts as collected on screen.
  const r: RentalDuty | undefined = found && (pending.some((a) => a.effect.kind === 'cash' && a.effect.bookingId === found.id) ? { ...found, amountDue: 0 } : found);
  if (!duties) return <Loading />;
  if (!r)
    return (
      <Screen>
        <Header back title="Full cab" />
        <EmptyState icon="alert-circle-outline" title="Booking not found" subtitle="It may have been reassigned. Go back and pull to refresh." />
      </Screen>
    );

  const open = (which: 'start' | 'end') => {
    setOtp('');
    setOdo('');
    setSheet(which);
  };

  const submit = async () => {
    const odometer = odo.trim() ? Number(odo) : undefined;
    if (odometer !== undefined && (!Number.isInteger(odometer) || odometer < 0)) return Alert.alert('Odometer', 'Enter the odometer reading in whole km.');
    setBusy(true);
    try {
      const body = { otp, ...(odometer !== undefined ? { odometer } : {}) };
      if (sheet === 'start') {
        await post(`/api/driver/rentals/${r.id}/start`, body);
        haptic.success();
        Alert.alert('Trip started', 'Have a safe journey. Location sharing is on.');
      } else {
        setResult(await post<RentalEndResult>(`/api/driver/rentals/${r.id}/end`, body));
        haptic.success();
      }
      setSheet(null);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const collect = () =>
    confirm('Cash collected?', `Confirm you received ${inr(r.amountDue)} in cash from ${r.customer.name}.`, 'Yes, collected', async () => {
      setBusy(true);
      try {
        const c = await postOrQueue<{ collected: number }>(`/api/driver/bookings/${r.id}/collect-cash`, undefined, { kind: 'cash', bookingId: r.id }, `Cash ${inr(r.amountDue)} from ${r.customer.name}`);
        haptic.success();
        Alert.alert(
          c.queued ? 'Cash noted' : 'Payment recorded',
          c.queued
            ? `${inr(r.amountDue)} cash from ${r.customer.name}.\n\nSaved on the phone — no internet. It will be sent automatically when the network is back.`
            : `${inr(c.result.collected)} cash from ${r.customer.name}.`,
        );
        setResult((x) => (x ? { ...x, amountDue: 0 } : x));
      } catch (e) {
        showError(e);
      } finally {
        setBusy(false);
        refresh();
      }
    });

  // Completed summary: the end-trip response if we have it, else the odometer readings on the booking.
  const kmDriven = result ? result.kmDriven : r.startOdometer != null && r.endOdometer != null ? r.endOdometer - r.startOdometer : null;
  const includedKm = result ? result.includedKm : r.estimatedKm;
  const showSummary = !!result || r.status === 'COMPLETED';
  const overKm = kmDriven != null && includedKm != null && kmDriven > includedKm ? kmDriven - includedKm : 0;
  const amountDue = result ? result.amountDue : r.amountDue;
  // Navigate to the pickup before the trip, to the drop once it has started.
  const navTarget = r.status === 'SCHEDULED' ? r.pickupAddress : r.status === 'STARTED' ? r.dropAddress : null;

  return (
    <Screen>
      <Header
        back
        title={routeTitle(r)}
        subtitle={`Full cab · ${r.code}${r.rentalType ? ` · ${RENTAL_TYPE[r.rentalType] ?? r.rentalType}` : ''}`}
        overlap={40}
        right={<SosButton />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: space.md, paddingLeft: 56 }}>
          {r.vehicle ? (
            <>
              <Plate reg={r.vehicle.regNumber} />
              <T v="label" color={colors.onBrandMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
                {r.vehicle.name}
              </T>
            </>
          ) : (
            <T v="label" color={colors.onBrandMuted}>
              Vehicle not assigned
            </T>
          )}
          <View style={{ marginLeft: 'auto' }}>
            <StatusPill status={r.status} />
          </View>
        </View>
      </Header>

      {/* Customer: overlaps the header; the call button stays in reach while scrolling. */}
      <View style={{ paddingHorizontal: space.lg, zIndex: 1 }}>
        <Card style={{ marginTop: -40, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name={r.customer.name} size={56} />
          <View style={{ flex: 1 }}>
            <T v="h2" numberOfLines={1}>
              {r.customer.name}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Ionicons name="people-outline" size={16} color={colors.textMuted} />
              <T v="label" color={colors.textMuted} style={{ fontFamily: fonts.medium }}>
                {r.customer.passengers} passenger{r.customer.passengers === 1 ? '' : 's'}
              </T>
            </View>
          </View>
          <IconButton
            icon="logo-whatsapp"
            tone="success"
            size={52}
            label={`WhatsApp ${r.customer.name}`}
            onPress={() => whatsApp(r.customer.phone, `Namaste ${r.customer.name}, this is your JSS Travels driver for booking ${r.code} (${fmtWhen(r.startAt)}).`)}
          />
          <IconButton icon="call" tone="success" solid size={60} label={`Call ${r.customer.name}`} onPress={() => callPhone(r.customer.phone)} />
        </Card>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl, gap: space.md }}
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
        <RespondBar duty={r} style={{ marginTop: 0 }} />

        {/* Route */}
        <Card>
          <AddressRow label="Pickup" address={r.pickupAddress} color={colors.success} />
          <AddressRow label="Drop" address={r.dropAddress} color={colors.danger} last />
          {navTarget ? (
            <Button
              small
              variant="outline"
              icon="navigate"
              title={r.status === 'SCHEDULED' ? 'Navigate to pickup' : 'Navigate to drop'}
              onPress={() => navigateTo(navTarget)}
              style={{ marginTop: space.lg }}
            />
          ) : null}
        </Card>

        {/* Info grid */}
        <View style={st.grid}>
          <InfoTile icon="time-outline" label={fmtDayLabel(r.startAt)}>
            <T style={tileValue}>{fmtTime(r.startAt)}</T>
            {r.endAt ? (
              <T v="caption" color={colors.textMuted} numberOfLines={1}>
                till {fmtWhen(r.endAt)}
              </T>
            ) : null}
          </InfoTile>
          <InfoTile icon="speedometer-outline" label="Included km">
            <T style={tileValue}>{r.estimatedKm != null ? `${r.estimatedKm} km` : '—'}</T>
          </InfoTile>
          <InfoTile icon="wallet-outline" label={r.amountDue > 0 ? 'Cash to collect' : 'Payment'}>
            {r.amountDue > 0 ? <Money amount={r.amountDue} color="#B45309" /> : <T style={[tileValue, { color: colors.success }]}>Paid</T>}
          </InfoTile>
          <InfoTile icon="analytics-outline" label="Odometer">
            <T style={[tileValue, { fontSize: 17, lineHeight: 24 }]} numberOfLines={1} adjustsFontSizeToFit>
              {r.startOdometer != null ? r.startOdometer : '—'} → {r.endOdometer != null ? r.endOdometer : '—'}
            </T>
            <T v="caption" color={colors.textMuted}>
              start → end (km)
            </T>
          </InfoTile>
        </View>

        {r.amountDue > 0 && (
          <Card style={{ borderColor: colors.warning, borderWidth: 1.5, gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <T v="label" color={colors.textMuted}>
                  Collect in cash
                </T>
                <Money amount={r.amountDue} size={28} />
              </View>
              <Ionicons name="cash-outline" size={36} color={colors.warning} />
            </View>
            <Button title="Cash received" icon="cash" variant="success" onPress={collect} loading={busy && !sheet} />
          </Card>
        )}

        {showSummary ? (
          <Card style={{ borderColor: colors.success, borderWidth: 2, gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Ionicons name="checkmark-circle" size={26} color={colors.success} />
              <T v="h2">Trip completed</T>
            </View>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <T v="caption" color={colors.textMuted}>
                  Km driven
                </T>
                <T style={[tileValue, { fontSize: 28, lineHeight: 34 }, overKm > 0 && { color: colors.danger }]}>{kmDriven != null ? `${kmDriven} km` : '—'}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T v="caption" color={colors.textMuted}>
                  Included
                </T>
                <T style={[tileValue, { fontSize: 28, lineHeight: 34 }]}>{includedKm != null ? `${includedKm} km` : '—'}</T>
              </View>
            </View>
            {kmDriven != null && includedKm != null && includedKm > 0 ? (
              <View style={st.track}>
                <View
                  style={[st.fill, { width: `${Math.min(100, Math.round((kmDriven / includedKm) * 100))}%`, backgroundColor: overKm > 0 ? colors.danger : colors.success }]}
                />
              </View>
            ) : null}
            {kmDriven == null ? <Notice tone="neutral" text="Odometer not entered." /> : null}
            {overKm > 0 ? <Notice tone="danger" text={`${overKm} km over the included distance — report it to the office.`} /> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T v="bodyStrong" color={colors.textMuted}>
                Cash to collect
              </T>
              {amountDue > 0 ? (
                <Money amount={amountDue} />
              ) : (
                <T v="h2" color={colors.success}>
                  Nothing (paid)
                </T>
              )}
            </View>
          </Card>
        ) : null}
      </ScrollView>

      <BottomBar>
        {r.status === 'SCHEDULED' ? (
          <Button title="Start trip" icon="play" variant="success" onPress={() => open('start')} />
        ) : r.status === 'STARTED' ? (
          <Button title="End trip" icon="stop" variant="danger" onPress={() => open('end')} />
        ) : (
          <View style={st.completed}>
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            <View style={{ flex: 1 }}>
              <T v="h2" color="#15803D">
                Trip completed
              </T>
              <T v="label" color={colors.textMuted}>
                {kmDriven != null ? `${kmDriven} km driven` : r.code}
              </T>
            </View>
          </View>
        )}
      </BottomBar>

      <Sheet
        visible={!!sheet}
        icon={sheet === 'start' ? 'play-circle' : 'flag'}
        title={sheet === 'start' ? 'Start trip' : 'End trip'}
        subtitle={sheet === 'start' ? 'Ask the customer for the 4-digit start OTP in their booking.' : 'Ask the customer for the 4-digit end-trip OTP in their booking.'}
        onClose={() => setSheet(null)}
      >
        <T v="label" color={colors.textMuted} center>
          {sheet === 'start' ? 'Start OTP' : 'End OTP'}
        </T>
        <OtpInput value={otp} onChange={setOtp} length={4} autoFocus />
        <View style={{ height: space.lg }} />
        <Field
          label={`Odometer (km)${sheet === 'start' ? ' — optional' : ''}`}
          icon="speedometer-outline"
          value={odo}
          onChangeText={(t) => setOdo(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={7}
          placeholder={sheet === 'end' && r.startOdometer != null ? `Started at ${r.startOdometer}` : 'e.g. 45210'}
          style={{ fontSize: 22, fontFamily: fonts.bold, letterSpacing: 1 }}
        />
        <Button
          title={sheet === 'start' ? 'Start trip' : 'End trip'}
          icon={sheet === 'start' ? 'play' : 'stop'}
          variant={sheet === 'start' ? 'success' : 'danger'}
          loading={busy}
          disabled={otp.length !== 4}
          onPress={submit}
        />
        <TextLink title="Cancel" color={colors.textMuted} onPress={() => setSheet(null)} />
      </Sheet>
    </Screen>
  );
}

const st = StyleSheet.create({
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 4, backgroundColor: colors.white, marginTop: 2 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: 4,
  },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 10, borderRadius: radius.pill },
  completed: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, backgroundColor: colors.successLight, borderRadius: radius.card, paddingHorizontal: space.lg },
});
