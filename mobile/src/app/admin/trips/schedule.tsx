import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { AdminTrip, DriverBrief, RouteBrief, toIstLocal, useAdmin, VehicleBrief } from '../../../admin/api';
import { AdminScreen, GroupLabel, NumField, Panel, runAction, TwoCol } from '../../../admin/components';
import { DateTimeField } from '../../../DateTimeField';
import { fmtDuration } from '../../../format';
import { spacing } from '../../../theme';
import { BottomBar, Button, ErrorBanner, Input, Notice, OptionSheet, SelectRow, SkeletonList } from '../../../ui';

type Resp = {
  trips: AdminTrip[];
  routes: RouteBrief[];
  vehicles: VehicleBrief[];
  drivers: DriverBrief[];
  today: string;
};
type Pick = null | 'route' | 'vehicle' | 'driver';

/** Tomorrow 06:00 India time. */
const defaultStart = () => {
  const d = new Date(Date.now() + 86_400_000);
  return new Date(`${toIstLocal(d).slice(0, 10)}T06:00:00+05:30`);
};

export default function ScheduleTrips() {
  const { data, error, reload } = useAdmin<Resp>('/api/admin/trips');
  const [pick, setPick] = useState<Pick>(null);
  const [routeId, setRouteId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [start, setStart] = useState(defaultStart);
  const [days, setDays] = useState('7');
  const [fare, setFare] = useState('800');
  const [boardingPoint, setBoardingPoint] = useState('Please reach your pickup point 10 minutes early.');
  const [saving, setSaving] = useState(false);

  const route = data?.routes.find((r) => r.id === routeId);
  const vehicle = data?.vehicles.find((v) => v.id === vehicleId);
  const driver = data?.drivers.find((d) => d.id === driverId);

  const save = async () => {
    if (!routeId || !vehicleId) return Alert.alert('Missing details', 'Choose a route and a vehicle.');
    if (!(Number(fare) > 0)) return Alert.alert('Missing details', 'Enter the fare per seat.');
    const n = Math.min(90, Math.max(1, Number(days) || 1));
    const local = toIstLocal(start);
    setSaving(true);
    const r = await runAction('scheduleTrips', {
      routeId,
      vehicleId,
      driverId,
      startDate: local.slice(0, 10),
      time: local.slice(11, 16),
      days: n,
      fare: Number(fare),
      boardingPoint,
    });
    setSaving(false);
    if (!r) return;
    Alert.alert(
      'Trips scheduled',
      `${r.created ?? 0} trip${r.created === 1 ? '' : 's'} created.${r.skipped ? ` ${r.skipped} day(s) skipped: the vehicle or driver was busy, or the time had passed.` : ''}`,
      [{ text: 'OK', onPress: () => router.back() }],
    );
  };

  return (
    <AdminScreen title="Schedule trips" subtitle="Daily departures on a route">
      {!data ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorBanner message={error} onRetry={reload} />
          <SkeletonList count={3} style={{ padding: 0 }} />
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
            <GroupLabel style={{ marginTop: 0 }}>Route and vehicle</GroupLabel>
            <Panel style={{ paddingVertical: spacing.sm }}>
              <SelectRow
                label="Route"
                icon="git-commit-outline"
                value={route ? `${route.fromCity} → ${route.toCity}` : ''}
                placeholder="Choose a route"
                onPress={() => setPick('route')}
              />
              <SelectRow
                label="Vehicle"
                icon="car-outline"
                value={vehicle ? `${vehicle.name} · ${vehicle.regNumber}` : ''}
                placeholder="Choose a vehicle"
                onPress={() => setPick('vehicle')}
              />
              <SelectRow
                label="Driver (optional)"
                icon="person-outline"
                value={driver ? driver.name : ''}
                placeholder="Assign later"
                onPress={() => setPick('driver')}
              />
            </Panel>
            {route ? (
              <Notice tone="info" style={{ marginTop: spacing.sm }}>
                {`${route.distanceKm} km · about ${fmtDuration(route.durationMins)} per trip`}
              </Notice>
            ) : null}

            <GroupLabel>When</GroupLabel>
            <Panel>
              <DateTimeField label="First departure" mode="datetime" value={start} onChange={setStart} minimumDate={new Date()} icon="time-outline" />
              <TwoCol>
                <NumField label="Number of days (1–90)" value={days} onChange={setDays} />
                <NumField label="Fare per seat" prefix="₹" value={fare} onChange={setFare} />
              </TwoCol>
              <Input label="Note for passengers" value={boardingPoint} onChangeText={setBoardingPoint} multiline containerStyle={{ marginBottom: 0 }} />
            </Panel>
            <Notice tone="info" style={{ marginTop: spacing.md }}>
              One trip is created per day at the same time. Days when the vehicle or driver is already busy are skipped.
            </Notice>
          </ScrollView>
          <BottomBar caption="Creates up to" note={`${Math.min(90, Math.max(1, Number(days) || 1))} daily trips`}>
            <Button title="Schedule" icon="calendar" onPress={save} loading={saving} />
          </BottomBar>
        </KeyboardAvoidingView>
      )}
      <OptionSheet
        visible={pick === 'route'}
        title="Route"
        icon="git-commit-outline"
        value={routeId}
        options={(data?.routes ?? []).map((r) => ({
          key: r.id,
          label: `${r.fromCity} → ${r.toCity}`,
          sub: `${r.distanceKm} km · ${fmtDuration(r.durationMins)}`,
        }))}
        onSelect={setRouteId}
        onClose={() => setPick(null)}
      />
      <OptionSheet
        visible={pick === 'vehicle'}
        title="Vehicle"
        icon="car-outline"
        value={vehicleId}
        options={(data?.vehicles ?? []).map((v) => ({
          key: v.id,
          label: v.name,
          sub: `${v.regNumber} · ${v.seats} seats`,
        }))}
        onSelect={setVehicleId}
        onClose={() => setPick(null)}
      />
      <OptionSheet
        visible={pick === 'driver'}
        title="Driver"
        icon="person-outline"
        value={driverId}
        options={[
          { key: '', label: 'Assign later' },
          ...(data?.drivers ?? []).map((d) => ({
            key: d.id,
            label: d.name,
            sub: d.phone,
          })),
        ]}
        onSelect={setDriverId}
        onClose={() => setPick(null)}
      />
    </AdminScreen>
  );
}
