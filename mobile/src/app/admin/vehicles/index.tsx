import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminVehicle, useAdmin } from '../../../admin/api';
import { AdminScreen, HeaderAction, Pill } from '../../../admin/components';
import { fmtDateShort, inr } from '../../../format';
import { VehicleArt } from '../../../illustrations';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../../../theme';
import { Button, EmptyState, ErrorBanner, SkeletonList } from '../../../ui';

const DOCS: [keyof AdminVehicle, string][] = [
  ['insuranceExpiry', 'Insurance'],
  ['permitExpiry', 'Permit'],
  ['fitnessExpiry', 'Fitness'],
  ['pucExpiry', 'PUC'],
];

/** Documents that have expired or expire within 30 days. */
function docWarnings(v: AdminVehicle) {
  const soon = Date.now() + 30 * 86_400_000;
  return DOCS.filter(([k]) => v[k] && new Date(v[k] as string).getTime() < soon).map(([k, label]) => ({
    label,
    date: v[k] as string,
    expired: new Date(v[k] as string).getTime() < Date.now(),
  }));
}

export default function AdminVehicles() {
  const { data, error, refreshing, refresh, reload } = useAdmin<{
    vehicles: AdminVehicle[];
  }>('/api/admin/vehicles');
  return (
    <AdminScreen
      title="Vehicles"
      subtitle={data ? `${data.vehicles.filter((v) => v.active).length} active of ${data.vehicles.length}` : 'Loading…'}
      right={<HeaderAction icon="add" label="Add vehicle" onPress={() => router.push('/admin/vehicles/new')} />}
    >
      {!data ? (
        <View>
          <ErrorBanner message={error} onRetry={reload} style={{ margin: spacing.lg }} />
          <SkeletonList count={4} />
        </View>
      ) : (
        <FlatList
          data={data.vehicles}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            flexGrow: 1,
          }}
          refreshing={refreshing}
          onRefresh={refresh}
          ListHeaderComponent={<ErrorBanner message={error} onRetry={reload} />}
          ListEmptyComponent={
            <EmptyState
              mci="car-outline"
              title="No vehicles yet"
              action={<Button title="Add vehicle" icon="add" onPress={() => router.push('/admin/vehicles/new')} />}
            />
          }
          renderItem={({ item: v }) => {
            const warn = docWarnings(v);
            return (
              <Pressable
                onPress={() => router.push(`/admin/vehicles/${v.id}`)}
                style={({ pressed }) => [st.card, !v.active && { opacity: 0.6 }, pressed && { transform: [{ scale: 0.99 }] }]}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                  }}
                >
                  <VehicleArt type={v.type as never} photo={v.imageUrl} width={76} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={type('md', 'bold')} numberOfLines={1}>
                      {v.name}
                    </Text>
                    <Text style={[type('sm', 'extrabold', colors.brand), tabular]}>{v.regNumber}</Text>
                    <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
                      {v.typeLabel} · {v.seats} seats · {inr(v.ratePerKm)}/km
                    </Text>
                  </View>
                </View>
                <View style={st.tags}>
                  {!v.active ? <Pill label="Inactive" tone="danger" /> : null}
                  {v.allowSeatBooking ? <Pill label="Shared seats" tone="brand" /> : null}
                  {v.allowRental ? <Pill label="Full cab" tone="warning" /> : null}
                  {warn.map((w) => (
                    <Pill key={w.label} label={`${w.label} ${w.expired ? 'expired' : fmtDateShort(w.date)}`} tone={w.expired ? 'danger' : 'warning'} />
                  ))}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </AdminScreen>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...shadowSoft,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.md,
  },
});
