// A traveller per seat (name, WhatsApp, woman) for shared-seat bookings, plus travellers saved on the phone
// from earlier bookings so families and regular students fill the form in one tap.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, radius, spacing, type } from './theme';
import { hapticSelect, Input } from './ui';

export type Traveller = { name: string; phone: string; female: boolean };
export type SeatTraveller = Traveller & { seatNo: number };

const SAVED = 'ry_saved_travellers';
const PINK = '#DB2777';

export async function loadSavedTravellers(): Promise<Traveller[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(SAVED)) ?? '[]') as Traveller[];
  } catch {
    return [];
  }
}

/** Remembers named travellers (newest first, up to 8) for the next booking. */
export async function saveTravellers(list: Traveller[]) {
  const named = list.filter((t) => t.name.trim().length >= 2).map((t) => ({ name: t.name.trim(), phone: t.phone.replace(/\D/g, '').slice(-10), female: t.female }));
  if (!named.length) return;
  const old = await loadSavedTravellers();
  const key = (t: Traveller) => t.name.toLowerCase() + '|' + t.phone;
  const merged = [...named, ...old.filter((o) => !named.some((n) => key(n) === key(o)))].slice(0, 8);
  await AsyncStorage.setItem(SAVED, JSON.stringify(merged)).catch(() => {});
}

/** One card per seat. Seats in `womenOnly` must be a woman (the switch is locked on). */
export function SeatTravellers({ seats, womenOnly, value, onChange }: { seats: number[]; womenOnly: number[]; value: SeatTraveller[]; onChange: (v: SeatTraveller[]) => void }) {
  const [saved, setSaved] = useState<Traveller[]>([]);
  const [target, setTarget] = useState(seats[0]);
  useEffect(() => {
    loadSavedTravellers().then(setSaved);
  }, []);

  const set = (seatNo: number, patch: Partial<Traveller>) => onChange(value.map((t) => (t.seatNo === seatNo ? { ...t, ...patch } : t)));
  const fill = (t: Traveller) => {
    hapticSelect();
    set(target, { name: t.name, phone: t.phone, female: womenOnly.includes(target) || t.female });
    const next = seats[seats.indexOf(target) + 1];
    if (next) setTarget(next);
  };

  return (
    <View style={{ gap: spacing.md }}>
      {saved.length ? (
        <View>
          <Text style={type('xs', 'semibold', colors.textMuted)}>Saved travellers · tap to fill seat {target}</Text>
          <View style={st.chips}>
            {saved.map((t) => (
              <Pressable key={t.name + t.phone} onPress={() => fill(t)} style={({ pressed }) => [st.chip, pressed && { opacity: 0.7 }]} accessibilityRole="button">
                <Ionicons name={t.female ? 'woman' : 'person'} size={14} color={t.female ? PINK : colors.brand} />
                <Text style={type('xs', 'semibold')} numberOfLines={1}>
                  {t.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {value.map((t) => {
        const locked = womenOnly.includes(t.seatNo);
        return (
          <Pressable key={t.seatNo} onPress={() => setTarget(t.seatNo)} style={[st.card, target === t.seatNo && st.cardOn]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <View style={st.seatNo}>
                <Text style={type('sm', 'extrabold', colors.brand)}>{t.seatNo}</Text>
              </View>
              <Text style={[type('sm', 'bold'), { flex: 1 }]}>Seat {t.seatNo}</Text>
              <Ionicons name="woman" size={16} color={t.female ? PINK : colors.textSubtle} />
              <Text style={type('xs', 'semibold', t.female ? PINK : colors.textMuted)}>Woman</Text>
              <Switch
                value={t.female}
                disabled={locked}
                onValueChange={(on) => set(t.seatNo, { female: on })}
                trackColor={{ true: '#F9A8D4', false: colors.border }}
                thumbColor={t.female ? PINK : colors.white}
              />
            </View>
            {locked ? <Text style={[type('xs', 'medium', PINK), { marginBottom: spacing.sm }]}>Next to a woman passenger — this seat is for a woman only.</Text> : null}
            <Input placeholder="Traveller name (optional)" icon="person-outline" value={t.name} onChangeText={(name) => set(t.seatNo, { name })} autoCapitalize="words" containerStyle={{ marginBottom: spacing.sm }} />
            <Input
              placeholder="Their WhatsApp number (optional)"
              icon="logo-whatsapp"
              prefix="+91"
              value={t.phone}
              onChangeText={(phone) => set(t.seatNo, { phone })}
              keyboardType="phone-pad"
              maxLength={13}
              containerStyle={{ marginBottom: 0 }}
            />
          </Pressable>
        );
      })}
      <Text style={type('xs', 'regular', colors.textMuted)}>Travellers with a WhatsApp number get their own ticket, driver details and tracking link.</Text>
    </View>
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 180 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md },
  cardOn: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  seatNo: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
});
