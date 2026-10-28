import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DriverListRow, useAdmin } from '../../../admin/api';
import { AdminScreen, ContactButtons, GroupLabel, HeaderAction, Panel, Pill, runAction } from '../../../admin/components';
import { fmtDateShort, inr } from '../../../format';
import { colors, spacing, tabular, type } from '../../../theme';
import { Button, ErrorBanner, SkeletonList } from '../../../ui';

type Resp = {
  loadedAt: string;
  pending: DriverListRow[];
  drivers: DriverListRow[];
};

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export default function AdminDrivers() {
  const { data, error, refreshing, refresh, reload } = useAdmin<Resp>('/api/admin/drivers');
  const cashTotal = (data?.drivers ?? []).reduce((n, d) => n + d.cashHeld.amount, 0);

  return (
    <AdminScreen
      title="Drivers"
      subtitle={data ? `${data.drivers.filter((d) => d.active).length} active · ${inr(cashTotal)} cash with drivers` : 'Loading…'}
      right={<HeaderAction icon="person-add" label="Add driver" onPress={() => router.push('/admin/drivers/new')} />}
    >
      {!data ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorBanner message={error} onRetry={reload} />
          <SkeletonList count={4} style={{ padding: 0 }} />
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
          {data.pending.length ? (
            <>
              <GroupLabel style={{ marginTop: 0 }}>{`Applications waiting (${data.pending.length})`}</GroupLabel>
              {data.pending.map((d) => (
                <Panel
                  key={d.id}
                  style={{
                    marginBottom: spacing.md,
                    borderLeftWidth: 4,
                    borderLeftColor: colors.brand,
                  }}
                >
                  <View style={st.head}>
                    <Avatar name={d.name} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={type('md', 'bold')} numberOfLines={1}>
                        {d.name}
                      </Text>
                      <Text style={[type('xs', 'regular', colors.textMuted), tabular]}>
                        {d.phone} · applied {d.appliedAt ? fmtDateShort(d.appliedAt) : '—'}
                      </Text>
                      <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
                        Licence {d.licenceNo}
                        {d.experienceYears != null ? ` · ${d.experienceYears} yrs experience` : ''}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: spacing.sm,
                      marginTop: spacing.md,
                    }}
                  >
                    <Button
                      title="Review"
                      icon="eye-outline"
                      variant="outline"
                      size="md"
                      style={{ flex: 1 }}
                      onPress={() => router.push(`/admin/drivers/${d.id}`)}
                    />
                    <Button
                      title="Approve"
                      icon="checkmark"
                      variant="secondary"
                      size="md"
                      style={{ flex: 1 }}
                      onPress={async () => {
                        const r = await runAction(
                          'reviewDriverApplication',
                          { id: d.id, decision: 'approve' },
                          {
                            confirm: {
                              title: `Approve ${d.name}?`,
                              message: 'They can log in to the driver app and receive duties.',
                              ok: 'Approve',
                            },
                          },
                        );
                        if (r) reload();
                      }}
                    />
                  </View>
                </Panel>
              ))}
            </>
          ) : null}

          <GroupLabel style={data.pending.length ? undefined : { marginTop: 0 }}>{`Drivers (${data.drivers.length})`}</GroupLabel>
          {data.drivers.map((d) => (
            <Pressable key={d.id} onPress={() => router.push(`/admin/drivers/${d.id}`)} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
              <Panel style={[{ marginBottom: spacing.md }, !d.active && { opacity: 0.6 }]}>
                <View style={st.head}>
                  <Avatar name={d.name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={type('md', 'bold')} numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text style={[type('xs', 'regular', colors.textMuted), tabular]}>{d.phone}</Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginTop: 4,
                      }}
                    >
                      {!d.active ? <Pill label="Inactive" tone="danger" /> : null}
                      {d.status === 'REJECTED' ? <Pill label="Rejected" tone="danger" /> : null}
                      <Pill label={`${d.tripsDone} trips`} />
                      {d.rating ? <Pill label={`★ ${d.rating.average.toFixed(1)} (${d.rating.count})`} tone="warning" /> : null}
                      {d.licenceExpiry && new Date(d.licenceExpiry).getTime() < new Date(data.loadedAt).getTime() + 30 * 86_400_000 ? (
                        <Pill label={`Licence ${fmtDateShort(d.licenceExpiry)}`} tone="danger" />
                      ) : null}
                    </View>
                  </View>
                  <ContactButtons phone={d.phone} />
                </View>
                {d.cashHeld.amount > 0 ? (
                  <View style={st.cash}>
                    <Ionicons name="wallet-outline" size={18} color={colors.warning} />
                    <Text style={[type('sm', 'semibold'), { flex: 1 }]}>
                      Holding {inr(d.cashHeld.amount)}{' '}
                      <Text style={type('xs', 'regular', colors.textMuted)}>
                        ({d.cashHeld.count} booking
                        {d.cashHeld.count === 1 ? '' : 's'})
                      </Text>
                    </Text>
                    <Button
                      title="Received"
                      size="md"
                      variant="secondary"
                      fullWidth={false}
                      onPress={async () => {
                        const r = await runAction(
                          'markCashReceived',
                          { driverId: d.id, upTo: data.loadedAt },
                          {
                            confirm: {
                              title: `Cash received from ${d.name}?`,
                              message: `${inr(d.cashHeld.amount)} handed over to the office.`,
                              ok: 'Received',
                            },
                          },
                        );
                        if (r) reload();
                      }}
                    />
                  </View>
                ) : null}
              </Panel>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </AdminScreen>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <View style={st.avatar}>
      <Text style={type('md', 'extrabold', colors.brand)}>{initials(name)}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cash: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
