import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { AdminBooking, DriverBrief, useAdmin } from '../../../admin/api';
import { AdminScreen, bookingTitle, ContactButtons, GroupLabel, Panel, Pill, PromptModal, payTone, runAction } from '../../../admin/components';
import { fmtDateTime, inr, RENTAL_TYPE } from '../../../format';
import { openPage } from '../../../store';
import { colors, spacing, tabular, type } from '../../../theme';
import { Button, Divider, ErrorBanner, Notice, OptionSheet, Row, SkeletonList, StatusBadge } from '../../../ui';

type Resp = { booking: AdminBooking; drivers: DriverBrief[] };
type Prompt = null | 'cancel' | 'note';

export default function AdminBookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, refreshing, refresh, reload } = useAdmin<Resp>(`/api/admin/bookings/${encodeURIComponent(id)}`);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [assigning, setAssigning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const b = data?.booking;

  const update = async (
    action: string,
    extra: Record<string, unknown> = {},
    confirm?: {
      title: string;
      message?: string;
      ok?: string;
      destructive?: boolean;
    },
  ) => {
    if (!b) return;
    setBusy(action);
    const r = await runAction('updateBooking', { id: b.id, action, ...extra }, { confirm });
    setBusy(null);
    if (r) await reload();
    return r;
  };

  return (
    <AdminScreen title={b ? `Booking ${b.code}` : 'Booking'} subtitle={b ? bookingTitle(b) : undefined}>
      {!b ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorBanner message={error} onRetry={reload} />
          {!error ? <SkeletonList count={3} style={{ padding: 0 }} /> : null}
        </View>
      ) : (
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
                flexWrap: 'wrap',
              }}
            >
              <StatusBadge status={b.status} tripStatus={b.tripStatus} />
              <Pill label={b.paymentStatus.replace('_', ' ')} tone={payTone(b.paymentStatus)} />
              <Pill label={b.kind === 'SEAT' ? 'Shared seat' : 'Full cab'} tone={b.kind === 'SEAT' ? 'brand' : 'warning'} />
              <Pill label={b.source === 'OFFLINE' ? 'Phone booking' : 'Online'} />
              {b.noShow ? <Pill label="No-show" tone="danger" /> : null}
            </View>
            <Text style={[type('lg', 'extrabold'), { marginTop: spacing.md }]}>{bookingTitle(b)}</Text>
            {b.trip ? (
              <Text style={[type('sm', 'medium', colors.textMuted), tabular]}>
                {fmtDateTime(b.trip.departAt)} · Seat {b.seatNos.join(', ')}
              </Text>
            ) : b.startAt ? (
              <Text style={[type('sm', 'medium', colors.textMuted), tabular]}>
                {fmtDateTime(b.startAt)}
                {b.endAt ? ` → ${fmtDateTime(b.endAt)}` : ''}
              </Text>
            ) : null}
            <Divider />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={type('xs', 'semibold', colors.textMuted)}>PASSENGER</Text>
                <Text style={type('md', 'bold')} numberOfLines={1}>
                  {b.passengerName}
                </Text>
                <Text style={[type('sm', 'medium', colors.textMuted), tabular]}>
                  {b.passengerPhone} · {b.passengers} {b.passengers === 1 ? 'person' : 'people'}
                </Text>
              </View>
              <ContactButtons phone={b.passengerPhone} />
            </View>
            {b.bookedBy && b.bookedBy.phone !== b.passengerPhone ? (
              <Text style={[type('xs', 'regular', colors.textMuted), { marginTop: spacing.sm }]}>
                Booked by {b.bookedBy.name} ({b.bookedBy.phone})
              </Text>
            ) : null}
          </Panel>

          <GroupLabel>Journey</GroupLabel>
          <Panel>
            {b.pickupStop ? <Row label="Pickup" value={`${b.pickupStop.name}, ${b.pickupStop.city}`} /> : null}
            {b.dropStop ? <Row label="Drop" value={`${b.dropStop.name}, ${b.dropStop.city}`} /> : null}
            {b.rentalType ? <Row label="Plan" value={RENTAL_TYPE[b.rentalType] ?? b.rentalType} /> : null}
            {b.pickupAddress ? <Row label="Pickup address" value={b.pickupAddress} /> : null}
            {b.dropAddress ? <Row label="Drop address" value={b.dropAddress} /> : null}
            {b.estimatedKm ? <Row label="Estimated km" value={`${b.estimatedKm} km`} /> : null}
            <Row label="Vehicle" value={[b.vehicle?.name, b.vehicleReg].filter(Boolean).join(' · ') || '—'} />
            <Row label="Driver" value={b.driver ? `${b.driver.name} · ${b.driver.phone}` : 'Not assigned'} valueColor={b.driver ? undefined : colors.danger} />
            {b.driverResponse ? (
              <Row
                label="Driver response"
                value={b.driverResponse.toLowerCase()}
                valueColor={b.driverResponse === 'ACCEPTED' ? colors.success : colors.danger}
              />
            ) : null}
            {b.driverNote ? <Row label="Driver note" value={b.driverNote} /> : null}
            {b.boardingOtp ? <Row label="Boarding OTP" value={b.boardingOtp} /> : null}
            {b.boardedAt ? <Row label="Boarded" value={fmtDateTime(b.boardedAt)} /> : null}
            {b.startOdometer != null ? <Row label="Odometer" value={`${b.startOdometer} → ${b.endOdometer ?? '…'} km`} /> : null}
          </Panel>

          <GroupLabel>Payment</GroupLabel>
          <Panel>
            <Row label="Fare" value={inr(b.baseAmount)} />
            <Row label="GST" value={inr(b.taxAmount)} />
            {b.extraCharges ? <Row label="Toll & parking" value={inr(b.extraCharges)} /> : null}
            <Row label="Total" value={inr(b.totalAmount)} bold />
            <Divider />
            <Row label="Mode" value={b.paymentMode ?? '—'} />
            {b.amountPaid ? <Row label="Paid online" value={inr(b.amountPaid)} /> : null}
            {b.cashDue ? <Row label="Cash due" value={inr(b.cashDue)} valueColor={colors.warning} /> : null}
            {b.paymentId ? <Row label="Payment ID" value={b.paymentId} /> : null}
            {b.invoiceNo ? <Row label="Invoice" value={b.invoiceNo} /> : null}
            {b.refundAmount != null && b.status === 'CANCELLED' ? <Row label="Refund" value={inr(b.refundAmount)} /> : null}
            {b.seatRefundDue ? <Row label="Seat refund due" value={inr(b.seatRefundDue)} valueColor={colors.danger} /> : null}
            <Row label="Booked on" value={fmtDateTime(b.createdAt)} />
            {b.cancelledAt ? <Row label="Cancelled on" value={fmtDateTime(b.cancelledAt)} /> : null}
          </Panel>

          <GroupLabel>Office note</GroupLabel>
          <Panel>
            <Text style={type('sm', 'regular', b.adminNote ? colors.text : colors.textSubtle)}>{b.adminNote || 'No note yet.'}</Text>
            <Button
              title={b.adminNote ? 'Edit note' : 'Add note'}
              icon="create-outline"
              variant="outline"
              size="md"
              onPress={() => setPrompt('note')}
              style={{ marginTop: spacing.md }}
            />
          </Panel>

          <GroupLabel>Actions</GroupLabel>
          <View style={{ gap: spacing.sm }}>
            {b.can.cashOrUpi ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title="Cash received"
                  icon="cash-outline"
                  variant="secondary"
                  size="md"
                  loading={busy === 'cash'}
                  style={{ flex: 1 }}
                  onPress={() =>
                    update(
                      'cash',
                      {},
                      {
                        title: 'Mark as paid in cash?',
                        message: `${inr(b.cashDue || b.totalAmount)} received at the office.`,
                        ok: 'Mark paid',
                      },
                    )
                  }
                />
                <Button
                  title="UPI received"
                  icon="phone-portrait-outline"
                  variant="secondary"
                  size="md"
                  loading={busy === 'upi'}
                  style={{ flex: 1 }}
                  onPress={() => update('upi', {}, { title: 'Mark as paid by UPI?', ok: 'Mark paid' })}
                />
              </View>
            ) : null}
            {b.can.assignDriver ? (
              <Button title={b.driver ? 'Change driver' : 'Assign driver'} icon="person-add-outline" variant="outline" onPress={() => setAssigning(true)} />
            ) : null}
            {b.can.complete ? (
              <Button
                title="Mark completed"
                icon="flag-outline"
                variant="outline"
                loading={busy === 'complete'}
                onPress={() => update('complete', {}, { title: 'Mark this booking completed?', ok: 'Completed' })}
              />
            ) : null}
            {b.can.seatRefunded ? (
              <Button
                title={`Seat refund paid (${inr(b.seatRefundDue)})`}
                icon="return-down-back-outline"
                variant="outline"
                onPress={() =>
                  update(
                    'seatRefunded',
                    {},
                    {
                      title: 'Seat refund paid?',
                      message: 'The passenger is told by WhatsApp/SMS.',
                      ok: 'Refund paid',
                    },
                  )
                }
              />
            ) : null}
            {b.can.markRefunded ? (
              <Button
                title={`Refund paid (${inr(b.refundAmount ?? 0)})`}
                icon="return-down-back-outline"
                variant="outline"
                onPress={() =>
                  update(
                    'refunded',
                    {},
                    {
                      title: 'Mark refund as paid?',
                      message: 'The passenger is told by WhatsApp/SMS.',
                      ok: 'Refund paid',
                    },
                  )
                }
              />
            ) : null}
            {b.invoiceUrl ? <Button title="Open GST invoice" icon="document-text-outline" variant="ghost" onPress={() => openPage(b.invoiceUrl!)} /> : null}
            {b.trackUrl ? <Button title="Open live tracking" icon="navigate-outline" variant="ghost" onPress={() => openPage(b.trackUrl!)} /> : null}
            {b.trip ? <Button title="Open trip" icon="bus-outline" variant="ghost" onPress={() => router.push(`/admin/trips/${b.trip!.id}`)} /> : null}
            {b.can.cancel ? <Button title="Cancel booking" icon="close-circle-outline" variant="dangerOutline" onPress={() => setPrompt('cancel')} /> : null}
            {!b.can.cancel && !b.can.cashOrUpi && !b.can.complete && !b.can.assignDriver && !b.can.markRefunded && !b.can.seatRefunded ? (
              <Notice tone="info">Nothing left to do on this booking.</Notice>
            ) : null}
          </View>

          <OptionSheet
            visible={assigning}
            title="Assign driver"
            icon="person-outline"
            value={b.driverId}
            options={[
              { key: '', label: 'No driver', sub: 'Remove the current driver' },
              ...(data?.drivers ?? []).map((d) => ({
                key: d.id,
                label: d.name,
                sub: d.phone,
              })),
            ]}
            onSelect={(driverId) => update('assign', { driverId })}
            onClose={() => setAssigning(false)}
          />
          <PromptModal
            visible={prompt === 'note'}
            title="Office note"
            message="Only the office sees this note."
            initial={b.adminNote ?? ''}
            multiline
            onClose={() => setPrompt(null)}
            onSubmit={async (note) => {
              if (await update('note', { note })) setPrompt(null);
            }}
          />
          <PromptModal
            visible={prompt === 'cancel'}
            title={`Cancel ${b.code}?`}
            message={
              b.can.refundAmount
                ? `Refund to give the passenger (suggested ${inr(b.suggestedRefund)} from the cancellation policy). The passenger is told by WhatsApp/SMS.`
                : 'The passenger is told by WhatsApp/SMS.'
            }
            label={b.can.refundAmount ? 'Refund amount (₹)' : undefined}
            initial={b.can.refundAmount ? String(b.suggestedRefund) : ''}
            keyboardType="number-pad"
            okLabel="Cancel booking"
            destructive
            onClose={() => setPrompt(null)}
            onSubmit={async (text) => {
              const refund = text.replace(/[^\d.]/g, '');
              if (b.can.refundAmount && refund && Number(refund) > b.totalAmount)
                return Alert.alert('Refund too high', `The booking total is ${inr(b.totalAmount)}.`);
              if (
                await update('cancel', {
                  ...(b.can.refundAmount && refund !== '' ? { refundAmount: Number(refund) } : {}),
                  note: 'Cancelled by office (app)',
                })
              )
                setPrompt(null);
            }}
          />
        </ScrollView>
      )}
    </AdminScreen>
  );
}
