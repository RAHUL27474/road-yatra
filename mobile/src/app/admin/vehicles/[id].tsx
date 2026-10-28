import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { AdminVehicle, getOptions, isoToYmd } from '../../../admin/api';
import { AdminScreen, DateField, GroupLabel, NumField, Panel, runAction, ToggleRow, TwoCol } from '../../../admin/components';
import { api, errorMessage } from '../../../api';
import { spacing } from '../../../theme';
import { BottomBar, Button, ErrorBanner, Input, OptionSheet, SelectRow, SkeletonList } from '../../../ui';

/** Form state: numbers kept as text while editing. */
type Form = {
  name: string;
  type: string;
  regNumber: string;
  seats: string;
  seatsPerRow: string;
  aisleAfter: string;
  seatLayout: string;
  amenities: string;
  imageUrl: string;
  allowSeatBooking: boolean;
  allowRental: boolean;
  ratePerKm: string;
  minKmPerDay: string;
  driverAllowance: string;
  localPackage: string;
  airportFare: string;
  tollFactor: string;
  insuranceExpiry: string;
  permitExpiry: string;
  fitnessExpiry: string;
  pucExpiry: string;
  active: boolean;
};

const EMPTY: Form = {
  name: '',
  type: 'ERTIGA',
  regNumber: '',
  seats: '6',
  seatsPerRow: '3',
  aisleAfter: '0',
  seatLayout: '',
  amenities: 'AC,Music,Charging Point',
  imageUrl: '',
  allowSeatBooking: true,
  allowRental: true,
  ratePerKm: '12',
  minKmPerDay: '250',
  driverAllowance: '300',
  localPackage: '2000',
  airportFare: '1500',
  tollFactor: '1',
  insuranceExpiry: '',
  permitExpiry: '',
  fitnessExpiry: '',
  pucExpiry: '',
  active: true,
};

const toForm = (v: AdminVehicle): Form => ({
  name: v.name,
  type: v.type,
  regNumber: v.regNumber,
  seats: String(v.seats),
  seatsPerRow: String(v.seatsPerRow),
  aisleAfter: String(v.aisleAfter),
  seatLayout: v.seatLayout ?? '',
  amenities: v.amenities ?? '',
  imageUrl: v.imageUrl ?? '',
  allowSeatBooking: v.allowSeatBooking,
  allowRental: v.allowRental,
  ratePerKm: String(v.ratePerKm),
  minKmPerDay: String(v.minKmPerDay),
  driverAllowance: String(v.driverAllowance),
  localPackage: String(v.localPackage),
  airportFare: String(v.airportFare),
  tollFactor: String(v.tollFactor),
  insuranceExpiry: isoToYmd(v.insuranceExpiry),
  permitExpiry: isoToYmd(v.permitExpiry),
  fitnessExpiry: isoToYmd(v.fitnessExpiry),
  pucExpiry: isoToYmd(v.pucExpiry),
  active: v.active,
});

