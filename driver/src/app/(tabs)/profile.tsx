import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { DutyVehicle, fileUrl, getConfig } from '../../api';
import { useAuth } from '../../auth';
import { useDuties } from '../../duties';
import { fmtDate } from '../../format';
import { BRAND } from '../../brand';
import { colors, fonts, radius, space } from '../../theme';
import { Avatar, Badge, Button, callPhone, Card, confirm, Divider, Header, Ionicons, ListRow, SectionTitle, showError, Skeleton, T } from '../../ui';

export default function Profile() {
  const { user, logout } = useAuth();
  const { driver, duties, sharing, pending } = useDuties();
  // Vehicles on the driver's open duties, once each.
  const vehicles = [...new Map((duties ?? []).filter((d) => d.status !== 'COMPLETED' && d.vehicle?.docs).map((d) => [d.vehicle!.id, d.vehicle!])).values()];
  const [support, setSupport] = useState<string | null>(BRAND.phone);

  useEffect(() => {
    // Offline: keep the built-in office number quietly (no error popup every time the tab opens).
    getConfig().then((c) => setSupport(c.supportPhone || BRAND.phone), () => {});
  }, []);

  const name = driver?.name ?? user?.name ?? '';
  const phone = driver?.phone ?? user?.phone ?? '';
  const expiry = driver?.licenceExpiry ? new Date(driver.licenceExpiry) : null;
  const daysLeft = expiry ? Math.floor((expiry.getTime() - Date.now()) / 86_400_000) : null;
  const expired = daysLeft != null && daysLeft < 0;
  const expiringSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 30;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm }}>
          <Avatar name={name} uri={fileUrl(driver?.photoUrl)} size={72} light />
          <View style={{ flex: 1 }}>
            <T v="title" color={colors.onBrand} numberOfLines={2}>
              {name}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Ionicons name="call-outline" size={16} color={colors.onBrandMuted} />
              <T v="bodyStrong" color={colors.onBrandMuted}>
                {phone}
              </T>
            </View>
            <View style={st.roleChip}>
              <Ionicons name="id-card-outline" size={14} color={colors.onBrand} />
              <T v="caption" color={colors.onBrand} style={{ fontFamily: fonts.bold }}>
                {BRAND.short} driver
              </T>
            </View>
          </View>
        </View>
      </Header>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl }}>
        {/* Licence card */}
        <Card padded={false} style={[{ marginTop: space.lg, overflow: 'hidden' }, (expired || expiringSoon) && { borderColor: expired ? colors.danger : colors.warning, borderWidth: 1.5 }]}>
          <View style={st.licenceTop}>
            <Ionicons name="card" size={22} color={colors.brand} />
            <T v="overline" color={colors.brand} style={{ flex: 1 }}>
              Driving licence
            </T>
            {expired ? (
              <Badge label="Expired" tone="danger" icon="alert-circle" />
            ) : expiringSoon ? (
              <Badge label={`${daysLeft} day${daysLeft === 1 ? '' : 's'} left`} tone="warning" icon="warning" />
            ) : expiry ? (
              <Badge label="Valid" tone="success" icon="checkmark-circle" />
            ) : null}
          </View>
          <View style={{ padding: space.lg, gap: space.md }}>
            <View>
              <T v="caption" color={colors.textMuted}>
                Licence no.
              </T>
              <T numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.mono, fontWeight: '700', fontSize: 20, color: colors.text, letterSpacing: 1, marginTop: 2 }}>
                {driver?.licenceNo ?? '—'}
              </T>
            </View>
            <View>
              <T v="caption" color={colors.textMuted}>
                Valid till
              </T>
              <T v="h2" color={expired ? colors.danger : colors.text} style={{ marginTop: 2 }}>
                {expiry ? fmtDate(expiry) : '—'}
              </T>
            </View>
            {expired || expiringSoon ? (
              <View style={[st.warn, { backgroundColor: expired ? colors.dangerLight : colors.warningLight }]}>
                <Ionicons name="warning" size={20} color={expired ? '#B91C1C' : '#B45309'} />
                <T v="label" color={expired ? '#B91C1C' : '#92400E'} style={{ flex: 1 }}>
                  {expired
                    ? 'Your licence has expired. Renew it and inform the office.'
                    : `Your licence expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Please renew it.`}
                </T>
              </View>
            ) : null}
          </View>
        </Card>

        {vehicles.length ? (
          <>
            <SectionTitle title="Vehicle papers" />
            <View style={{ gap: space.md }}>
              {vehicles.map((v) => (
                <VehiclePapers key={v.id} v={v} />
              ))}
            </View>
          </>
        ) : null}

        <SectionTitle title="Support" />
        <Card style={{ paddingVertical: space.xs }}>
          {support ? (
            <ListRow icon="headset" iconTone="success" title="Call office" subtitle={support} onPress={() => callPhone(support)} chevron />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 }}>
              <Skeleton width={44} height={44} r={12} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="50%" height={14} />
                <Skeleton width="35%" height={12} />
              </View>
            </View>
          )}
          <Divider />
          <ListRow icon="call-outline" iconTone="brand" title="My number" subtitle={phone || '—'} />
        </Card>

        <SectionTitle title="App" />
        <Card style={{ paddingVertical: space.xs }}>
          <ListRow
            icon="information-circle-outline"
            iconTone="neutral"
            title="App version"
            right={
              <T v="bodyStrong" color={colors.textMuted}>
                {Constants.expoConfig?.version ?? '—'}
              </T>
            }
          />
        </Card>

        <Button
          title="Log out"
          icon="log-out-outline"
          variant="outlineDanger"
          onPress={() =>
            confirm(
              'Log out?',
              [
                pending.length ? `${pending.length} action${pending.length > 1 ? 's' : ''} saved offline (boarding / cash) have not reached the office yet. They will be sent now if there is internet — otherwise they are lost.` : '',
                sharing ? 'Location sharing for your current trip will stop.' : 'You will need to log in again.',
              ]
                .filter(Boolean)
                .join('\n\n'),
              'Log out',
              () => logout().catch(showError),
              true,
            )
          }
          style={{ marginTop: space.xxl }}
        />
      </ScrollView>
    </View>
  );
}

