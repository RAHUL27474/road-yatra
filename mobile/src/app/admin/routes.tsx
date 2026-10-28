import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminRoute, getOptions, useAdmin } from '../../admin/api';
import { AdminScreen, GroupLabel, HeaderAction, NumField, Panel, runAction, ToggleRow, TwoCol } from '../../admin/components';
import { fmtDuration, inr } from '../../format';
import { colors, spacing, tabular, type } from '../../theme';
import { Button, Chip, ErrorBanner, Input, SkeletonList } from '../../ui';

type Draft = {
  fromCity: string;
  toCity: string;
  distanceKm: string;
  durationHours: string;
  tollAmount: string;
  parkingAmount: string;
  bothWays: boolean;
};
const EMPTY: Draft = {
  fromCity: '',
  toCity: '',
  distanceKm: '',
  durationHours: '',
  tollAmount: '0',
  parkingAmount: '0',
  bothWays: true,
};

export default function AdminRoutes() {
  const { data, error, refreshing, refresh, reload } = useAdmin<{
    routes: AdminRoute[];
  }>('/api/admin/routes');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [city, setCity] = useState('ALL');
  const cities = useMemo(() => [...new Set((data?.routes ?? []).map((r) => r.fromCity))].sort(), [data]);

  const edit = (r: AdminRoute) =>
    setDraft({
      fromCity: r.fromCity,
      toCity: r.toCity,
      distanceKm: String(r.distanceKm),
      durationHours: String(Math.round((r.durationMins / 60) * 100) / 100),
      tollAmount: String(r.tollAmount),
      parkingAmount: String(r.parkingAmount),
      bothWays: false,
    });

  return (
    <AdminScreen
      title="Routes & fares"
      subtitle={data ? `${data.routes.length} routes` : 'Loading…'}
      right={<HeaderAction icon="add" label="Add route" onPress={() => setDraft(EMPTY)} />}
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: spacing.sm,
              paddingBottom: spacing.md,
            }}
          >
            <Chip label="All" selected={city === 'ALL'} onPress={() => setCity('ALL')} />
            {cities.map((c) => (
              <Chip key={c} label={`From ${c}`} selected={city === c} onPress={() => setCity(c)} />
            ))}
          </ScrollView>
          <Panel flush>
            {data.routes
              .filter((r) => city === 'ALL' || r.fromCity === city)
              .map((r, i, list) => (
                <Pressable
                  key={r.id}
                  onPress={() => edit(r)}
                  style={({ pressed }) => [st.row, i < list.length - 1 && st.border, pressed && { backgroundColor: colors.surface }]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={type('md', 'bold')} numberOfLines={1}>
                      {r.fromCity} → {r.toCity}
                    </Text>
                    <Text style={[type('xs', 'regular', colors.textMuted), tabular]} numberOfLines={1}>
                      {r.distanceKm} km · {fmtDuration(r.durationMins)} · toll {inr(r.tollAmount)} · parking {inr(r.parkingAmount)}
                    </Text>
                    <Text style={type('xs', 'medium', colors.textSubtle)}>{r.trips} trip(s) on record</Text>
                  </View>
                  {r.canDelete ? (
                    <Pressable
                      hitSlop={8}
                      accessibilityLabel={`Delete ${r.fromCity} to ${r.toCity}`}
                      onPress={async () => {
                        const ok = await runAction(
                          'deleteRoute',
                          { id: r.id },
                          {
                            confirm: {
                              title: `Delete ${r.fromCity} → ${r.toCity}?`,
                              ok: 'Delete',
                              destructive: true,
                            },
                          },
                        );
                        if (ok) reload();
                      }}
                      style={st.del}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  ) : null}
                  <Ionicons name="create-outline" size={18} color={colors.textSubtle} />
                </Pressable>
              ))}
          </Panel>
          <Text style={[type('xs', 'regular', colors.textMuted), { textAlign: 'center', marginTop: spacing.md }]}>
            Tap a route to change its distance, time, toll or parking. Routes with trips can&apos;t be deleted.
          </Text>
        </ScrollView>
      )}
      {draft ? (
        <RouteSheet
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            getOptions(true).catch(() => {});
            reload();
          }}
        />
      ) : null}
    </AdminScreen>
  );
}

/** Mounted only while open, so the form starts from `draft` each time. */
function RouteSheet({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const [cities, setCities] = useState<string[]>([]);
  const [pick, setPick] = useState<null | 'from' | 'to'>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getOptions()
      .then((o) => setCities(o.cities))
      .catch(() => {});
  }, []);
  const set =
    <K extends keyof Draft>(k: K) =>
    (v: Draft[K]) =>
      setD((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!d.fromCity.trim() || !d.toCity.trim() || d.fromCity.trim() === d.toCity.trim()) return Alert.alert('Missing details', 'Enter two different cities.');
    if (!(Number(d.distanceKm) > 0) || !(Number(d.durationHours) > 0)) return Alert.alert('Missing details', 'Enter the distance and travel time.');
    setSaving(true);
    const r = await runAction('addRoute', {
      fromCity: d.fromCity.trim(),
      toCity: d.toCity.trim(),
      distanceKm: Number(d.distanceKm),
      durationHours: Number(d.durationHours),
      tollAmount: Number(d.tollAmount) || 0,
      parkingAmount: Number(d.parkingAmount) || 0,
      bothWays: d.bothWays,
    });
    setSaving(false);
    if (r) onSaved();
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.bg}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        <View style={st.sheet}>
          <Text style={type('lg', 'bold')}>{draft === EMPTY ? 'Add route' : 'Edit route'}</Text>
          <Text style={[type('xs', 'regular', colors.textMuted), { marginBottom: spacing.sm }]}>Saving an existing city pair updates it.</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
            <GroupLabel style={{ marginTop: 0 }}>Cities</GroupLabel>
            <TwoCol>
              <Input
                label="From"
                value={d.fromCity}
                onChangeText={set('fromCity')}
                autoCapitalize="words"
                containerStyle={{ flex: 1 }}
                onFocus={() => setPick('from')}
              />
              <Input
                label="To"
                value={d.toCity}
                onChangeText={set('toCity')}
                autoCapitalize="words"
                containerStyle={{ flex: 1 }}
                onFocus={() => setPick('to')}
              />
            </TwoCol>
            {pick ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  gap: spacing.sm,
                  paddingBottom: spacing.md,
                  marginTop: -spacing.sm,
                }}
              >
                {cities.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    selected={(pick === 'from' ? d.fromCity : d.toCity) === c}
                    onPress={() => set(pick === 'from' ? 'fromCity' : 'toCity')(c)}
                  />
                ))}
              </ScrollView>
            ) : null}
            <GroupLabel>Distance and charges</GroupLabel>
            <TwoCol>
              <NumField label="Distance (km)" value={d.distanceKm} onChange={set('distanceKm')} />
              <NumField label="Time (hours)" value={d.durationHours} onChange={set('durationHours')} decimal />
            </TwoCol>
            <TwoCol>
              <NumField label="Toll" prefix="₹" value={d.tollAmount} onChange={set('tollAmount')} />
              <NumField label="Parking" prefix="₹" value={d.parkingAmount} onChange={set('parkingAmount')} />
            </TwoCol>
            <ToggleRow label="Both directions" sub="Also save the return route" value={d.bothWays} onChange={set('bothWays')} last />
          </ScrollView>
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              marginTop: spacing.md,
            }}
          >
            <Button title="Cancel" variant="outline" size="md" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save route" variant="secondary" size="md" onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  del: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bg: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
});
