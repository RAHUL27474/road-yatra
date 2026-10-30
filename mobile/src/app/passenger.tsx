import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, ApiError, CreateBookingResponse, Config, errorMessage, getConfig, PaymentChoice, Stop, TripDetail } from '../api';
import { useAuth } from '../auth';
import { fmtDateShort, fmtDateTime, fmtDuration, fmtTime, inr, RENTAL_TYPE, VEHICLE_TYPE } from '../format';
import { VehicleArt } from '../illustrations';
import { useQuote, useRentalRequest } from '../rental';
import { openPayment } from '../store';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../theme';
import { BottomBar, Button, ErrorBanner, hapticSelect, Header, Input, IonName, Notice, Row, Screen, Skeleton, StepIndicator } from '../ui';
import { SeatTraveller, SeatTravellers, saveTravellers } from '../travellers';
import { currentPosition, fmtDistance, LatLng, nearest, openMap } from '../geo';

type Amounts = { baseAmount: number; taxAmount: number; totalAmount: number; toll?: number; parking?: number };
type FormValues = {
  passengerName: string;
  passengerPhone: string;
  passengers: number;
  pickupAddress: string;
  dropAddress: string;
  /** Exact pickup pin (full cab), from "Use my current location". */
  pickupPin: LatLng | null;
  payment: PaymentChoice;
};

export default function Passenger() {
  const { kind } = useLocalSearchParams<{ kind: 'SEAT' | 'RENTAL' }>();
  return kind === 'RENTAL' ? <RentalPassenger /> : <SeatPassenger />;
}

const SEAT_STEPS = ['Seats', 'Details', 'Pay'];
const RENTAL_STEPS = ['Vehicle', 'Details', 'Pay'];