/** Insurance / permit / fitness / PUC of a vehicle the driver is assigned to, with expiry badges. */
function VehiclePapers({ v }: { v: DutyVehicle }) {
  const docs: [string, string | null | undefined][] = [
    ['Insurance', v.docs?.insurance],
    ['Permit', v.docs?.permit],
    ['Fitness', v.docs?.fitness],
    ['PUC', v.docs?.puc],
  ];
  return (
    <Card style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Ionicons name="car-sport" size={20} color={colors.brand} />
        <T v="h2" style={{ flex: 1 }} numberOfLines={1}>
          {v.regNumber}
        </T>
        <T v="label" color={colors.textMuted} numberOfLines={1}>
          {v.name}
        </T>
      </View>
      {docs.map(([label, date]) => {
        const days = date ? Math.floor((new Date(date).getTime() - Date.now()) / 86_400_000) : null;
        return (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 }}>
            <T v="bodyStrong" style={{ flex: 1 }}>
              {label}
            </T>
            <T v="label" color={colors.textMuted}>
              {date ? fmtDate(date) : 'Not recorded'}
            </T>
            {days == null ? null : days < 0 ? (
              <Badge label="Expired" tone="danger" icon="alert-circle" />
            ) : days <= 15 ? (
              <Badge label={`${days}d left`} tone="warning" icon="warning" />
            ) : (
              <Badge label="Valid" tone="success" />
            )}
          </View>
        );
      })}
    </Card>
  );
}

const st = StyleSheet.create({
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: space.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  licenceTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.brandLight, paddingHorizontal: space.lg, paddingVertical: space.md },
  warn: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.input + 2, alignItems: 'flex-start' },
});
