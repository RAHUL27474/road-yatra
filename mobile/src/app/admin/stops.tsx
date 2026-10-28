import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminStop, getOptions, useAdmin } from '../../admin/api';
import { AdminScreen, GroupLabel, HeaderAction, NumField, Panel, Pill, runAction, ToggleRow, TwoCol } from '../../admin/components';
import { colors, spacing, type } from '../../theme';
import { Button, Chip, ErrorBanner, Input, SkeletonList } from '../../ui';

type Draft = {
  id?: string;
  city: string;
  name: string;
  address: string;
  landmark: string;
  lat: string;
  lng: string;
  sortOrder: string;
  active: boolean;
};

const toDraft = (s: AdminStop): Draft => ({
  id: s.id,
  city: s.city,
  name: s.name,
  address: s.address ?? '',
  landmark: s.landmark ?? '',
  lat: s.lat != null ? String(s.lat) : '',
  lng: s.lng != null ? String(s.lng) : '',
  sortOrder: String(s.sortOrder ?? 0),
  active: s.active,
});

export default function AdminStops() {
  const { data, error, refreshing, refresh, reload } = useAdmin<{
    stops: AdminStop[];
    cities: string[];
  }>('/api/admin/stops');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [city, setCity] = useState('ALL');
  const grouped = useMemo(() => {
    const m = new Map<string, AdminStop[]>();
    for (const s of data?.stops ?? []) if (city === 'ALL' || s.city === city) m.set(s.city, [...(m.get(s.city) ?? []), s]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data, city]);
  const stopCities = useMemo(() => [...new Set((data?.stops ?? []).map((s) => s.city))].sort(), [data]);

  return (
    <AdminScreen
      title="Pickup points"
      subtitle={data ? `${data.stops.length} points in ${stopCities.length} cities` : 'Loading…'}
      right={
        <HeaderAction
          icon="add"
          label="Add pickup point"
          onPress={() =>
            setDraft({
              city: city === 'ALL' ? '' : city,
              name: '',
              address: '',
              landmark: '',
              lat: '',
              lng: '',
              sortOrder: '0',
              active: true,
            })
          }
        />
      }
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            <Chip label="All cities" selected={city === 'ALL'} onPress={() => setCity('ALL')} />
            {stopCities.map((c) => (
              <Chip key={c} label={c} selected={city === c} onPress={() => setCity(c)} />
            ))}
          </ScrollView>
          {grouped.map(([c, stops]) => (
            <View key={c}>
              <GroupLabel>{`${c} (${stops.length})`}</GroupLabel>
              <Panel flush>
                {stops.map((s, i) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setDraft(toDraft(s))}
                    style={({ pressed }) => [st.row, i < stops.length - 1 && st.border, pressed && { backgroundColor: colors.surface }]}
                  >
                    <View style={[st.pin, !s.active && { backgroundColor: colors.background }]}>
                      <Ionicons name="location" size={18} color={s.active ? colors.danger : colors.textSubtle} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={type('sm', 'bold', s.active ? colors.text : colors.textSubtle)} numberOfLines={1}>
                        {s.name}
                      </Text>
                      <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={2}>
                        {[s.address, s.landmark].filter(Boolean).join(' · ') || 'No address'}
                      </Text>
                    </View>
                    {!s.active ? <Pill label="Off" tone="danger" /> : null}
                    {s.lat != null && s.lng != null ? (
                      <Pressable
                        onPress={() => Linking.openURL(`https://maps.google.com/?q=${s.lat},${s.lng}`).catch(() => {})}
                        hitSlop={6}
                        accessibilityLabel="Open on map"
                      >
                        <Ionicons name="map-outline" size={18} color={colors.brand} />
                      </Pressable>
                    ) : null}
                  </Pressable>
                ))}
              </Panel>
            </View>
          ))}
        </ScrollView>
      )}
      {draft ? (
        <StopSheet
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
function StopSheet({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const [cities, setCities] = useState<string[]>([]);
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
    if (!d.city.trim() || !d.name.trim()) return Alert.alert('Missing details', 'City and point name are required.');
    setSaving(true);
    const r = await runAction('saveStop', {
      ...(d.id ? { id: d.id, active: d.active } : {}),
      city: d.city.trim(),
      name: d.name.trim(),
      address: d.address,
      landmark: d.landmark,
      lat: d.lat,
      lng: d.lng,
      sortOrder: Number(d.sortOrder) || 0,
    });
    setSaving(false);
    if (r) onSaved();
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.bg}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        <View style={st.sheet}>
          <Text style={type('lg', 'bold')}>{d.id ? 'Edit pickup point' : 'Add pickup point'}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 540, marginTop: spacing.md }}>
            <Input label="City" value={d.city} onChangeText={set('city')} autoCapitalize="words" />
            {!d.id ? (
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
                  <Chip key={c} label={c} selected={d.city === c} onPress={() => set('city')(c)} />
                ))}
              </ScrollView>
            ) : null}
            <Input label="Point name" value={d.name} onChangeText={set('name')} placeholder="Khatima Bus Stand" />
            <Input label="Address" value={d.address} onChangeText={set('address')} />
            <Input label="Landmark" value={d.landmark} onChangeText={set('landmark')} placeholder="Opposite SBI ATM" />
            <TwoCol>
              <NumField label="Latitude" value={d.lat} onChange={set('lat')} decimal />
              <NumField label="Longitude" value={d.lng} onChange={set('lng')} decimal />
            </TwoCol>
            <NumField label="Sort order (lower first)" value={d.sortOrder} onChange={set('sortOrder')} />
            {d.id ? <ToggleRow label="Active" sub="Inactive points are hidden from passengers" value={d.active} onChange={set('active')} last /> : null}
          </ScrollView>
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              marginTop: spacing.md,
            }}
          >
            <Button title="Cancel" variant="outline" size="md" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save" variant="secondary" size="md" onPress={save} loading={saving} style={{ flex: 1 }} />
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
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: colors.border,
  },
  pin: {
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
