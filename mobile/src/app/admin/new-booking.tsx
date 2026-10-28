import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { AdminTrip, getOptions, Options, toIstLocal, TripControl, useAdmin } from '../../admin/api';
import { AdminScreen, GroupLabel, NumField, Panel, runAction, SeatMap, ToggleRow } from '../../admin/components';
import { api, errorMessage } from '../../api';
import { DateTimeField } from '../../DateTimeField';
import { fmtDateShort, fmtTime, inr } from '../../format';
import { colors, spacing, type } from '../../theme';
import { BottomBar, Button, ErrorBanner, Input, Notice, OptionSheet, SegmentedControl, SelectRow, Skeleton } from '../../ui';

type Kind = 'SEAT' | 'RENTAL';

export default function NewPhoneBooking() {
  const params = useLocalSearchParams<{ tripId?: string; seats?: string }>();
  const [kind, setKind] = useState<Kind>('SEAT');
  return (
    <AdminScreen title="New phone booking" subtitle="Confirmed straight away · cash">
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <SegmentedControl
          options={[
            { key: 'SEAT', label: 'Shared seats', mci: 'seat-passenger' },
            { key: 'RENTAL', label: 'Full cab', mci: 'car-side' },
          ]}
          value={kind}
          onChange={setKind}
        />
      </View>
      {kind === 'SEAT' ? <SeatBooking tripId={params.tripId} seats={params.seats} /> : <RentalBooking />}
    </AdminScreen>
  );
}

/** Name, mobile and the "paid already" switch, shared by both forms. */
function Customer({ name, setName, phone, setPhone }: { name: string; setName: (s: string) => void; phone: string; setPhone: (s: string) => void }) {
  return (
    <>
      <Input label="Passenger name" icon="person-outline" value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} />
      <Input
        label="Mobile number"
        icon="call-outline"
        prefix="+91"
        value={phone}
        onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
        keyboardType="phone-pad"
        maxLength={10}
      />
    </>
  );
}

const validCustomer = (name: string, phone: string) => {
  if (name.trim().length < 2) return 'Enter the passenger name.';
  if (!/^[6-9]\d{9}$/.test(phone)) return 'Enter a valid 10-digit mobile number.';
  return null;
};

// ---------------------------------------------------------------- shared seats

