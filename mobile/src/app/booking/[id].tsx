import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { api, ApiError, Booking, Config, errorMessage, getConfig, TripDetail } from '../../api';
import { useAuth } from '../../auth';
import { cacheBooking, cachedBooking } from '../../cache';
import { checkBookingUpdates, syncTripReminders } from '../../notifications';
import { supportPhone } from '../../brand';
import { fmtDate, fmtDateTime, fmtDuration, fmtTime, inr, RENTAL_TYPE, VEHICLE_TYPE } from '../../format';
import { VehicleArt } from '../../illustrations';
import { openPage, openPayment, openPlayStore, reachableUrl } from '../../store';
import { API_URL } from '../../api';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../../theme';
import { Button, EmptyState, ErrorBanner, hapticTap, Header, Input, IonName, isOnTrip, Notice, Row, Screen, Skeleton, statusInfo, Tone } from '../../ui';

const PAYMENT_LABEL = { UNPAID: 'Unpaid', PAID: 'Paid', PARTIAL: 'Advance paid', REFUND_PENDING: 'Refund pending', REFUNDED: 'Refunded' };
const MODE_LABEL = { RAZORPAY: 'Online', DEMO: 'Online (demo)', CASH: 'Cash to driver', ADVANCE: 'Advance online + cash' };
const PINK = '#DB2777';

/** Status banner gradients for the ticket. */
const BANNER: Record<Tone, readonly [string, string]> = {
  success: ['#16A34A', '#128A3E'],
  warning: ['#E08A0B', '#C2700A'],
  danger: ['#DC2626', '#B91C1C'],
  brand: ['#1E4FD8', '#173FAE'],
  neutral: ['#64748B', '#475569'],
};

