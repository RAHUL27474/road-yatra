import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { api, ApiError, Booking, Config, errorMessage, getConfig } from '../../api';
import { useAuth } from '../../auth';
import { cacheBooking, cachedBooking } from '../../cache';
import { checkBookingUpdates, syncTripReminders } from '../../notifications';
import { supportPhone } from '../../brand';
import { fmtDate, fmtDateTime, fmtDuration, fmtTime, inr, RENTAL_TYPE, VEHICLE_TYPE } from '../../format';
import { VehicleArt } from '../../illustrations';
import { openPage, openPayment, reachableUrl } from '../../store';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../../theme';
import { Button, EmptyState, ErrorBanner, hapticTap, Header, Input, IonName, isOnTrip, Notice, Row, Screen, Skeleton, statusInfo, Tone } from '../../ui';

const PAYMENT_LABEL = { UNPAID: 'Unpaid', PAID: 'Paid', REFUND_PENDING: 'Refund pending', REFUNDED: 'Refunded' };
const MODE_LABEL = { RAZORPAY: 'Online', DEMO: 'Online (demo)', CASH: 'Cash to driver' };

/** Status banner gradients for the ticket. */
const BANNER: Record<Tone, readonly [string, string]> = {
  success: ['#16A34A', '#128A3E'],
  warning: ['#E08A0B', '#C2700A'],
  danger: ['#DC2626', '#B91C1C'],
  brand: ['#1E3A8A', '#0B3D91'],
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
  useEffect(() => {
    if (!booking) return;
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
  const isCash = b.paymentMode === 'CASH';
  const cashDue = isCash && b.paymentStatus === 'UNPAID' && b.status === 'CONFIRMED';
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
    if (b.paymentStatus === 'PAID' && b.cancellation) {
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

        {b.status === 'CONFIRMED' && fresh ? (
          <View style={st.fresh}>
            <View style={st.freshIcon}>
              <Ionicons name="checkmark" size={24} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type('md', 'bold', colors.success)}>Booking confirmed</Text>
              <Text style={type('sm', 'regular', colors.text)}>
                {cashDue ? `Please pay ${inr(b.totalAmount)} in cash to the driver. ` : ''}Have a great journey.
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
                <Button title={`Pay ${inr(b.totalAmount)}`} icon="card-outline" onPress={retryPayment} loading={busy} style={{ marginTop: spacing.md }} />
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
              sub={cashDue ? 'Cash to driver' : PAYMENT_LABEL[b.paymentStatus]}
              subColor={cashDue ? colors.warning : b.paymentStatus === 'PAID' || b.paymentStatus === 'REFUNDED' ? colors.success : colors.textMuted}
              align="right"
            />
          </View>
        </View>

        {b.driver ? (
          <View style={[st.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}>
            {b.driver.photoUrl ? (
              <Image source={{ uri: b.driver.photoUrl }} style={st.avatar} />
            ) : (
              <View style={[st.avatar, { backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={type('lg', 'bold', colors.white)}>{initials(b.driver.name)}</Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={type('xs', 'medium', colors.textMuted)}>Your driver</Text>
              <Text style={type('md', 'bold')} numberOfLines={1}>
                {b.driver.name}
              </Text>
              {b.vehicle || b.vehicleNumber ? (
                <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
                  {[b.vehicle?.name, b.vehicleNumber].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => {
                hapticTap();
                whatsApp(b.driver!.phone);
              }}
              style={({ pressed }) => [st.callBtn, { backgroundColor: '#25D366' }, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={`WhatsApp driver ${b.driver.name}`}
            >
              <Ionicons name="logo-whatsapp" size={22} color={colors.white} />
            </Pressable>
            <Pressable
              onPress={() => {
                hapticTap();
                call(b.driver!.phone);
              }}
              style={({ pressed }) => [st.callBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={`Call driver ${b.driver.phone}`}
            >
              <Ionicons name="call" size={20} color={colors.white} />
            </Pressable>
          </View>
        ) : b.status === 'CONFIRMED' ? (
          <View style={[st.card, st.driverPending]}>
            <View style={[st.roundIcon, { backgroundColor: colors.background }]}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} />
            </View>
            <Text style={[type('sm', 'medium', colors.textMuted), { flex: 1 }]}>Driver name, phone and vehicle number will appear here once a driver is assigned.</Text>
          </View>
        ) : null}

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
          {b.invoiceNo ? <Row label="Invoice no." value={b.invoiceNo} /> : null}
          <Row label="Booked on" value={fmtDateTime(b.createdAt)} />
          {cashDue ? (
            <Notice tone="warning" icon="cash-outline" style={{ marginTop: spacing.sm }}>
              {`Pay ${inr(b.totalAmount)} in cash to the driver`}
            </Notice>
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
      Alert.alert('Thank you!', 'Your rating helps us keep every trip safe and comfortable.');
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
});
