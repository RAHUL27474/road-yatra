import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { API_URL, fileUrl, getConfig } from '../../api';
import { useAuth } from '../../auth';
import { useDuties } from '../../duties';
import { fmtDate } from '../../format';
import { colors, fonts, radius, space } from '../../theme';
import { Avatar, Badge, Button, callPhone, Card, confirm, Divider, Header, Ionicons, ListRow, SectionTitle, showError, Skeleton, T } from '../../ui';

export default function Profile() {
  const { user, logout } = useAuth();
  const { driver, sharing } = useDuties();
  const [support, setSupport] = useState<string | null>(null);

  useEffect(() => {
    getConfig().then((c) => setSupport(c.supportPhone), showError);
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
                Road Yatra driver
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
          <Divider />
          <ListRow icon="server-outline" iconTone="neutral" title="Server" subtitle={API_URL} />
        </Card>

        <Button
          title="Log out"
          icon="log-out-outline"
          variant="outlineDanger"
          onPress={() =>
            confirm('Log out?', sharing ? 'Location sharing for your current trip will stop.' : 'You will need to log in again.', 'Log out', () => logout().catch(showError), true)
          }
          style={{ marginTop: space.xxl }}
        />
      </ScrollView>
    </View>
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