const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {});
const whatsApp = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  const intl = d.length === 10 ? `91${d}` : d;
  Linking.openURL(`whatsapp://send?phone=${intl}`).catch(() => Linking.openURL(`https://wa.me/${intl}`).catch(() => {}));
};
/** Google Maps directions: exact coordinates of the pickup point if the office saved them, else its name / the address. */
const directions = (b: Booking) => {
  const s = b.pickupStop;
  const dest = s?.lat != null && s?.lng != null ? `${s.lat},${s.lng}` : s ? [s.name, s.address, s.city].filter(Boolean).join(', ') : b.pickupAddress;
  if (dest) Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`).catch(() => {});
};
const POLL_MS = 30_000;

export default function BookingDetail() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const { user, ready } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const fresh = (await api<{ booking: Booking }>(`/api/bookings/${id}`)).booking;
      setBooking(fresh);
      setOffline(false);
      cacheBooking(fresh);
    } catch (e) {
      // No internet at the pickup point: the saved copy still has the QR and OTP.
      const saved = e instanceof ApiError && e.status === 0 ? await cachedBooking(id) : null;
      if (saved) {
        setOffline(true);
        setBooking((b) => b ?? saved);
        return;
      }
      setError(errorMessage(e));
    }
  }, [id]);

  // Load on focus, then keep the ticket live (driver assigned, trip started...) every 30 s while it's open.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      load();
      const t = setInterval(load, POLL_MS);
      return () => clearInterval(t);
    }, [user, load]),
  );
  // Show the saved copy straight away (slow network at the pickup point), then the fresh one replaces it.
  useEffect(() => {
    cachedBooking(id).then((saved) => saved && setBooking((cur) => cur ?? saved));
  }, [id]);
  useEffect(() => {
    if (!booking) return;
    cacheBooking(booking); // also after a cancel / change made on this screen
    checkBookingUpdates([booking], true);
    syncTripReminders([booking], true);
  }, [booking]);
  useEffect(() => {
    getConfig().then(setConfig).catch(() => {});
  }, []);

  // Tick every second while a payment hold is running, to show the countdown.
  const holdMs = booking?.status === 'PENDING' && booking.holdExpiresAt ? new Date(booking.holdExpiresAt).getTime() - now : 0;
  useEffect(() => {
    if (booking?.status !== 'PENDING') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [booking?.status]);

  if (ready && !user)
    return (
      <Screen>
        <Header title="Booking" />
        <EmptyState
          art="login"
          title="Please log in"
          text="Log in to see this booking and your e-ticket."
          action={<Button title="Log in" onPress={() => router.push('/login')} />}
        />
      </Screen>
    );
  if (!booking)
    return (
      <Screen>
        <Header title="Booking" />
        {error ? (
          <View style={{ padding: spacing.lg }}>
            <ErrorBanner message={error} onRetry={load} />
          </View>
        ) : (
          <TicketSkeleton />
        )}
      </Screen>
    );

  const b = booking;
  const onTrip = isOnTrip(b);
  // Cash still to give the driver: everything for a cash booking, the balance after an online advance.
  const cashLeft = b.status === 'CONFIRMED' ? (b.cashDue ?? (b.paymentMode === 'CASH' && b.paymentStatus === 'UNPAID' ? b.totalAmount : 0)) : 0;
  const cashDue = cashLeft > 0;
  const trackUrl = b.trackUrl ? reachableUrl(b.trackUrl) : null;
  const status = statusInfo(b.status, b.tripStatus);

  const retryPayment = async () => {
    setBusy(true);
    try {
      // Ask for a fresh link so this also works after an app restart.
      const link = await api<{ payUrl: string }>(`/api/bookings/${b.id}/pay-link`, { method: 'POST' });
      await openPayment(link.payUrl);
    } catch (e) {
      Alert.alert('Payment', errorMessage(e));
    }
    await load();
    setBusy(false);
  };

  const cancel = () => {
    let msg = `Booking ${b.code} will be cancelled.`;
    if ((b.paymentStatus === 'PAID' || b.paymentStatus === 'PARTIAL') && b.cancellation) {
      msg +=
        b.cancellation.charge > 0
          ? `\n\nCancellation charge ${inr(b.cancellation.charge)}, refund ${inr(b.cancellation.refundAmount)}.`
          : `\n\nFull refund of ${inr(b.cancellation.refundAmount)}.`;
      if (b.cancellation.refundAmount > 0) msg += ' The refund goes back to your original payment method.';
    }
    Alert.alert('Cancel booking?', msg, [
      { text: 'Keep booking', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            setBooking((await api<{ booking: Booking }>(`/api/bookings/${b.id}/cancel`, { method: 'POST' })).booking);
          } catch (e) {
            Alert.alert('Could not cancel', errorMessage(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const shareTrip = () => {
    if (!trackUrl) return;
    const what = b.trip ? `${b.trip.fromCity} → ${b.trip.toCity}` : b.dropCity ? `${b.pickupCity} → ${b.dropCity}` : (b.pickupCity ?? 'my trip');
    Share.share({ message: `Follow my Jai Shree Shyam Travels trip ${what} (booking ${b.code}) live: ${trackUrl}` }).catch(() => {});
  };

  const mins = Math.max(0, Math.floor(holdMs / 60000));
  const secs = Math.max(0, Math.floor((holdMs % 60000) / 1000));
  const showPass = (b.qrData || b.boardingOtp) && b.status === 'CONFIRMED';

  // Route + times for the ticket.
  const fromName = b.trip?.fromCity ?? b.pickupCity ?? '';
  const toName = b.trip?.toCity ?? b.dropCity ?? (b.rentalType ? RENTAL_TYPE[b.rentalType] : 'Vehicle hire');
  const startIso = b.trip?.departAt ?? b.startAt;
  const endIso = b.trip?.arriveAt ?? b.endAt;
  const durationMins = b.kind === 'SEAT' && startIso && endIso ? Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000) : 0;

  const actions: { key: string; icon: IonName; label: string; onPress: () => void; danger?: boolean }[] = [];
  const goingSoon = b.status === 'CONFIRMED' && b.tripStatus === 'SCHEDULED' && !!(b.pickupStop || b.pickupAddress);
  if (goingSoon) actions.push({ key: 'dir', icon: 'map-outline', label: 'Directions', onPress: () => directions(b) });
  if (trackUrl) actions.push({ key: 'track', icon: 'navigate-outline', label: 'Track', onPress: () => openPage(trackUrl) });
  if (trackUrl) actions.push({ key: 'share', icon: 'share-social-outline', label: 'Share', onPress: shareTrip });
  if (b.invoiceUrl) actions.push({ key: 'invoice', icon: 'document-text-outline', label: 'Invoice', onPress: () => openPage(b.invoiceUrl!) });
  actions.push({ key: 'help', icon: 'headset-outline', label: 'Support', onPress: () => call(supportPhone(config?.supportPhone)) });
  if (onTrip) actions.push({ key: 'sos', icon: 'alert-circle', label: 'SOS 112', onPress: () => call('112'), danger: true });

  return (
    <Screen>
      <Header title={b.kind === 'SEAT' ? 'Your e-ticket' : 'Your cab booking'} subtitle={`${fromName} → ${toName}`} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[colors.brand]}
            tintColor={colors.brand}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {offline ? (
          <Notice tone="info" icon="cloud-offline-outline">
            No internet — this is your saved ticket. The QR code and OTP still work.
          </Notice>
        ) : null}

        {b.canRate || b.rating ? <RateTrip booking={b} onRated={setBooking} /> : null}

        {b.runningLate ? (
          <Notice tone="warning" icon="time-outline">
            The vehicle is running a little late. The driver will call you — or tap Support to ask the office.
          </Notice>
        ) : null}
        {b.etaMinutes != null ? (
          <View style={[st.card, st.eta]}>
            <Ionicons name="car-sport" size={22} color={colors.white} />
            <View style={{ flex: 1 }}>
              <Text style={type('md', 'bold', colors.white)}>Vehicle is about {b.etaMinutes} min away</Text>
              <Text style={type('xs', 'medium', 'rgba(255,255,255,0.85)')}>
                {b.vehicleKm} km from {b.pickupStop?.name ?? 'your pickup point'} · please be ready
              </Text>
            </View>
          </View>
        ) : null}

        {b.status === 'CONFIRMED' && fresh ? (
          <View style={st.fresh}>
            <View style={st.freshIcon}>
              <Ionicons name="checkmark" size={24} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type('md', 'bold', colors.success)}>Booking confirmed</Text>
              <Text style={type('sm', 'regular', colors.text)}>
                {cashDue ? `Please pay ${inr(cashLeft)} in cash to the driver. ` : ''}Have a great journey.
              </Text>
            </View>
          </View>
        ) : null}

        {b.status === 'PENDING' ? (
          <View style={[st.card, { borderWidth: 1.5, borderColor: '#F5C46B' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
              <View style={[st.roundIcon, { backgroundColor: colors.warningLight }]}>
                <Ionicons name="time-outline" size={22} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type('md', 'bold', colors.warning)}>Payment pending</Text>
                <Text style={type('xs', 'medium', colors.textMuted)}>{holdMs > 0 ? 'Complete payment to confirm' : 'Hold released'}</Text>
              </View>
              {holdMs > 0 ? (
                <Text style={[type('xl', 'extrabold', colors.warning), tabular]}>
                  {mins}:{String(secs).padStart(2, '0')}
                </Text>
              ) : null}
            </View>
            {holdMs > 0 ? (
              <>
                <Text style={type('sm', 'regular', colors.textMuted)}>
                  We are holding your {b.kind === 'SEAT' ? 'seats' : 'vehicle'} for {mins}:{String(secs).padStart(2, '0')} more. Complete the payment to confirm.
                </Text>
                <Button title={b.paymentMode === 'ADVANCE' ? 'Pay advance' : `Pay ${inr(b.totalAmount)}`} icon="card-outline" onPress={retryPayment} loading={busy} style={{ marginTop: spacing.md }} />
                <Button title="I've paid, check status" variant="ghost" onPress={load} style={{ marginTop: spacing.xs }} />
              </>
            ) : (
              <>
                <Text style={type('sm', 'regular', colors.textMuted)}>The payment window has ended and the hold was released. Please search and book again.</Text>
                <Button title="Check status" variant="outline" icon="refresh" onPress={load} style={{ marginTop: spacing.md }} />
              </>
            )}
          </View>
        ) : null}

        {b.status === 'CONFIRMED' || b.status === 'COMPLETED' ? <DriverHero booking={b} /> : null}

        {/* ---------------- Ticket ---------------- */}
        <View style={st.ticket}>
          <LinearGradient colors={BANNER[status.tone]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.banner}>
            <Ionicons name={status.icon} size={20} color={colors.white} />
            <Text style={[type('md', 'bold', colors.white), { flex: 1 }]} numberOfLines={1}>
              {status.label}
            </Text>
            <View style={st.pnr}>
              <Text style={[type('xs', 'medium', 'rgba(255,255,255,0.8)'), { lineHeight: 15 }]}>PNR</Text>
              <Text style={[type('sm', 'extrabold', colors.white), { letterSpacing: 0.8 }]}>{b.code}</Text>
            </View>
          </LinearGradient>

          <View style={{ padding: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={type('xs', 'semibold', colors.textMuted)}>FROM</Text>
                <Text style={type('lg', 'extrabold')} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {fromName}
                </Text>
                {startIso ? <Text style={[type('xl', 'extrabold', colors.brand), tabular]}>{fmtTime(startIso)}</Text> : null}
              </View>
              <View style={{ alignItems: 'center', paddingTop: 2 }}>
                <VehicleArt type={b.vehicle?.type} width={76} />
                {durationMins > 0 ? <Text style={[type('xs', 'semibold', colors.textMuted), tabular]}>{fmtDuration(durationMins)}</Text> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
                <Text style={type('xs', 'semibold', colors.textMuted)}>TO</Text>
                <Text style={[type('lg', 'extrabold'), { textAlign: 'right' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {toName}
                </Text>
                {endIso && b.kind === 'SEAT' ? <Text style={[type('xl', 'extrabold', colors.brand), tabular]}>{fmtTime(endIso)}</Text> : null}
              </View>
            </View>
            <View style={st.dateRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={type('sm', 'semibold')} numberOfLines={1}>
                {startIso ? fmtDate(startIso) : '—'}
              </Text>
              {b.kind === 'RENTAL' && b.rentalType ? (
                <Text style={type('xs', 'medium', colors.textMuted)} numberOfLines={1}>
                  · {RENTAL_TYPE[b.rentalType]}
                </Text>
              ) : null}
            </View>
          </View>

          <Perforation />

          {showPass ? (
            <View style={{ alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
              <Text style={type('sm', 'bold')}>{b.kind === 'SEAT' ? 'Boarding pass' : 'Trip start OTP'}</Text>
              {b.qrData ? (
                <View style={st.qr}>
                  <QRCode value={b.qrData} size={184} color={colors.text} />
                </View>
              ) : null}
              {b.boardingOtp ? <OtpDigits label={b.qrData ? 'or tell the driver this OTP' : 'OTP'} value={b.boardingOtp} /> : null}
              <Text style={[type('xs', 'regular', colors.textMuted), { textAlign: 'center', marginTop: spacing.md }]}>
                {b.kind === 'SEAT' ? 'Show this QR to the driver when you board' : 'Give this OTP to the driver when the trip starts'}
              </Text>
            </View>
          ) : null}

          {b.endOtp ? (
            <>
              <Perforation />
              <View style={{ alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
                <Text style={type('sm', 'bold')}>Trip end OTP</Text>
                <OtpDigits value={b.endOtp} />
                <Text style={[type('xs', 'regular', colors.textMuted), { textAlign: 'center', marginTop: spacing.sm }]}>
                  Give this to the driver only when you reach your destination
                </Text>
              </View>
            </>
          ) : null}

          {showPass || b.endOtp ? <Perforation /> : null}

          <View style={st.grid}>
            <GridCell label="Passenger" value={b.passengerName} />
            {b.kind === 'SEAT' ? (
              <GridCell label={b.seatNos.length > 1 ? 'Seats' : 'Seat'} value={b.seatNos.join(', ')} align="right" />
            ) : (
              <GridCell label="Passengers" value={String(b.passengers)} align="right" />
            )}
            <GridCell label="Vehicle" value={b.vehicle ? b.vehicle.name : 'To be assigned'} sub={b.vehicleNumber ?? (b.vehicle ? VEHICLE_TYPE[b.vehicle.type] : undefined)} />
            <GridCell
              label="Amount"
              value={inr(b.totalAmount)}
              sub={cashDue ? `${inr(cashLeft)} cash to driver` : PAYMENT_LABEL[b.paymentStatus]}
              subColor={cashDue ? colors.warning : b.paymentStatus === 'PAID' || b.paymentStatus === 'REFUNDED' ? colors.success : colors.textMuted}
              align="right"
            />
          </View>
        </View>

        {actions.length ? (
          <View style={st.actions}>
            {actions.map((a) => (
              <Pressable
                key={a.key}
                onPress={() => {
                  hapticTap();
                  a.onPress();
                }}
                style={({ pressed }) => [st.action, actions.length <= 2 && st.actionWide, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <View style={[st.actionIcon, a.danger && { backgroundColor: colors.danger }]}>
                  <Ionicons name={a.icon} size={20} color={a.danger ? colors.white : colors.brand} />
                </View>
                <Text style={type('xs', 'semibold', a.danger ? colors.danger : colors.text)} numberOfLines={1}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {b.pickupStop && b.status === 'CONFIRMED' && b.tripStatus !== 'COMPLETED' ? <PickupCard booking={b} /> : null}

        <ManageBooking booking={b} onChanged={setBooking} />

        <View style={st.card}>
          <Text style={[type('md', 'bold'), { marginBottom: spacing.sm }]}>Journey details</Text>
          {b.kind === 'SEAT' && b.trip ? (
            <>
              <Row label="Date" value={fmtDate(b.trip.departAt)} />
              <Row label="Departure" value={fmtTime(b.trip.departAt)} />
              <Row label="Arrival" value={fmtTime(b.trip.arriveAt)} />
              {b.pickupStop ? <Row label="Pickup" value={b.pickupStop.name} /> : null}
              {b.dropStop ? <Row label="Drop" value={b.dropStop.name} /> : null}
            </>
          ) : (
            <>
              <Row label="Trip type" value={b.rentalType ? RENTAL_TYPE[b.rentalType] : 'Vehicle hire'} />
              {b.startAt ? <Row label="Pickup" value={fmtDateTime(b.startAt)} /> : null}
              {b.endAt ? <Row label="Vehicle busy until" value={fmtDateTime(b.endAt)} /> : null}
              {b.pickupAddress ? <Row label="Pickup address" value={b.pickupAddress} /> : null}
              {b.dropAddress ? <Row label="Drop address" value={b.dropAddress} /> : null}
              {b.estimatedKm ? <Row label="Billable distance" value={`${b.estimatedKm} km`} /> : null}
            </>
          )}
          <Row label="Mobile" value={`+91 ${b.passengerPhone}`} />
          {(b.seatPassengers ?? []).filter((p) => p.name || p.female).map((p) => (
            <Row key={p.seatNo} label={`Seat ${p.seatNo}`} value={`${p.name || 'Traveller'}${p.female ? ' (woman)' : ''}${p.phone ? ` · +91 ${p.phone}` : ''}`} />
          ))}
          {b.kind === 'SEAT' && b.trip?.boardingPoint ? (
            <Notice tone="info" style={{ marginTop: spacing.sm }}>
              {b.trip.boardingPoint}
            </Notice>
          ) : null}
        </View>

        <View style={st.card}>
          <Text style={[type('md', 'bold'), { marginBottom: spacing.sm }]}>Fare breakdown</Text>
          <Row label="Fare" value={inr(b.baseAmount)} />
          <Row label="GST" value={inr(b.taxAmount)} />
          {b.extraCharges > 0 ? <Row label="Toll & parking" value={inr(b.extraCharges)} /> : null}
          <View style={st.dash} />
          <Row label="Total" value={inr(b.totalAmount)} bold />
          <View style={st.line} />
          <Row
            label="Payment"
            value={PAYMENT_LABEL[b.paymentStatus]}
            valueColor={b.paymentStatus === 'PAID' || b.paymentStatus === 'REFUNDED' ? colors.success : b.paymentStatus === 'UNPAID' ? colors.warning : colors.text}
          />
          {b.paymentMode ? <Row label="Mode" value={MODE_LABEL[b.paymentMode]} /> : null}
          {b.amountPaid && b.paymentStatus === 'PARTIAL' ? <Row label="Advance paid" value={inr(b.amountPaid)} /> : null}
          {b.discountPercent ? <Row label="Return-trip discount" value={`${b.discountPercent}% off the fare`} valueColor={colors.success} /> : null}
          {b.invoiceNo ? <Row label="Invoice no." value={b.invoiceNo} /> : null}
          <Row label="Booked on" value={fmtDateTime(b.createdAt)} />
          {cashDue ? (
            <>
              <Notice tone="warning" icon="cash-outline" style={{ marginTop: spacing.sm }}>
                {config?.upiId ? `Pay ${inr(cashLeft)} in cash or by UPI when you board` : `Pay ${inr(cashLeft)} in cash to the driver`}
              </Notice>
              {config?.upiId ? <PayByUpi booking={b} amount={cashLeft} upiId={config.upiId} upiName={config.upiName ?? ''} /> : null}
            </>
          ) : null}
        </View>

        {b.status === 'CANCELLED' ? (
          <View style={[st.card, { borderWidth: 1.5, borderColor: colors.dangerLight }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
              <Text style={type('md', 'bold', colors.danger)}>Cancelled</Text>
            </View>
            {b.cancelledAt ? <Row label="Cancelled on" value={fmtDateTime(b.cancelledAt)} /> : null}
            {b.cancellationCharge ? <Row label="Cancellation charge" value={inr(b.cancellationCharge)} /> : null}
            {b.refundAmount ? <Row label="Refund" value={inr(b.refundAmount)} bold /> : null}
            {b.paymentStatus === 'REFUND_PENDING' ? (
              <Text style={[type('sm', 'regular', colors.textMuted), { marginTop: spacing.sm }]}>
                Your refund{b.refundAmount ? ` of ${inr(b.refundAmount)}` : ''} is being processed. It usually reaches your original payment method in 5–7 working days.
              </Text>
            ) : b.paymentStatus === 'REFUNDED' ? (
              <Text style={[type('sm', 'regular', colors.textMuted), { marginTop: spacing.sm }]}>Refund completed to your original payment method.</Text>
            ) : null}
          </View>
        ) : null}

        <ErrorBanner message={error} onRetry={load} />
        {b.canCancel ? (
          <View style={{ gap: 6 }}>
            <Button title="Cancel booking" variant="dangerOutline" icon="close-circle-outline" onPress={cancel} loading={busy} />
            {b.cancellation && b.paymentStatus === 'PAID' ? (
              <Text style={[type('xs', 'regular', colors.textMuted), { textAlign: 'center' }]}>
                {b.cancellation.refundPercent}% refund if you cancel now ({inr(b.cancellation.refundAmount)})
              </Text>
            ) : null}
          </View>
        ) : null}
        {fresh ? <Button title="Back to home" variant="secondary" icon="home-outline" onPress={() => router.dismissTo('/')} /> : null}
      </ScrollView>
    </Screen>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

/**
 * Ride-app style card at the top of the ticket: the vehicle number (known as soon as the booking is confirmed)
 * in a number-plate box, then the driver's photo, name, call and WhatsApp once the office assigns one.
 */
function DriverHero({ booking: b }: { booking: Booking }) {
  const d = b.driver;
  if (!d && !b.vehicleNumber) return null;
  return (
    <View style={[st.card, st.hero]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {d?.photoUrl ? (
          <Image source={{ uri: reachableUrl(d.photoUrl.startsWith('http') ? d.photoUrl : `${API_URL}${d.photoUrl}`) }} style={st.heroPhoto} />
        ) : (
          <View style={[st.heroPhoto, { backgroundColor: d ? colors.brand : colors.background, alignItems: 'center', justifyContent: 'center' }]}>
            {d ? <Text style={type('xl', 'extrabold', colors.white)}>{initials(d.name)}</Text> : <Ionicons name="person-outline" size={28} color={colors.textMuted} />}
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type('xs', 'semibold', colors.textMuted)}>{d ? 'YOUR DRIVER' : 'DRIVER'}</Text>
          <Text style={type('lg', 'extrabold', d ? colors.text : colors.textMuted)} numberOfLines={1}>
            {d ? d.name : 'Being assigned'}
          </Text>
          {b.vehicle ? (
            <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
              {b.vehicle.name}
            </Text>
          ) : null}
          {/* Plate under the name (Uber/Ola style) so long names are never cut short. */}
          {b.vehicleNumber ? (
            <View style={[st.plate, { alignSelf: 'flex-start', marginTop: 6 }]} accessibilityLabel={`Vehicle number ${b.vehicleNumber}`}>
              <Text style={st.plateIn}>IND</Text>
              <Text style={st.plateText}>{b.vehicleNumber}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {d ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Pressable
            onPress={() => {
              hapticTap();
              call(d.phone);
            }}
            style={({ pressed }) => [st.heroBtn, { backgroundColor: colors.brand }, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={`Call driver ${d.phone}`}
          >
            <Ionicons name="call" size={18} color={colors.white} />
            <Text style={type('sm', 'bold', colors.white)}>Call driver</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              hapticTap();
              whatsApp(d.phone);
            }}
            style={({ pressed }) => [st.heroBtn, { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, pressed && { backgroundColor: colors.background }]}
            accessibilityRole="button"
            accessibilityLabel={`WhatsApp driver ${d.name}`}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#128C7E" />
            <Text style={type('sm', 'bold', colors.text)}>WhatsApp</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[type('xs', 'regular', colors.textMuted), { marginTop: spacing.sm }]}>
          Driver's name, photo and phone appear here as soon as the office assigns one — you also get a notification.
        </Text>
      )}
    </View>
  );
}

/**
 * Opens the passenger's UPI app (GPay, PhonePe, Paytm, BHIM...) with the office UPI ID, amount and booking code
 * filled in. The money goes straight to the office; the driver marks it "UPI received".
 */
function PayByUpi({ booking: b, amount, upiId, upiName }: { booking: Booking; amount: number; upiId: string; upiName: string }) {
  const pay = () => {
    const q = new URLSearchParams({ pa: upiId, pn: upiName, am: amount.toFixed(2), cu: 'INR', tn: `Booking ${b.code}` });
    Linking.openURL(`upi://pay?${q.toString()}`).catch(() =>
      Alert.alert('No UPI app found', `Pay ${inr(amount)} to UPI ID ${upiId} from any UPI app, with note "${b.code}".`),
    );
  };
  return (
    <View style={{ marginTop: spacing.sm, gap: 6 }}>
      <Button title={`Pay ${inr(amount)} by UPI`} icon="phone-portrait-outline" variant="outline" size="md" onPress={pay} />
      <Text style={[type('xs', 'regular', colors.textMuted), { textAlign: 'center' }]}>
        To {upiId} · show the payment success screen to the driver
      </Text>
    </View>
  );
}