function SeatBooking({ tripId: initialTrip, seats: initialSeats }: { tripId?: string; seats?: string }) {
  const trips = useAdmin<{ trips: AdminTrip[] }>('/api/admin/trips');
  const [tripId, setTripId] = useState(initialTrip ?? '');
  const [control, setControl] = useState<TripControl | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>(() =>
    initialSeats
      ? initialSeats
          .split(',')
          .map(Number)
          .filter((n) => n > 0)
      : [],
  );
  const [pickupStopId, setPickup] = useState('');
  const [dropStopId, setDrop] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [female, setFemale] = useState(false);
  const [paid, setPaid] = useState(false);
  const [sheet, setSheet] = useState<null | 'trip' | 'pickup' | 'drop'>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    api<TripControl>(`/api/admin/trips/${tripId}`)
      .then((c) => {
        if (!alive) return;
        setControl(c);
        setPickup((p) => p || c.pickupStops[0]?.id || '');
        setDrop((d) => d || c.dropStops[0]?.id || '');
      })
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [tripId]);

  const open = (trips.data?.trips ?? []).filter((t) => t.status === 'SCHEDULED');
  const trip = control?.trip;
  const pickup = control?.pickupStops.find((s) => s.id === pickupStopId);
  const drop = control?.dropStops.find((s) => s.id === dropStopId);

  const save = async () => {
    if (!tripId || !control) return Alert.alert('Choose a trip', 'Pick the trip first.');
    if (!selected.length) return Alert.alert('Choose seats', 'Tap the seats to book.');
    const bad = validCustomer(name, phone);
    if (bad) return Alert.alert('Missing details', bad);
    setSaving(true);
    const r = await runAction('offlineSeatBooking', {
      tripId,
      seatNos: selected,
      passengerName: name.trim(),
      passengerPhone: phone,
      pickupStopId,
      dropStopId,
      female,
      paid,
    });
    setSaving(false);
    if (!r) return;
    Alert.alert('Booking confirmed', `Booking ${r.code ?? ''} is confirmed. The passenger gets the ticket on WhatsApp/SMS.`, [
      {
        text: 'Open booking',
        onPress: () => (r.code ? router.replace(`/admin/bookings/${r.code}`) : router.back()),
      },
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <ErrorBanner message={trips.error} onRetry={trips.reload} style={{ marginBottom: spacing.md }} />
        <Panel style={{ paddingVertical: spacing.sm }}>
          <SelectRow
            label="Trip"
            icon="bus-outline"
            value={trip ? `${fmtDateShort(trip.departAt)} ${fmtTime(trip.departAt)} · ${trip.fromCity} → ${trip.toCity}` : ''}
            placeholder={trips.data ? 'Choose a trip' : 'Loading trips…'}
            onPress={() => setSheet('trip')}
          />
        </Panel>
        <ErrorBanner message={error} style={{ marginTop: spacing.md }} />
        {tripId && !control && !error ? <Skeleton height={220} r={14} style={{ marginTop: spacing.md }} /> : null}
        {control && trip ? (
          <>
            {!control.editable ? <Notice style={{ marginTop: spacing.md }}>This trip can no longer take bookings.</Notice> : null}
            <GroupLabel>{`Seats · ${inr(trip.fare)} each`}</GroupLabel>
            <Panel>
              <SeatMap
                seats={control.seats}
                seatsPerRow={trip.seatsPerRow}
                seatLayout={trip.seatLayout}
                selected={selected}
                onPress={(s) => {
                  if (s.state !== 'FREE' || !control.editable) return;
                  setSelected((cur) => (cur.includes(s.seatNo) ? cur.filter((n) => n !== s.seatNo) : [...cur, s.seatNo].sort((a, b) => a - b)));
                }}
              />
            </Panel>
            <GroupLabel>Pickup and drop</GroupLabel>
            <Panel style={{ paddingVertical: spacing.sm }}>
              <SelectRow
                label="Pickup point"
                icon="radio-button-on"
                value={pickup ? pickup.name : ''}
                placeholder="Choose"
                onPress={() => setSheet('pickup')}
              />
              <SelectRow
                label="Drop point"
                icon="location"
                iconColor={colors.accent}
                value={drop ? drop.name : ''}
                placeholder="Choose"
                onPress={() => setSheet('drop')}
              />
            </Panel>
            <GroupLabel>Passenger</GroupLabel>
            <Panel>
              <Customer name={name} setName={setName} phone={phone} setPhone={setPhone} />
              <ToggleRow label="Woman passenger(s)" sub="Allows women-only seats and protects the seats next to her" value={female} onChange={setFemale} />
              <ToggleRow label="Already paid" sub="Cash or UPI received at the office" value={paid} onChange={setPaid} last />
            </Panel>
          </>
        ) : null}
      </ScrollView>
      <BottomBar
        caption={selected.length ? `${selected.length} seat(s) · Seat ${selected.join(', ')}` : 'Total'}
        amount={trip ? selected.length * trip.fare : 0}
        note="+ GST as per the fare rules"
      >
        <Button title="Confirm booking" icon="checkmark-circle-outline" onPress={save} loading={saving} disabled={!control?.editable} />
      </BottomBar>
      <OptionSheet
        visible={sheet === 'trip'}
        title="Trip"
        icon="bus-outline"
        value={tripId}
        options={open.map((t) => ({
          key: t.id,
          label: `${t.fromCity} → ${t.toCity}`,
          sub: `${fmtDateShort(t.departAt)} ${fmtTime(t.departAt)} · ${t.vehicle.regNumber} · ${t.vehicle.seats - t.seatsTaken} free`,
        }))}
        onSelect={(k) => {
          if (k !== tripId) {
            setControl(null);
            setError(null);
            setSelected([]);
            setPickup('');
            setDrop('');
          }
          setTripId(k);
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'pickup'}
        title="Pickup point"
        icon="radio-button-on"
        value={pickupStopId}
        options={(control?.pickupStops ?? []).map((s) => ({
          key: s.id,
          label: s.name,
          sub: s.address,
        }))}
        onSelect={setPickup}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'drop'}
        title="Drop point"
        icon="location"
        value={dropStopId}
        options={(control?.dropStops ?? []).map((s) => ({
          key: s.id,
          label: s.name,
          sub: s.address,
        }))}
        onSelect={setDrop}
        onClose={() => setSheet(null)}
      />
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------- full cab

const tomorrowAt = (h: number, plus = 1) =>
  new Date(`${toIstLocal(new Date(Date.now() + plus * 86_400_000)).slice(0, 10)}T${String(h).padStart(2, '0')}:00:00+05:30`);

function RentalBooking() {
  const [opts, setOpts] = useState<Options | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rentalType, setRentalType] = useState('ONE_WAY');
  const [vehicleId, setVehicleId] = useState('');
  const [pickupCity, setPickupCity] = useState('');
  const [dropCity, setDropCity] = useState('');
  const [startAt, setStartAt] = useState(() => tomorrowAt(9));
  const [returnAt, setReturnAt] = useState(() => tomorrowAt(18, 2));
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropAddress, setDropAddress] = useState('');
  const [passengers, setPassengers] = useState('1');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [paid, setPaid] = useState(false);
  const [sheet, setSheet] = useState<null | 'type' | 'vehicle' | 'pickup' | 'drop'>(null);
  const [saving, setSaving] = useState(false);

  const fetchOptions = () =>
    getOptions()
      .then(setOpts)
      .catch((e) => setError(errorMessage(e)));
  useEffect(() => {
    fetchOptions();
  }, []);
  const load = () => {
    setError(null);
    fetchOptions();
  };

  const needsDrop = rentalType === 'ONE_WAY' || rentalType === 'ROUND_TRIP';
  const vehicles = (opts?.vehicles ?? []).filter((v) => v.allowRental);
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const cities = (opts?.cities ?? []).map((c) => ({ key: c, label: c }));

  const save = async () => {
    if (!vehicleId) return Alert.alert('Missing details', 'Choose a vehicle.');
    if (!pickupCity) return Alert.alert('Missing details', 'Choose the pickup city.');
    if (needsDrop && (!dropCity || dropCity === pickupCity)) return Alert.alert('Missing details', 'Choose a different drop city.');
    if (rentalType === 'ROUND_TRIP' && returnAt <= startAt) return Alert.alert('Check dates', 'Return must be after pickup.');
    const bad = validCustomer(name, phone);
    if (bad) return Alert.alert('Missing details', bad);
    setSaving(true);
    const r = await runAction('offlineRentalBooking', {
      rentalType,
      vehicleId,
      pickupCity,
      dropCity: needsDrop ? dropCity : '',
      startAt: toIstLocal(startAt),
      returnAt: rentalType === 'ROUND_TRIP' ? toIstLocal(returnAt) : '',
      pickupAddress,
      dropAddress,
      passengers: Math.max(1, Number(passengers) || 1),
      passengerName: name.trim(),
      passengerPhone: phone,
      paid,
    });
    setSaving(false);
    if (!r) return;
    Alert.alert('Booking confirmed', `Full-cab booking ${r.code ?? ''} is confirmed. Assign a driver from the booking.`, [
      {
        text: 'Open booking',
        onPress: () => (r.code ? router.replace(`/admin/bookings/${r.code}`) : router.back()),
      },
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  if (!opts)
    return (
      <View style={{ padding: spacing.lg }}>
        <ErrorBanner message={error} onRetry={load} />
        {!error ? <Skeleton height={300} r={14} /> : null}
      </View>
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxxl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Panel style={{ paddingVertical: spacing.sm }}>
          <SelectRow label="Plan" icon="options-outline" value={opts.rentalTypes[rentalType] ?? rentalType} onPress={() => setSheet('type')} />
          <SelectRow
            label="Vehicle"
            icon="car-outline"
            value={vehicle ? `${vehicle.name} · ${vehicle.regNumber}` : ''}
            placeholder="Choose a vehicle"
            onPress={() => setSheet('vehicle')}
          />
          <SelectRow label="Pickup city" icon="radio-button-on" value={pickupCity} placeholder="Choose" onPress={() => setSheet('pickup')} />
          {needsDrop ? (
            <SelectRow label="Drop city" icon="location" iconColor={colors.accent} value={dropCity} placeholder="Choose" onPress={() => setSheet('drop')} />
          ) : null}
        </Panel>
        <GroupLabel>When</GroupLabel>
        <Panel>
          <DateTimeField label="Pickup date & time" mode="datetime" value={startAt} onChange={setStartAt} minimumDate={new Date()} icon="time-outline" />
          {rentalType === 'ROUND_TRIP' ? (
            <DateTimeField label="Return" mode="datetime" value={returnAt} onChange={setReturnAt} minimumDate={startAt} icon="return-down-back-outline" />
          ) : null}
        </Panel>
        <GroupLabel>Addresses</GroupLabel>
        <Panel>
          <Input label="Pickup address" icon="home-outline" value={pickupAddress} onChangeText={setPickupAddress} />
          <Input label="Drop address" icon="flag-outline" value={dropAddress} onChangeText={setDropAddress} />
          <NumField label="Passengers" value={passengers} onChange={setPassengers} style={{ marginBottom: 0 }} />
        </Panel>
        <GroupLabel>Customer</GroupLabel>
        <Panel>
          <Customer name={name} setName={setName} phone={phone} setPhone={setPhone} />
          <ToggleRow label="Already paid" sub="Cash or UPI received at the office" value={paid} onChange={setPaid} last />
        </Panel>
        <Text style={[type('xs', 'regular', colors.textMuted), { marginTop: spacing.md, textAlign: 'center' }]}>
          The fare is worked out from the vehicle rates, toll and parking, plus GST.
        </Text>
      </ScrollView>
      <BottomBar caption="Full cab" note={opts.rentalTypes[rentalType]}>
        <Button title="Confirm booking" icon="checkmark-circle-outline" onPress={save} loading={saving} />
      </BottomBar>
      <OptionSheet
        visible={sheet === 'type'}
        title="Plan"
        icon="options-outline"
        value={rentalType}
        options={Object.entries(opts.rentalTypes).map(([key, label]) => ({
          key,
          label,
        }))}
        onSelect={setRentalType}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'vehicle'}
        title="Vehicle"
        icon="car-outline"
        value={vehicleId}
        options={vehicles.map((v) => ({
          key: v.id,
          label: v.name,
          sub: `${v.regNumber} · ${v.seats} seats`,
        }))}
        onSelect={setVehicleId}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'pickup'}
        title="Pickup city"
        icon="radio-button-on"
        value={pickupCity}
        options={cities}
        onSelect={setPickupCity}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'drop'}
        title="Drop city"
        icon="location"
        value={dropCity}
        options={cities}
        onSelect={setDropCity}
        onClose={() => setSheet(null)}
      />
    </KeyboardAvoidingView>
  );
}
