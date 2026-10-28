import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminDriver, isoToYmd, serverUrl, useAuthHeaders } from '../../../admin/api';
import { AdminScreen, ContactButtons, DateField, GroupLabel, Panel, Pill, PromptModal, runAction, ToggleRow } from '../../../admin/components';
import { api, errorMessage } from '../../../api';
import { fmtDateShort } from '../../../format';
import { colors, radius, spacing, type } from '../../../theme';
import { BottomBar, Button, ErrorBanner, Input, Notice, Row, SkeletonList } from '../../../ui';

type Form = {
  name: string;
  phone: string;
  licenceNo: string;
  licenceExpiry: string;
  password: string;
  photoUrl: string;
  notes: string;
  showOnWebsite: boolean;
  active: boolean;
};
const EMPTY: Form = {
  name: '',
  phone: '',
  licenceNo: '',
  licenceExpiry: '',
  password: '',
  photoUrl: '',
  notes: '',
  showOnWebsite: true,
  active: true,
};

export default function DriverForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [driver, setDriver] = useState<AdminDriver | null>(null);
  const [form, setForm] = useState<Form | null>(isNew ? EMPTY : null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const headers = useAuthHeaders();

  const fetchDriver = useCallback(() => {
    if (isNew) return;
    api<{ driver: AdminDriver }>(`/api/admin/drivers/${id}`)
      .then(({ driver: d }) => {
        setDriver(d);
        setForm({
          name: d.name,
          phone: d.phone,
          licenceNo: d.licenceNo,
          licenceExpiry: isoToYmd(d.licenceExpiry),
          password: '',
          photoUrl: d.photoUrl ?? '',
          notes: d.notes ?? '',
          showOnWebsite: d.showOnWebsite,
          active: d.active,
        });
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id, isNew]);
  useEffect(() => fetchDriver(), [fetchDriver]);
  const load = () => {
    setError(null);
    fetchDriver();
  };

  const set =
    <K extends keyof Form>(k: K) =>
    (v: Form[K]) =>
      setForm((f) => f && { ...f, [k]: v });

  const save = async () => {
    if (!form) return;
    if (form.name.trim().length < 2 || !/^[6-9]\d{9}$/.test(form.phone) || !form.licenceNo.trim())
      return Alert.alert('Missing details', 'Name, a valid 10-digit mobile number and licence number are required.');
    if (isNew && form.password.length < 6) return Alert.alert('Set a password', 'Give the driver a password of at least 6 characters for the driver app.');
    setSaving(true);
    const r = await runAction('saveDriver', {
      ...(isNew ? {} : { id }),
      ...form,
      name: form.name.trim(),
    });
    setSaving(false);
    if (r) router.back();
  };

  const review = async (decision: 'approve' | 'reject', reason?: string) => {
    const r = await runAction('reviewDriverApplication', {
      id,
      decision,
      reason,
    });
    if (r) {
      setRejecting(false);
      load();
    }
  };

  const remove = async () => {
    const r = await runAction(
      'removeDriver',
      { id },
      {
        confirm: {
          title: `Remove ${driver?.name}?`,
          message: 'A driver with trip history is switched off (kept for records) and taken off upcoming duties. Otherwise the driver is deleted.',
          ok: 'Remove',
          destructive: true,
        },
      },
    );
    if (r) {
      Alert.alert(
        'Driver removed',
        r.removed === 'deactivated' ? 'The driver has history, so they were switched off instead of deleted.' : 'The driver was deleted.',
      );
      router.back();
    }
  };

  return (
    <AdminScreen title={isNew ? 'Add driver' : (driver?.name ?? 'Driver')} subtitle={isNew ? 'Creates a driver-app login' : driver?.phone}>
      {!form ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorBanner message={error} onRetry={load} />
          {!error ? <SkeletonList count={3} style={{ padding: 0 }} /> : null}
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
            {driver ? (
              <Panel style={{ marginBottom: spacing.md }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}
                >
                  <Pill label={driver.status} tone={driver.status === 'APPROVED' ? 'success' : driver.status === 'REJECTED' ? 'danger' : 'warning'} />
                  {!driver.active ? <Pill label="Inactive" tone="danger" /> : null}
                  <View style={{ flex: 1 }} />
                  <ContactButtons phone={driver.phone} />
                </View>
                {driver.appliedAt ? <Row label="Applied" value={fmtDateShort(driver.appliedAt)} /> : null}
                {driver.reviewedAt ? <Row label="Reviewed" value={fmtDateShort(driver.reviewedAt)} /> : null}
                {driver.address ? <Row label="Address" value={driver.address} /> : null}
                {driver.experienceYears != null ? <Row label="Experience" value={`${driver.experienceYears} years`} /> : null}
                {driver.emergencyContact ? <Row label="Emergency contact" value={driver.emergencyContact} /> : null}
                {driver.aadhaarLast4 ? <Row label="Aadhaar" value={`XXXX XXXX ${driver.aadhaarLast4}`} /> : null}
                {driver.rejectReason ? <Notice style={{ marginTop: spacing.sm }}>{`Rejected: ${driver.rejectReason}`}</Notice> : null}
                {headers && (driver.photoUrl || driver.licencePhotoUrl || driver.aadhaarPhotoUrl) ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                      gap: spacing.sm,
                      marginTop: spacing.md,
                    }}
                  >
                    {(
                      [
                        ['Photo', driver.photoUrl],
                        ['Licence', driver.licencePhotoUrl],
                        ['Aadhaar', driver.aadhaarPhotoUrl],
                      ] as const
                    ).map(([label, url]) =>
                      url ? (
                        <View key={label} style={{ alignItems: 'center', gap: 4 }}>
                          <Image source={{ uri: serverUrl(url), headers }} style={st.doc} resizeMode="cover" accessibilityLabel={`${label} photo`} />
                          <Text style={type('xs', 'semibold', colors.textMuted)}>{label}</Text>
                        </View>
                      ) : null,
                    )}
                  </ScrollView>
                ) : null}
                {driver.status === 'PENDING' ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: spacing.sm,
                      marginTop: spacing.md,
                    }}
                  >
                    <Button title="Reject" icon="close" variant="dangerOutline" size="md" style={{ flex: 1 }} onPress={() => setRejecting(true)} />
                    <Button title="Approve" icon="checkmark" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => review('approve')} />
                  </View>
                ) : null}
              </Panel>
            ) : null}

            <GroupLabel style={driver ? undefined : { marginTop: 0 }}>Details</GroupLabel>
            <Panel>
              <Input label="Full name" icon="person-outline" value={form.name} onChangeText={set('name')} autoCapitalize="words" />
              <Input
                label="Mobile number (driver-app login)"
                icon="call-outline"
                prefix="+91"
                value={form.phone}
                onChangeText={(t) => set('phone')(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
              />
              <Input
                label="Licence number"
                icon="card-outline"
                value={form.licenceNo}
                onChangeText={(t) => set('licenceNo')(t.toUpperCase())}
                autoCapitalize="characters"
              />
              <DateField label="Licence expiry" value={form.licenceExpiry} onChange={set('licenceExpiry')} />
              <Input
                label={isNew ? 'Password (min 6)' : 'New password (leave empty to keep)'}
                icon="lock-closed-outline"
                value={form.password}
                onChangeText={set('password')}
                secureTextEntry
                autoCapitalize="none"
              />
              <Input
                label="Photo URL (optional)"
                icon="image-outline"
                value={form.photoUrl}
                onChangeText={set('photoUrl')}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Input label="Office notes" value={form.notes} onChangeText={set('notes')} multiline containerStyle={{ marginBottom: 0 }} />
            </Panel>
            <GroupLabel>Settings</GroupLabel>
            <Panel>
              <ToggleRow label="Active" sub="Can receive duties and log in" value={form.active} onChange={set('active')} />
              <ToggleRow label="Show on website" sub="Listed under Our drivers" value={form.showOnWebsite} onChange={set('showOnWebsite')} last />
            </Panel>
            {!isNew ? <Button title="Remove driver" icon="trash-outline" variant="dangerOutline" onPress={remove} style={{ marginTop: spacing.lg }} /> : null}
            {isNew ? (
              <Text style={[type('xs', 'regular', colors.textMuted), { textAlign: 'center', marginTop: spacing.md }]}>
                A customer account with this number becomes the driver&apos;s account.
              </Text>
            ) : null}
          </ScrollView>
          <BottomBar caption={isNew ? 'New driver' : 'Editing'} note={form.phone || undefined}>
            <Button title={isNew ? 'Add driver' : 'Save changes'} icon="checkmark" onPress={save} loading={saving} />
          </BottomBar>
        </KeyboardAvoidingView>
      )}
      <PromptModal
        visible={rejecting}
        title="Reject application"
        message="Tell the driver what to fix. They can apply again from the driver app."
        label="Reason"
        multiline
        okLabel="Reject"
        destructive
        onClose={() => setRejecting(false)}
        onSubmit={async (reason) => {
          if (reason.length < 3) return Alert.alert('Give a reason', 'Please give a reason so the driver knows what to fix.');
          await review('reject', reason);
        }}
      />
    </AdminScreen>
  );
}

const st = StyleSheet.create({
  doc: {
    width: 120,
    height: 90,
    borderRadius: radius.input,
    backgroundColor: colors.background,
  },
});