/** Where to stand: photo of the spot, landmark, address, and directions. */
function PickupCard({ booking: b }: { booking: Booking }) {
  const s = b.pickupStop!;
  return (
    <View style={[st.card, { gap: spacing.sm }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="radio-button-on" size={18} color={colors.brand} />
        <Text style={[type('md', 'bold'), { flex: 1 }]} numberOfLines={1}>
          Pickup: {s.name}
        </Text>
      </View>
      {s.photoUrl ? <Image source={{ uri: reachableUrl(s.photoUrl.startsWith('http') ? s.photoUrl : `${API_URL}${s.photoUrl}`) }} style={st.stopPhoto} resizeMode="cover" accessibilityLabel={`Photo of ${s.name}`} /> : null}
      {s.landmark ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Ionicons name="flag-outline" size={16} color={colors.accent} />
          <Text style={[type('sm', 'semibold'), { flex: 1 }]}>{s.landmark}</Text>
        </View>
      ) : null}
      {s.address ? <Text style={type('xs', 'regular', colors.textMuted)}>{s.address}</Text> : null}
      <Button title="Get directions" icon="navigate-outline" variant="outline" size="md" onPress={() => directions(b)} />
    </View>
  );
}

/** Change date (once) / pickup, cancel some seats, book the return journey. */
function ManageBooking({ booking: b, onChanged }: { booking: Booking; onChanged: (b: Booking) => void }) {
  const [panel, setPanel] = useState<'pickup' | 'seats' | null>(null);
  const [stops, setStops] = useState<TripDetail['pickupStops'] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const trip = b.trip;
  const multiSeat = b.kind === 'SEAT' && b.seatNos.length > 1 && b.canCancel;
  const canReturn = b.kind === 'SEAT' && !!trip && (b.status === 'CONFIRMED' || b.status === 'COMPLETED');
  if (!b.canChangeDate && !b.canChangePickup && !multiSeat && !canReturn) return null;

  const openPickup = async () => {
    setPanel('pickup');
    if (!stops && trip) api<{ trip: TripDetail }>(`/api/trips/${trip.id}`).then((r) => setStops(r.trip.pickupStops), (e) => Alert.alert('Pickup points', errorMessage(e)));
  };
  const run = async (body: object, done: string) => {
    setBusy(true);
    try {
      const path = 'seatNos' in body && !('tripId' in body) ? 'cancel' : 'change';
      onChanged((await api<{ booking: Booking }>(`/api/bookings/${b.id}/${path}`, { body })).booking);
      setPanel(null);
      Alert.alert('Done', done);
    } catch (e) {
      Alert.alert('Could not update', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const arriveYmd = trip ? new Date(trip.arriveAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '';
  const departYmd = trip ? new Date(trip.departAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '';

  return (
    <View style={[st.card, { paddingVertical: spacing.sm }]}>
      <Text style={[type('md', 'bold'), { marginVertical: spacing.sm }]}>Manage booking</Text>
      {b.canChangeDate && trip ? (
        <ManageRow
          icon="calendar-outline"
          title="Change date (free, once)"
          sub={b.changeDeadline ? `Until ${fmtDateTime(b.changeDeadline)}` : undefined}
          onPress={() => router.push({ pathname: '/results', params: { from: trip.fromCity, to: trip.toCity, date: departYmd, changeFor: b.id, need: String(b.seatNos.length), exclude: trip.id } })}
        />
      ) : null}
      {b.canChangePickup ? <ManageRow icon="location-outline" title="Change pickup point" sub={b.pickupStop?.name} onPress={openPickup} /> : null}
      {panel === 'pickup' ? (
        <View style={st.panel}>
          {!stops ? <Skeleton height={44} /> : null}
          {(stops ?? []).map((s) => (
            <Pressable
              key={s.id}
              disabled={busy || s.id === b.pickupStop?.id}
              onPress={() => run({ pickupStopId: s.id }, `Pickup changed to ${s.name}.`)}
              style={({ pressed }) => [st.panelRow, s.id === b.pickupStop?.id && { backgroundColor: colors.brandLight }, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name={s.id === b.pickupStop?.id ? 'radio-button-on' : 'radio-button-off'} size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={type('sm', 'semibold')}>{s.name}</Text>
                {s.landmark || s.address ? <Text style={type('xs', 'regular', colors.textMuted)}>{s.landmark || s.address}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {multiSeat ? (
        <ManageRow
          icon="person-remove-outline"
          title="Cancel some seats"
          sub="One traveller's plan changed? Keep the rest."
          onPress={() => {
            setPicked([]);
            setPanel(panel === 'seats' ? null : 'seats');
          }}
        />
      ) : null}
      {panel === 'seats' ? (
        <View style={st.panel}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {b.seatNos.map((n) => {
              const on = picked.includes(n);
              const who = b.seatPassengers?.find((p) => p.seatNo === n)?.name;
              return (
                <Pressable key={n} onPress={() => setPicked((p) => (on ? p.filter((x) => x !== n) : [...p, n]))} style={[st.seatChip, on && st.seatChipOn]}>
                  <Text style={type('sm', 'bold', on ? colors.white : colors.text)}>
                    Seat {n}
                    {who ? ` · ${who}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {(b.paymentStatus === 'PAID' || b.paymentStatus === 'PARTIAL') && b.cancellation ? (
            <Text style={[type('xs', 'regular', colors.textMuted), { marginTop: spacing.sm }]}>{b.cancellation.refundPercent}% of those seats' fare is refunded.</Text>
          ) : null}
          <Button
            title={picked.length ? `Cancel seat ${picked.sort((x, y) => x - y).join(', ')}` : 'Choose seats to cancel'}
            variant="dangerOutline"
            size="md"
            disabled={!picked.length || picked.length >= b.seatNos.length}
            loading={busy}
            onPress={() =>
              Alert.alert('Cancel these seats?', `Seat ${picked.join(', ')} will be cancelled. The other seats stay booked.`, [
                { text: 'Keep', style: 'cancel' },
                { text: 'Cancel seats', style: 'destructive', onPress: () => run({ seatNos: picked }, `Seat ${picked.join(', ')} cancelled.`) },
              ])
            }
            style={{ marginTop: spacing.md }}
          />
          {picked.length >= b.seatNos.length ? <Text style={type('xs', 'regular', colors.textMuted)}>To cancel every seat, use “Cancel booking” below.</Text> : null}
        </View>
      ) : null}
      {canReturn && trip ? (
        <ManageRow
          icon="swap-horizontal-outline"
          title={`Book return: ${trip.toCity} → ${trip.fromCity}`}
          sub="Same seats picker, return-trip discount applied automatically"
          onPress={() => router.push({ pathname: '/results', params: { from: trip.toCity, to: trip.fromCity, date: arriveYmd } })}
        />
      ) : null}
    </View>
  );
}

function ManageRow({ icon, title, sub, onPress }: { icon: IonName; title: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.manageRow, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <View style={st.actionIcon}>
        <Ionicons name={icon} size={18} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type('sm', 'semibold')}>{title}</Text>
        {sub ? <Text style={type('xs', 'regular', colors.textMuted)}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

/** Stars after a completed trip (once). Shows the given rating afterwards. */
function RateTrip({ booking: b, onRated }: { booking: Booking; onRated: (b: Booking) => void }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const done = b.rating != null;

  const submit = async () => {
    setBusy(true);
    try {
      onRated((await api<{ booking: Booking }>(`/api/bookings/${b.id}/rate`, { body: { rating: stars, ...(comment.trim() ? { comment: comment.trim() } : {}) } })).booking);
      hapticTap();
      // Happy travellers are asked to rate the app on Google Play too.
      if (stars >= 4) {
        Alert.alert('Thank you!', 'Glad you enjoyed the trip. Would you rate our app on Google Play? It helps other travellers find us.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Rate on Play', onPress: () => openPlayStore().catch(() => {}) },
        ]);
      } else Alert.alert('Thank you!', 'Your rating helps us keep every trip safe and comfortable.');
    } catch (e) {
      Alert.alert('Could not send rating', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const shown = done ? b.rating! : stars;
  return (
    <View style={[st.card, { borderWidth: 1.5, borderColor: done ? colors.border : '#F5C46B' }]}>
      <Text style={type('md', 'bold')}>{done ? 'Your rating' : 'How was your trip?'}</Text>
      {!done && b.driver ? <Text style={type('sm', 'regular', colors.textMuted)}>Rate your journey with {b.driver.name}</Text> : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} disabled={done} onPress={() => setStars(n)} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} hitSlop={6}>
            <Ionicons name={n <= shown ? 'star' : 'star-outline'} size={36} color={n <= shown ? '#F59E0B' : colors.textSubtle} />
          </Pressable>
        ))}
      </View>
      {!done && stars > 0 ? (
        <>
          <Input placeholder={stars <= 3 ? 'What went wrong? (optional)' : 'Anything to tell us? (optional)'} value={comment} onChangeText={setComment} maxLength={500} multiline />
          <Button title="Send rating" icon="send" onPress={submit} loading={busy} />
        </>
      ) : null}
    </View>
  );
}

function GridCell({ label, value, sub, subColor, align }: { label: string; value: string; sub?: string; subColor?: string; align?: 'right' }) {
  const right = align === 'right';
  return (
    <View style={[st.cell, right && { alignItems: 'flex-end' }]}>
      <Text style={type('xs', 'semibold', colors.textMuted)}>{label.toUpperCase()}</Text>
      <Text style={[type('sm', 'bold'), tabular, right && { textAlign: 'right' }]} numberOfLines={1}>
        {value}
      </Text>
      {sub ? (
        <Text style={[type('xs', 'medium', subColor ?? colors.textMuted), right && { textAlign: 'right' }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** Dashed line with semicircle notches cut into both edges, like a torn ticket. */
function Perforation() {
  return (
    <View style={st.perf}>
      <View style={[st.notch, { left: -11 }]} />
      <View style={st.perfLine} />
      <View style={[st.notch, { right: -11 }]} />
    </View>
  );
}

function OtpDigits({ label, value }: { label?: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      {label ? <Text style={[type('xs', 'medium', colors.textMuted), { marginBottom: 6 }]}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: label ? 0 : spacing.sm }}>
        {value.split('').map((d, i) => (
          <View key={i} style={st.otpBox}>
            <Text style={[type('xl', 'extrabold', colors.brandDark), tabular]}>{d}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TicketSkeleton() {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={st.ticket}>
        <Skeleton height={52} r={0} style={{ borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card }} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ gap: 6 }}>
              <Skeleton width={90} height={20} />
              <Skeleton width={60} height={24} />
            </View>
            <View style={{ gap: 6, alignItems: 'flex-end' }}>
              <Skeleton width={90} height={20} />
              <Skeleton width={60} height={24} />
            </View>
          </View>
          <Skeleton width="50%" height={14} />
        </View>
        <View style={{ alignItems: 'center', paddingBottom: spacing.xl, gap: spacing.md }}>
          <Skeleton width={200} height={200} r={12} />
          <Skeleton width={180} height={44} r={10} />
        </View>
      </View>
      <View style={[st.card, { flexDirection: 'row', gap: spacing.md, alignItems: 'center' }]}>
        <Skeleton width={52} height={52} r={26} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="50%" height={14} />
          <Skeleton width="30%" height={12} />
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, ...shadowSoft },
  fresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.successLight,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#B7EBC8',
  },
  freshIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  roundIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ticket: { backgroundColor: colors.card, borderRadius: radius.card, ...shadowSoft },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  pnr: { alignItems: 'flex-end' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  perf: { height: 22, justifyContent: 'center', marginVertical: spacing.xs },
  perfLine: { marginHorizontal: spacing.lg, height: 0, borderTopWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed' },
  notch: { position: 'absolute', top: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.background },
  qr: { padding: spacing.md, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.md },
  otpBox: {
    width: 42,
    height: 50,
    borderRadius: 10,
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: '#C7D3EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.xs },
  cell: { width: '50%', paddingVertical: spacing.sm, gap: 1 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  callBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  driverPending: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    minHeight: 76,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
    ...shadowSoft,
  },
  actionWide: { flexDirection: 'row', minHeight: 56, gap: spacing.sm },
  actionIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  dash: { height: 0, borderTopWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginVertical: spacing.sm },
  line: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  eta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.success },
  hero: { borderWidth: 1.5, borderColor: colors.brandLight },
  heroPhoto: { width: 60, height: 60, borderRadius: 30 },
  plate: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#111827', borderRadius: 6, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  plateIn: { backgroundColor: '#1D4ED8', color: '#FFFFFF', fontSize: 8, fontWeight: '800', paddingHorizontal: 3, paddingVertical: 6 },
  plateText: { fontSize: 15, fontWeight: '800', letterSpacing: 1, color: '#111827', paddingHorizontal: 6, paddingVertical: 4 },
  heroBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.pill },
  stopPhoto: { width: '100%', height: 160, borderRadius: 12, backgroundColor: colors.background },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  panel: { paddingVertical: spacing.sm, gap: spacing.xs },
  panelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 10 },
  seatChip: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  seatChipOn: { backgroundColor: colors.danger, borderColor: colors.danger },
});