/** Loading / error placeholder with the screen header and a layout-shaped skeleton. */
function Placeholder({ error, rental, onRetry }: { error?: string | null; rental?: boolean; onRetry?: () => void }) {
  return (
    <Screen>
      <Header title="Review & pay" />
      <StepIndicator steps={rental ? RENTAL_STEPS : SEAT_STEPS} current={1} />
      {error ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorBanner message={error} onRetry={onRetry} />
        </View>
      ) : (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={[st.card, { gap: spacing.md }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={70} height={24} />
              <Skeleton width={70} height={24} />
            </View>
            <Skeleton width="70%" height={14} />
            <Skeleton width="50%" height={14} />
          </View>
          <View style={[st.card, { gap: spacing.md }]}>
            <Skeleton width="40%" height={16} />
            <Skeleton height={50} r={radius.input} />
            <Skeleton height={50} r={radius.input} />
          </View>
          <View style={[st.card, { gap: spacing.md }]}>
            <Skeleton width="40%" height={16} />
            <Skeleton height={64} r={12} />
          </View>
        </View>
      )}
    </Screen>
  );
}

function SeatPassenger() {
  const { tripId, seats, womenOnly: womenOnlyParam } = useLocalSearchParams<{ tripId: string; seats: string; womenOnly?: string }>();
  const seatNos = seats.split(',').map(Number);
  const womenOnly = (womenOnlyParam ?? '').split(',').filter(Boolean).map(Number);
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [gstRate, setGstRate] = useState(0.05);
  const [config, setConfig] = useState<Config | null>(null);
  const [travellers, setTravellers] = useState<SeatTraveller[]>(() => seatNos.map((seatNo) => ({ seatNo, name: '', phone: '', female: womenOnly.includes(seatNo) })));
  const [error, setError] = useState<string | null>(null);
  const [pickupStopId, setPickupStopId] = useState<string | null>(null);
  const [dropStopId, setDropStopId] = useState<string | null>(null);

  const load = () => {
    api<{ trip: TripDetail }>(`/api/trips/${tripId}`)
      .then((r) => {
        setError(null);
        setTrip(r.trip);
        setPickupStopId(r.trip.pickupStops[0]?.id ?? null);
        setDropStopId(r.trip.dropStops[0]?.id ?? null);
      })
      .catch((e) => setError(errorMessage(e)));
    getConfig()
      .then((c) => {
        setGstRate(c.gstRate);
        setConfig(c);
      })
      .catch(() => {});
  };
  useEffect(load, [tripId]);

  if (!trip) return <Placeholder error={error} onRetry={load} />;
  // Same price the server will charge, including this customer's return-trip discount (if any).
  const discount = trip.discountPercent ?? 0;
  const baseAmount = Math.round(trip.fare * seatNos.length * (1 - discount / 100));
  const taxAmount = Math.round(baseAmount * gstRate);
  const mins = Math.round((Date.parse(trip.arriveAt) - Date.parse(trip.departAt)) / 60000);

  return (
    <PassengerForm
      steps={SEAT_STEPS}
      amounts={{ baseAmount, taxAmount, totalAmount: baseAmount + taxAmount }}
      fareLabel={`Fare (${seatNos.length} × ${inr(trip.fare)}${discount ? `, ${discount}% return discount` : ''})`}
      advance={config?.advancePerSeat ? Math.min(baseAmount + taxAmount, config.advancePerSeat * seatNos.length) : 0}
      travellers={<SeatTravellers seats={seatNos} womenOnly={womenOnly} value={travellers} onChange={setTravellers} />}
      summary={
        <>
          <Journey
            from={trip.fromCity}
            to={trip.toCity}
            fromTime={fmtTime(trip.departAt)}
            toTime={fmtTime(trip.arriveAt)}
            middle={fmtDuration(mins)}
            date={fmtDateShort(trip.departAt)}
          />
          <View style={st.summaryFoot}>
            <VehicleArt type={trip.vehicle.type} width={64} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={type('sm', 'bold')} numberOfLines={1}>
                {trip.vehicle.name}
              </Text>
              <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
                {VEHICLE_TYPE[trip.vehicle.type]}
              </Text>
            </View>
            <View style={st.seatPill}>
              <Text style={type('xs', 'semibold', colors.brand)}>Seat{seatNos.length > 1 ? 's' : ''}</Text>
              <Text style={[type('sm', 'extrabold', colors.brand), tabular]}>{seatNos.join(', ')}</Text>
            </View>
          </View>
          {trip.boardingPoint ? (
            <View style={st.note}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={[type('xs', 'regular', colors.textMuted), { flex: 1 }]}>{trip.boardingPoint}</Text>
            </View>
          ) : null}
          {config?.returnDiscountPercent ? (
            <View style={st.note}>
              <Ionicons name="pricetag-outline" size={16} color={colors.success} />
              <Text style={[type('xs', 'medium', colors.success), { flex: 1 }]}>
                Return trip? {config.returnDiscountPercent}% off is applied automatically when you already have the onward journey booked.
              </Text>
            </View>
          ) : null}
        </>
      }
      extraFields={
        trip.pickupStops.length || trip.dropStops.length ? (
          <>
            {trip.pickupStops.length ? (
              <>
                <NearestStopButton stops={trip.pickupStops} onPick={setPickupStopId} />
                <StopPicker label={`Pickup point · ${trip.fromCity}`} icon="radio-button-on" stops={trip.pickupStops} value={pickupStopId} onChange={setPickupStopId} />
              </>
            ) : null}
            {trip.dropStops.length ? (
              <StopPicker label={`Drop point · ${trip.toCity}`} icon="location" stops={trip.dropStops} value={dropStopId} onChange={setDropStopId} />
            ) : null}
          </>
        ) : null
      }
      body={(v) => ({
        kind: 'SEAT',
        tripId,
        seatNos,
        ...(pickupStopId ? { pickupStopId } : {}),
        ...(dropStopId ? { dropStopId } : {}),
        passengerName: v.passengerName,
        passengerPhone: v.passengerPhone,
        payment: v.payment,
        seatPassengers: travellers
          .filter((t) => t.name.trim() || t.phone.trim() || t.female)
          .map((t) => {
            saveTravellers(travellers);
            const phone = t.phone.replace(/\D/g, '').slice(-10);
            return { seatNo: t.seatNo, name: t.name.trim() || undefined, phone: /^[6-9]\d{9}$/.test(phone) ? phone : undefined, female: t.female };
          }),
      })}
    />
  );
}

/** Times and cities on the left and right, duration and date in the middle. */
function Journey({ from, to, fromTime, toTime, middle, date }: { from: string; to: string; fromTime?: string; toTime?: string; middle?: string; date?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {fromTime ? <Text style={[type('xl', 'extrabold'), tabular]}>{fromTime}</Text> : null}
        <Text style={fromTime ? type('sm', 'semibold', colors.textMuted) : type('lg', 'extrabold')} numberOfLines={1}>
          {from}
        </Text>
      </View>
      <View style={{ alignItems: 'center', minWidth: 96 }}>
        {middle ? <Text style={[type('xs', 'semibold', colors.textMuted), tabular]}>{middle}</Text> : null}
        <View style={st.jLine}>
          <View style={st.jDot} />
          <View style={st.jDash} />
          <View style={[st.jDot, { backgroundColor: colors.accent, borderColor: colors.accent }]} />
        </View>
        {date ? (
          <Text style={[type('xs', 'medium', colors.textMuted), { marginTop: 2 }]} numberOfLines={1}>
            {date}
          </Text>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
        {toTime ? <Text style={[type('xl', 'extrabold'), tabular]}>{toTime}</Text> : null}
        <Text style={[toTime ? type('sm', 'semibold', colors.textMuted) : type('lg', 'extrabold'), { textAlign: 'right' }]} numberOfLines={1}>
          {to}
        </Text>
      </View>
    </View>
  );
}

function Radio({ on }: { on: boolean }) {
  return <View style={[st.radio, on && { borderColor: colors.brand }]}>{on ? <View style={st.radioDot} /> : null}</View>;
}

/** "Use my location" — selects the pickup point closest to the customer. Hidden when no point has coordinates. */
function NearestStopButton({ stops, onPick }: { stops: Stop[]; onPick: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  if (!stops.some((s) => s.lat != null && s.lng != null)) return null;
  const find = async () => {
    setBusy(true);
    setNote(null);
    try {
      const best = nearest(await currentPosition(), stops);
      if (!best) throw new Error('No pickup point has a map location yet.');
      onPick(best.item.id);
      setNote({ ok: true, text: `Nearest to you: ${best.item.name} (${fmtDistance(best.km)} away). Selected.` });
    } catch (e) {
      setNote({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 6, marginBottom: spacing.sm }}>
      <Button title="Use my location — nearest pickup point" icon="locate-outline" variant="outline" size="md" loading={busy} onPress={find} />
      {note ? <Text style={type('xs', 'medium', note.ok ? colors.success : colors.danger)}>{note.text}</Text> : null}
    </View>
  );
}

/** "Use my current location" for the exact pickup pin of a full cab; the driver gets directions to it. */
function PickupPinButton({ value, onChange }: { value: LatLng | null; onChange: (p: LatLng | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locate = async () => {
    setBusy(true);
    setError(null);
    try {
      onChange(await currentPosition());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 6, marginBottom: spacing.md }}>
      <Button
        title={value ? 'Update pin to where I am now' : 'Use my current location as the pickup pin'}
        icon="locate-outline"
        variant="outline"
        size="md"
        loading={busy}
        onPress={locate}
      />
      {value ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'center' }}>
          <Text style={type('xs', 'bold', colors.success)}>Pin set ✓ The driver gets directions to it.</Text>
          <Pressable onPress={() => openMap(value)} hitSlop={8}>
            <Text style={[type('xs', 'semibold', colors.brand), { textDecorationLine: 'underline' }]}>View on map</Text>
          </Pressable>
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <Text style={[type('xs', 'semibold', colors.textMuted), { textDecorationLine: 'underline' }]}>Remove</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={type('xs', 'regular', colors.textMuted)}>Optional: stand at the pickup spot and tap, so the driver comes to the exact gate.</Text>
      )}
      {error ? <Text style={type('xs', 'medium', colors.danger)}>{error}</Text> : null}
    </View>
  );
}

/** Radio list of stops: name + address, the selected one highlighted. */
function StopPicker({
  label,
  icon,
  stops,
  value,
  onChange,
}: {
  label: string;
  icon: IonName;
  stops: Stop[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
        <Ionicons name={icon} size={16} color={icon === 'location' ? colors.accent : colors.brand} />
        <Text style={[type('xs', 'bold', colors.textMuted), { letterSpacing: 0.4 }]} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        {stops.map((stop) => {
          const on = stop.id === value;
          return (
            <Pressable
              key={stop.id}
              onPress={() => {
                hapticSelect();
                onChange(stop.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [st.option, on && st.optionOn, pressed && { opacity: 0.85 }]}
            >
              <Radio on={on} />
              <View style={{ flex: 1 }}>
                <Text style={type('sm', on ? 'bold' : 'semibold')} numberOfLines={1}>
                  {stop.name}
                </Text>
                {stop.address ? (
                  <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={2}>
                    {stop.address}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function RentalPassenger() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const req = useRentalRequest();
  const { data, error, reload } = useQuote(req);
  const quote = data?.results.find((q) => q.vehicle.id === vehicleId);

  if (!data) return <Placeholder error={error} rental onRetry={reload} />;
  if (!quote) return <Placeholder error="This vehicle is no longer offered for this trip." rental />;
  const hasDrop = req.rentalType === 'ONE_WAY' || req.rentalType === 'ROUND_TRIP';

  return (
    <PassengerForm
      steps={RENTAL_STEPS}
      amounts={quote}
      fareLabel={`Fare (${quote.billableKm} km)`}
      maxPassengers={quote.vehicle.seats}
      askDropAddress={hasDrop}
      summary={
        <>
          <Journey from={req.pickupCity} to={req.dropCity ?? RENTAL_TYPE[req.rentalType]} middle={RENTAL_TYPE[req.rentalType]} />
          <View style={st.summaryFoot}>
            <VehicleArt type={quote.vehicle.type} width={64} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={type('sm', 'bold')} numberOfLines={1}>
                {quote.vehicle.name}
              </Text>
              <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
                {VEHICLE_TYPE[quote.vehicle.type]} · up to {quote.vehicle.seats} passengers
              </Text>
            </View>
          </View>
          <View style={{ gap: 6, marginTop: spacing.md }}>
            <Detail icon="time-outline" label="Pickup" text={fmtDateTime(req.startAt)} />
            {req.returnAt ? <Detail icon="return-down-back-outline" label="Return" text={fmtDateTime(req.returnAt)} /> : null}
            <Detail icon="speedometer-outline" label="Distance" text={`${quote.billableKm} km billable`} />
          </View>
        </>
      }
      body={(v) => ({
        kind: 'RENTAL',
        vehicleId,
        ...req,
        pickupAddress: v.pickupAddress.trim(),
        ...(v.pickupPin ? { pickupLat: v.pickupPin.lat, pickupLng: v.pickupPin.lng } : {}),
        ...(hasDrop && v.dropAddress.trim() ? { dropAddress: v.dropAddress.trim() } : {}),
        passengers: v.passengers,
        passengerName: v.passengerName,
        passengerPhone: v.passengerPhone,
        payment: v.payment,
      })}
    />
  );
}

function Detail({ icon, label, text }: { icon: IonName; label: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={[type('xs', 'medium', colors.textMuted), { width: 64 }]}>{label}</Text>
      <Text style={[type('sm', 'semibold'), tabular, { flex: 1 }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function Section({ icon, title, children, right }: { icon: IonName; title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={st.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <Ionicons name={icon} size={20} color={colors.brand} />
        <Text style={[type('md', 'bold'), { flex: 1 }]}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

/** "Free cancellation up to 24h before departure", from the server's refund slabs. */
function cancellationNote(config: Config | null, rental: boolean) {
  if (!config) return null;
  const when = rental ? 'pickup' : 'departure';
  const slabs = [...config.cancellationSlabs].filter((sl) => sl.refundPercent > 0).sort((a, b) => a.minHoursBefore - b.minHoursBefore);
  const full = slabs.find((sl) => sl.refundPercent >= 100);
  if (full) return `Free cancellation up to ${full.minHoursBefore}h before ${when}`;
  const best = slabs.sort((a, b) => b.refundPercent - a.refundPercent)[0];
  return best ? `${best.refundPercent}% refund up to ${best.minHoursBefore}h before ${when}` : 'Non-refundable once confirmed';
}

function PassengerForm({
  steps,
  summary,
  amounts,
  fareLabel = 'Fare',
  maxPassengers,
  askDropAddress,
  extraFields,
  travellers,
  advance = 0,
  body,
}: {
  steps: string[];
  summary: ReactNode;
  amounts: Amounts;
  fareLabel?: string;
  maxPassengers?: number; // set for rentals
  askDropAddress?: boolean;
  extraFields?: ReactNode;
  /** Shared seats: a traveller per seat. */
  travellers?: ReactNode;
  /** Online advance for the whole booking (rest is cash); 0 = not offered. */
  advance?: number;
  body: (v: FormValues) => object;
}) {
  const { user } = useAuth();
  const isRental = maxPassengers !== undefined;
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [passengers, setPassengers] = useState('1');
  const [address, setAddress] = useState('');
  const [dropAddress, setDropAddress] = useState('');
  const [pickupPin, setPickupPin] = useState<LatLng | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [payment, setPayment] = useState<PaymentChoice>('ONLINE');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fareOpen, setFareOpen] = useState(false);
  const payAfterLogin = useRef(false);

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch(() => {});
  }, []);
  // Until the config arrives (or if it can't load) offer cash only: online payment is the exception, and the
  // server re-checks the choice anyway. Defaulting to online left people stuck on "online payment not available".
  const allowCash = config ? !!config.allowCash : true;
  const allowOnline = config ? config.onlinePayments !== false : false;
  const allowAdvance = allowOnline && advance > 0;
  const mode: PaymentChoice = payment === 'ADVANCE' && allowAdvance ? 'ADVANCE' : !allowOnline ? 'CASH' : allowCash ? (payment === 'ADVANCE' ? 'ONLINE' : payment) : 'ONLINE';

  const pay = async (fallbackName = '', fallbackPhone = '') => {
    setError(null);
    if (!user) {
      // Log in first; the effect below continues the booking once the user is back.
      payAfterLogin.current = true;
      router.push('/login');
      return;
    }
    const v: FormValues = {
      passengerName: (name || fallbackName).trim(),
      passengerPhone: (phone || fallbackPhone).replace(/\D/g, '').slice(-10),
      passengers: Number(passengers) || 0,
      pickupAddress: address,
      dropAddress,
      pickupPin,
      payment: mode,
    };
    if (v.passengerName.length < 2) return setError('Please enter the passenger name.');
    if (!/^[6-9]\d{9}$/.test(v.passengerPhone)) return setError('Please enter a valid 10-digit mobile number.');
    if (isRental) {
      if (v.passengers < 1 || v.passengers > maxPassengers) return setError(`Passengers must be between 1 and ${maxPassengers}.`);
      if (v.pickupAddress.trim().length < 5) return setError('Please enter the full pickup address.');
    }
    setBusy(true);
    try {
      const r = await api<CreateBookingResponse>('/api/bookings', { body: body(v) });
      // Cash bookings come back CONFIRMED with no payment link.
      if (r.payUrl) await openPayment(r.payUrl);
      router.replace({ pathname: '/booking/[id]', params: { id: r.booking.id, fresh: '1' } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        Alert.alert('Not available', e.message, [{ text: 'OK', onPress: () => router.back() }]);
      } else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Once the user logs in (sent there by "Pay"), prefill their details and continue.
  useEffect(() => {
    if (!user) return;
    if (!name) setName(user.name);
    if (!phone) setPhone(user.phone);
    if (payAfterLogin.current) {
      payAfterLogin.current = false;
      pay(user.name, user.phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toll = amounts.toll ?? 0;
  const parking = amounts.parking ?? 0;
  const cta = mode === 'CASH' ? 'Confirm booking' : mode === 'ADVANCE' ? `Pay ${inr(advance)} advance` : `Pay ${inr(amounts.totalAmount)}`;
  const cancelNote = cancellationNote(config, isRental);
  const toggleFare = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFareOpen((o) => !o);
  };

  return (
    <Screen>
      <Header title="Review & pay" subtitle={isRental ? 'Full cab booking' : 'Shared seat booking'} />
      <StepIndicator steps={steps} current={1} style={{ borderBottomWidth: 1, borderBottomColor: colors.border }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
          <View style={st.card}>{summary}</View>

          {extraFields ? (
            <Section icon="location-outline" title="Pickup & drop">
              {extraFields}
            </Section>
          ) : null}

          <Section icon="person-circle-outline" title="Traveller details">
            <Input label="Full name" icon="person-outline" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" placeholder="Name as on ID" />
            <Input
              label="Mobile number"
              icon="call-outline"
              prefix="+91"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={13}
              placeholder="10-digit mobile number"
              containerStyle={!isRental ? { marginBottom: spacing.xs } : undefined}
            />
            {!isRental ? (
              <Text style={type('xs', 'regular', colors.textMuted)}>Your ticket and driver details are sent to this number.</Text>
            ) : null}
            {isRental ? (
              <>
                <Input
                  label={`Number of passengers (max ${maxPassengers})`}
                  icon="people-outline"
                  value={passengers}
                  onChangeText={(t) => setPassengers(t.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Input
                  label="Pickup address"
                  icon="home-outline"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="House / building, street, area, landmark"
                  multiline
                  style={{ minHeight: 72, textAlignVertical: 'top' }}
                />
                <PickupPinButton value={pickupPin} onChange={setPickupPin} />
                {askDropAddress ? (
                  <Input
                    label="Drop address (optional)"
                    icon="flag-outline"
                    value={dropAddress}
                    onChangeText={setDropAddress}
                    placeholder="Where should we drop you?"
                    multiline
                    style={{ minHeight: 60, textAlignVertical: 'top' }}
                    containerStyle={{ marginBottom: 0 }}
                  />
                ) : null}
              </>
            ) : null}
          </Section>

          {travellers ? (
            <Section icon="people-outline" title="Who is travelling">
              {travellers}
            </Section>
          ) : null}

          <Section icon="wallet-outline" title="Payment method">
            <View style={{ gap: spacing.sm }}>
              {allowOnline ? (
              <PayOption
                on={mode === 'ONLINE'}
                icon="phone-portrait-outline"
                title="Pay online"
                subtitle="UPI, debit / credit card or net banking. Confirmed instantly after payment."
                onPress={() => setPayment('ONLINE')}
              />
              ) : null}
              {allowAdvance ? (
                <PayOption
                  on={mode === 'ADVANCE'}
                  icon="shield-checkmark-outline"
                  title={`Pay ${inr(advance)} advance, rest in cash`}
                  subtitle={`Seat confirmed after the advance. Pay the remaining ${inr(amounts.totalAmount - advance)} to the driver when you board.`}
                  onPress={() => setPayment('ADVANCE')}
                />
              ) : null}
              {allowCash ? (
                <PayOption
                  on={mode === 'CASH'}
                  icon="cash-outline"
                  title="Pay at boarding — cash or UPI"
                  subtitle={`Booking confirmed now. Pay ${config?.upiId ? 'in cash or by UPI' : 'in cash'} when you ${isRental ? 'start the trip' : 'board'}.`}
                  onPress={() => setPayment('CASH')}
                />
              ) : null}
            </View>
          </Section>

          <View style={st.card}>
            <Pressable onPress={toggleFare} style={st.fareHead} accessibilityRole="button" accessibilityState={{ expanded: fareOpen }}>
              <Ionicons name="receipt-outline" size={20} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={type('md', 'bold')}>Fare summary</Text>
                <Text style={type('xs', 'regular', colors.textMuted)}>{fareOpen ? 'Hide details' : 'Incl. GST · tap for details'}</Text>
              </View>
              <Text style={[type('lg', 'extrabold'), tabular]}>{inr(amounts.totalAmount)}</Text>
              <Ionicons name={fareOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
            </Pressable>
            {fareOpen ? (
              <View style={st.fareBody}>
                <Row label={fareLabel} value={inr(amounts.baseAmount)} />
                <Row label="GST" value={inr(amounts.taxAmount)} />
                {toll > 0 ? <Row label="Toll" value={inr(toll)} /> : null}
                {parking > 0 ? <Row label="Parking" value={inr(parking)} /> : null}
                <View style={st.dash} />
                <Row label="Total payable" value={inr(amounts.totalAmount)} bold />
              </View>
            ) : null}
          </View>

          <View style={st.trust}>
            {mode === 'CASH' ? (
              <TrustBit icon="cash-outline" text={`Keep ${inr(amounts.totalAmount)} in cash ready for the driver`} />
            ) : (
              <TrustBit
                icon="lock-closed"
                text={`Secure payment · ${isRental ? 'vehicle' : 'seats'} held${config ? ` for ${config.holdMinutes} min` : ''} while you pay`}
              />
            )}
            {cancelNote ? <TrustBit icon="refresh-circle" text={cancelNote} /> : null}
          </View>
        </ScrollView>
        {error ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            <Notice>{error}</Notice>
          </View>
        ) : null}
        <BottomBar caption="Total payable" amount={amounts.totalAmount} note={mode === 'CASH' ? 'Pay cash to driver' : 'incl. GST'}>
          <Button title={user ? cta : mode === 'CASH' ? 'Log in & book' : 'Log in & pay'} onPress={() => pay()} loading={busy} />
        </BottomBar>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function TrustBit({ icon, text }: { icon: IonName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Ionicons name={icon} size={16} color={colors.success} />
      <Text style={[type('xs', 'semibold', colors.text), { flex: 1 }]} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

function PayOption({ on, icon, title, subtitle, onPress }: { on: boolean; icon: IonName; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      style={({ pressed }) => [st.option, on && st.optionOn, pressed && { opacity: 0.85 }]}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
    >
      <View style={[st.payIcon, on && { backgroundColor: colors.brand }]}>
        <Ionicons name={icon} size={20} color={on ? colors.white : colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type('sm', 'bold')}>{title}</Text>
        <Text style={[type('xs', 'regular', colors.textMuted), { marginTop: 1 }]}>{subtitle}</Text>
      </View>
      <Radio on={on} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, ...shadowSoft },
  summaryFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  seatPill: { alignItems: 'center', backgroundColor: colors.brandLight, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: 4 },
  note: { flexDirection: 'row', gap: 6, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm },
  jLine: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: 3 },
  jDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: colors.card },
  jDash: { flex: 1, height: 0, borderTopWidth: 1.5, borderColor: colors.textSubtle, borderStyle: 'dashed' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    minHeight: 56,
    backgroundColor: colors.card,
  },
  optionOn: { borderColor: colors.brand, backgroundColor: '#F3F6FD' },
  payIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.textSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  radioDot: { width: 11, height: 11, borderRadius: radius.pill, backgroundColor: colors.brand },
  fareHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  fareBody: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  dash: { height: 0, borderTopWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginVertical: spacing.sm },
  trust: { gap: spacing.sm, backgroundColor: '#EEFBF2', borderRadius: 12, borderWidth: 1, borderColor: '#CDEFD8', padding: spacing.md },
});