export default function VehicleForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [form, setForm] = useState<Form | null>(isNew ? EMPTY : null);
  const [types, setTypes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchVehicle = useCallback(() => {
    getOptions()
      .then((o) => setTypes(o.vehicleTypes))
      .catch(() => {});
    if (!isNew)
      api<{ vehicle: AdminVehicle; vehicleTypes: Record<string, string> }>(`/api/admin/vehicles/${id}`)
        .then((r) => {
          setForm(toForm(r.vehicle));
          setTypes(r.vehicleTypes);
        })
        .catch((e) => setError(errorMessage(e)));
  }, [id, isNew]);
  useEffect(() => fetchVehicle(), [fetchVehicle]);
  const load = () => {
    setError(null);
    fetchVehicle();
  };

  const set =
    <K extends keyof Form>(k: K) =>
    (v: Form[K]) =>
      setForm((f) => f && { ...f, [k]: v });

  const save = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.regNumber.trim()) return Alert.alert('Missing details', 'Name and registration number are required.');
    setSaving(true);
    const num = (s: string) => Number(s) || 0;
    const r = await runAction('saveVehicle', {
      ...(isNew ? {} : { id }),
      ...form,
      seats: num(form.seats),
      seatsPerRow: num(form.seatsPerRow),
      aisleAfter: num(form.aisleAfter),
      ratePerKm: num(form.ratePerKm),
      minKmPerDay: num(form.minKmPerDay),
      driverAllowance: num(form.driverAllowance),
      localPackage: num(form.localPackage),
      airportFare: num(form.airportFare),
      tollFactor: Number(form.tollFactor) || 1,
    });
    setSaving(false);
    if (r) {
      getOptions(true).catch(() => {});
      router.back();
    }
  };

  return (
    <AdminScreen title={isNew ? 'Add vehicle' : form ? form.name : 'Vehicle'} subtitle={isNew ? 'New vehicle' : form?.regNumber}>
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
            <GroupLabel style={{ marginTop: 0 }}>Vehicle</GroupLabel>
            <Panel>
              <Input label="Name" value={form.name} onChangeText={set('name')} placeholder="Maruti Ertiga (7 seater)" />
              <Input
                label="Registration number"
                value={form.regNumber}
                onChangeText={(t) => set('regNumber')(t.toUpperCase())}
                autoCapitalize="characters"
                placeholder="UK06TA1234"
              />
              <SelectRow
                label="Type"
                icon="car-outline"
                value={types[form.type] ?? form.type}
                onPress={() => setPicking(true)}
                style={{
                  marginBottom: spacing.md,
                  marginHorizontal: -spacing.md,
                }}
              />
              <Input label="Amenities (comma separated)" value={form.amenities} onChangeText={set('amenities')} placeholder="AC,Music,Charging Point" />
              <Input
                label="Photo URL (optional)"
                value={form.imageUrl}
                onChangeText={set('imageUrl')}
                autoCapitalize="none"
                keyboardType="url"
                containerStyle={{ marginBottom: 0 }}
              />
            </Panel>

            <GroupLabel>Seats</GroupLabel>
            <Panel>
              <TwoCol>
                <NumField label="Seats for sale" value={form.seats} onChange={set('seats')} />
                <NumField label="Seats per row" value={form.seatsPerRow} onChange={set('seatsPerRow')} />
              </TwoCol>
              <TwoCol>
                <Input
                  label="Row layout (e.g. 1,3,2)"
                  value={form.seatLayout}
                  onChangeText={set('seatLayout')}
                  containerStyle={{ flex: 1 }}
                  keyboardType="numbers-and-punctuation"
                />
                <NumField label="Aisle after" value={form.aisleAfter} onChange={set('aisleAfter')} />
              </TwoCol>
              <ToggleRow label="Sell shared seats" value={form.allowSeatBooking} onChange={set('allowSeatBooking')} />
              <ToggleRow label="Hire as full cab" value={form.allowRental} onChange={set('allowRental')} last />
            </Panel>

            <GroupLabel>Full-cab rates</GroupLabel>
            <Panel>
              <TwoCol>
                <NumField label="Rate per km" prefix="₹" value={form.ratePerKm} onChange={set('ratePerKm')} decimal />
                <NumField label="Min km per day" value={form.minKmPerDay} onChange={set('minKmPerDay')} />
              </TwoCol>
              <TwoCol>
                <NumField label="Driver allowance/day" prefix="₹" value={form.driverAllowance} onChange={set('driverAllowance')} />
                <NumField label="Toll multiplier" value={form.tollFactor} onChange={set('tollFactor')} decimal />
              </TwoCol>
              <TwoCol>
                <NumField label="Local 8 hr / 80 km" prefix="₹" value={form.localPackage} onChange={set('localPackage')} style={{ marginBottom: 0 }} />
                <NumField label="Airport transfer" prefix="₹" value={form.airportFare} onChange={set('airportFare')} style={{ marginBottom: 0 }} />
              </TwoCol>
            </Panel>

            <GroupLabel>Documents (expiry)</GroupLabel>
            <Panel>
              <TwoCol>
                <DateField label="Insurance" value={form.insuranceExpiry} onChange={set('insuranceExpiry')} />
                <DateField label="Permit" value={form.permitExpiry} onChange={set('permitExpiry')} />
              </TwoCol>
              <TwoCol>
                <DateField label="Fitness" value={form.fitnessExpiry} onChange={set('fitnessExpiry')} />
                <DateField label="PUC" value={form.pucExpiry} onChange={set('pucExpiry')} />
              </TwoCol>
            </Panel>

            <GroupLabel>Status</GroupLabel>
            <Panel>
              <ToggleRow label="Active" sub="Inactive vehicles are hidden from customers and schedules" value={form.active} onChange={set('active')} last />
            </Panel>
          </ScrollView>
          <BottomBar caption={isNew ? 'New vehicle' : 'Editing'} note={form.regNumber || undefined}>
            <Button title={isNew ? 'Add vehicle' : 'Save changes'} icon="checkmark" onPress={save} loading={saving} />
          </BottomBar>
        </KeyboardAvoidingView>
      )}
      <OptionSheet
        visible={picking}
        title="Vehicle type"
        icon="car-outline"
        value={form?.type}
        options={Object.entries(types).map(([key, label]) => ({ key, label }))}
        onSelect={(k) => set('type')(k)}
        onClose={() => setPicking(false)}
      />
    </AdminScreen>
  );
}
