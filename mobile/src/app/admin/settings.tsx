import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Settings, useAdmin } from '../../admin/api';
import { AdminScreen, GroupLabel, NumField, Panel, Pill, runAction, ToggleRow, TwoCol } from '../../admin/components';
import { colors, spacing, type } from '../../theme';
import { BottomBar, Button, ErrorBanner, Input, SkeletonList } from '../../ui';

type Resp = {
  settings: Settings;
  status: { onlinePayments: boolean; mobileOtp: boolean };
};
type Form = {
  legalName: string;
  gstin: string;
  address: string;
  stateName: string;
  stateCode: string;
  sacCode: string;
  email: string;
  slabs: { hours: string; refund: string }[];
  allowCash: boolean;
  travelPolicy: string;
  returnDiscountPercent: string;
  freeChangeHours: string;
  advancePerSeat: string;
  upiId: string;
  upiName: string;
};

const SLABS = 5;

const toForm = (s: Settings): Form => ({
  ...s.business,
  slabs: Array.from({ length: SLABS }, (_, i) => {
    const sl = s.cancellationSlabs[i];
    return sl ? { hours: String(sl.minHoursBefore), refund: String(sl.refundPercent) } : { hours: '', refund: '' };
  }),
  allowCash: s.allowCash,
  travelPolicy: s.travelPolicy ?? '',
  returnDiscountPercent: String(s.returnDiscountPercent ?? 0),
  freeChangeHours: String(s.freeChangeHours ?? 0),
  advancePerSeat: String(s.advancePerSeat ?? 0),
  upiId: s.upiId ?? '',
  upiName: s.upiName ?? '',
});

export default function AdminSettings() {
  const { data, error, reload } = useAdmin<Resp>('/api/admin/settings');
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  // Fill the form once; later focus reloads must not wipe unsaved edits.
  if (data && !form) setForm(toForm(data.settings));

  const set =
    <K extends keyof Form>(k: K) =>
    (v: Form[K]) =>
      setForm((f) => f && { ...f, [k]: v });
  const setSlab = (i: number, k: 'hours' | 'refund', v: string) =>
    setForm(
      (f) =>
        f && {
          ...f,
          slabs: f.slabs.map((s, j) => (j === i ? { ...s, [k]: v } : s)),
        },
    );

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const slabFields: Record<string, string> = {};
    form.slabs.forEach((s, i) => {
      slabFields[`slabHours${i}`] = s.hours;
      slabFields[`slabRefund${i}`] = s.refund;
    });
    const { slabs: _slabs, ...rest } = form;
    const r = await runAction('saveSettings', {
      ...rest,
      ...slabFields,
      returnDiscountPercent: Number(form.returnDiscountPercent) || 0,
      freeChangeHours: Number(form.freeChangeHours) || 0,
      advancePerSeat: Number(form.advancePerSeat) || 0,
    });
    setSaving(false);
    // The form already shows what was saved; keep it (refilling from a reload could flash old values).
    if (r) Alert.alert('Settings saved', 'Customers see the new settings straight away.');
  };

  return (
    <AdminScreen title="Settings" subtitle="Business, refunds and payments">
      {!form || !data ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorBanner message={error} onRetry={reload} />
          <SkeletonList count={4} style={{ padding: 0 }} />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={{
              padding: spacing.lg,
              paddingBottom: spacing.xxxl,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                flexWrap: 'wrap',
              }}
            >
              <Pill
                label={data.status.onlinePayments ? 'Online payments on' : 'Online payments off (cash only)'}
                tone={data.status.onlinePayments ? 'success' : 'warning'}
              />
              <Pill label={data.status.mobileOtp ? 'SMS OTP on' : 'SMS OTP not set up'} tone={data.status.mobileOtp ? 'success' : 'warning'} />
            </View>

            <GroupLabel>Business & GST (invoices)</GroupLabel>
            <Panel>
              <Input label="Legal name" value={form.legalName} onChangeText={set('legalName')} />
              <Input label="GSTIN" value={form.gstin} onChangeText={(t) => set('gstin')(t.toUpperCase())} autoCapitalize="characters" />
              <Input label="Address" value={form.address} onChangeText={set('address')} multiline />
              <TwoCol>
                <Input label="State" value={form.stateName} onChangeText={set('stateName')} containerStyle={{ flex: 1 }} />
                <Input label="State code" value={form.stateCode} onChangeText={set('stateCode')} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
              </TwoCol>
              <TwoCol>
                <Input label="SAC code" value={form.sacCode} onChangeText={set('sacCode')} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
                <Input
                  label="Email"
                  value={form.email}
                  onChangeText={set('email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  containerStyle={{ flex: 1 }}
                />
              </TwoCol>
            </Panel>

            <GroupLabel>Cancellation refunds</GroupLabel>
            <Panel>
              <Text style={[type('xs', 'regular', colors.textMuted), { marginBottom: spacing.md }]}>
                Refund % when cancelled at least this many hours before departure. Leave a row empty to remove it. A 0-hour row is added if missing.
              </Text>
              {form.slabs.map((s, i) => (
                <TwoCol key={i}>
                  <NumField label={`Rule ${i + 1}: hours before`} value={s.hours} onChange={(v) => setSlab(i, 'hours', v)} />
                  <NumField label="Refund %" value={s.refund} onChange={(v) => setSlab(i, 'refund', v)} />
                </TwoCol>
              ))}
            </Panel>

            <GroupLabel>Payments</GroupLabel>
            <Panel>
              <ToggleRow
                label="Allow cash to driver"
                sub="Customers can book now and pay cash at boarding"
                value={form.allowCash}
                onChange={set('allowCash')}
                last
              />
              <TwoCol>
                <Input
                  label="Office UPI ID"
                  value={form.upiId}
                  onChangeText={set('upiId')}
                  autoCapitalize="none"
                  placeholder="name@bank"
                  containerStyle={{ flex: 1, marginTop: spacing.md }}
                />
                <Input label="UPI name" value={form.upiName} onChangeText={set('upiName')} containerStyle={{ flex: 1, marginTop: spacing.md }} />
              </TwoCol>
              <NumField
                label="Online advance per seat (0 = off)"
                prefix="₹"
                value={form.advancePerSeat}
                onChange={set('advancePerSeat')}
                style={{ marginBottom: 0 }}
              />
            </Panel>

            <GroupLabel>Trips</GroupLabel>
            <Panel>
              <TwoCol>
                <NumField label="Return-trip discount %" value={form.returnDiscountPercent} onChange={set('returnDiscountPercent')} />
                <NumField label="Free change up to (hours)" value={form.freeChangeHours} onChange={set('freeChangeHours')} />
              </TwoCol>
              <Input
                label="Travel policy (one rule per line)"
                value={form.travelPolicy}
                onChangeText={set('travelPolicy')}
                multiline
                style={{ minHeight: 110, textAlignVertical: 'top' }}
                containerStyle={{ marginBottom: 0 }}
              />
            </Panel>
          </ScrollView>
          <BottomBar caption="Settings" note="Applies to the website and both apps">
            <Button title="Save settings" icon="checkmark" onPress={save} loading={saving} />
          </BottomBar>
        </KeyboardAvoidingView>
      )}
    </AdminScreen>
  );
}
