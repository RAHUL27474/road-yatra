import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Fleet, useAdmin } from '../../admin/api';
import { AdminScreen, GroupLabel, Panel, Pill, runAction, tripTone } from '../../admin/components';
import { fmtDateShort, fmtDuration, fmtTime } from '../../format';
import { colors, spacing, tabular, type } from '../../theme';
import { Chip, ErrorBanner, hapticSelect, Notice, SkeletonList } from '../../ui';

export default function FleetOnRoutes() {
  const { data, error, refreshing, refresh, reload, setData } = useAdmin<Fleet>('/api/admin/fleet');
  const [city, setCity] = useState('ALL');
  const cities = useMemo(() => [...new Set((data?.routes ?? []).map((r) => r.fromCity))].sort(), [data]);
  const vehicleName = (id: string) => data?.vehicles.find((v) => v.id === id);

  const toggle = async (routeId: string, vehicleId: string) => {
    hapticSelect();
    // Flip it on screen straight away; reload puts it back if the server refused.
    setData(
      (d) =>
        d && {
          ...d,
          routes: d.routes.map((r) =>
            r.id !== routeId
              ? r
              : {
                  ...r,
                  vehicles: r.vehicles.map((v) => (v.vehicleId === vehicleId ? { ...v, on: !v.on } : v)),
                },
          ),
        },
    );
    await runAction('toggleRouteVehicle', { routeId, vehicleId });
    reload();
  };

  return (
    <AdminScreen title="Fleet on routes" subtitle="Which vehicle runs where">
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
          <GroupLabel style={{ marginTop: 0 }}>{`On the road now (${data.onRoad.length})`}</GroupLabel>
          <Panel flush>
            {data.onRoad.length === 0 ? (
              <Text style={[type('sm', 'regular', colors.textMuted), { padding: spacing.lg }]}>No vehicle is on a trip right now.</Text>
            ) : (
              data.onRoad.map((o, i) => (
                <View key={o.vehicle.id} style={[st.row, i < data.onRoad.length - 1 && st.border]}>
                  <View
                    style={[
                      st.dot,
                      {
                        backgroundColor: o.location ? colors.success : colors.warning,
                      },
                    ]}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={type('sm', 'bold')} numberOfLines={1}>
                      {o.vehicle.regNumber} · {o.vehicle.name}
                    </Text>
                    <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={2}>
                      {o.what}
                      {o.driverName ? ` · ${o.driverName}` : ''}
                      {o.since ? ` · since ${fmtTime(o.since)}` : ''}
                    </Text>
                    {o.location ? (
                      <Text style={[type('xs', 'medium', colors.success), tabular]}>
                        GPS {fmtTime(o.location.updatedAt)}
                        {o.location.speed != null ? ` · ${Math.round(o.location.speed)} km/h` : ''}
                      </Text>
                    ) : (
                      <Text style={type('xs', 'medium', colors.warning)}>No GPS yet</Text>
                    )}
                  </View>
                  {o.location ? (
                    <Pressable onPress={() => Linking.openURL(o.location!.mapUrl).catch(() => {})} hitSlop={6} style={st.map} accessibilityLabel="Open on map">
                      <Ionicons name="navigate" size={18} color={colors.brand} />
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
          </Panel>

          <GroupLabel>Routes</GroupLabel>
          <Notice tone="info" style={{ marginBottom: spacing.md }}>
            Switch a vehicle off on a route to stop selling it there. Upcoming trips are counted for the next 14 days.
          </Notice>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: spacing.sm,
              paddingBottom: spacing.md,
            }}
          >
            <Chip label="All cities" selected={city === 'ALL'} onPress={() => setCity('ALL')} />
            {cities.map((c) => (
              <Chip key={c} label={`From ${c}`} selected={city === c} onPress={() => setCity(c)} />
            ))}
          </ScrollView>
          {data.routes
            .filter((r) => city === 'ALL' || r.fromCity === city)
            .map((r) => (
              <Panel key={r.id} style={{ marginBottom: spacing.md, paddingBottom: spacing.sm }}>
                <Text style={type('md', 'bold')}>
                  {r.fromCity} → {r.toCity}
                </Text>
                <Text style={type('xs', 'regular', colors.textMuted)}>
                  {r.distanceKm} km · {fmtDuration(r.durationMins)}
                </Text>
                {r.vehicles.map((v, i) => {
                  const veh = vehicleName(v.vehicleId);
                  return (
                    <View key={v.vehicleId} style={[st.vRow, i < r.vehicles.length - 1 && st.border]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={type('sm', 'semibold', v.on ? colors.text : colors.textSubtle)} numberOfLines={1}>
                          {veh ? `${veh.name} · ${veh.regNumber}` : 'Vehicle'}
                        </Text>
                        <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
                          {v.upcomingTrips} upcoming trip
                          {v.upcomingTrips === 1 ? '' : 's'}
                          {v.next ? ` · next ${fmtDateShort(v.next.departAt)} ${fmtTime(v.next.departAt)}` : ''}
                        </Text>
                        {v.today.map((t) => (
                          <Pressable
                            key={t.id}
                            onPress={() => router.push(`/admin/trips/${t.id}`)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 4,
                            }}
                          >
                            <Text style={[type('xs', 'bold', colors.brand), tabular]}>Today {fmtTime(t.departAt)}</Text>
                            <Text style={type('xs', 'regular', colors.textMuted)}>
                              {t.seatsTaken} sold · {t.driverName ?? 'no driver'}
                            </Text>
                            <Pill label={t.status} tone={tripTone(t.status)} />
                          </Pressable>
                        ))}
                      </View>
                      <Switch
                        value={v.on}
                        onValueChange={() => toggle(r.id, v.vehicleId)}
                        trackColor={{
                          true: colors.brand,
                          false: colors.border,
                        }}
                        thumbColor={colors.white}
                      />
                    </View>
                  );
                })}
              </Panel>
            ))}
        </ScrollView>
      )}
    </AdminScreen>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  map: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
});
