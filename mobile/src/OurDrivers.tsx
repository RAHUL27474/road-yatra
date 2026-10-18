// "Our drivers" on the home screen: photo and name of each driver the office chose to show.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, API_URL } from './api';
import { colors, radius, shadowSoft, spacing, type } from './theme';

type PublicDriver = { id: string; name: string; photoUrl: string | null; experienceYears: number | null; tripsDone: number };

const photo = (url: string) => (/^https?:\/\//.test(url) ? url : `${API_URL}${url}`);

export function OurDrivers() {
  const [drivers, setDrivers] = useState<PublicDriver[]>([]);
  useEffect(() => {
    api<{ drivers: PublicDriver[] }>('/api/drivers').then((r) => setDrivers(r.drivers), () => {});
  }, []);
  if (!drivers.length) return null;
  return (
    <View>
      <Text style={[type('lg', 'extrabold'), { marginBottom: 2 }]}>Meet our drivers</Text>
      <Text style={[type('xs', 'regular', colors.textMuted), { marginBottom: spacing.sm }]}>Licence-checked and experienced on these routes</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
        {drivers.map((d) => (
          <View key={d.id} style={st.card}>
            {d.photoUrl ? (
              <Image source={{ uri: photo(d.photoUrl) }} style={st.photo} accessibilityLabel={d.name} />
            ) : (
              <View style={[st.photo, { backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={type('xl', 'extrabold', colors.white)}>{d.name.trim()[0]}</Text>
              </View>
            )}
            <Text style={[type('sm', 'bold'), { marginTop: spacing.sm, textAlign: 'center' }]} numberOfLines={1}>
              {d.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <Ionicons name="shield-checkmark" size={12} color={colors.success} />
              <Text style={type('xs', 'semibold', colors.success)}>Verified</Text>
            </View>
            {d.experienceYears || d.tripsDone ? (
              <Text style={[type('xs', 'regular', colors.textMuted), { marginTop: 2, textAlign: 'center' }]} numberOfLines={1}>
                {[d.experienceYears ? `${d.experienceYears} yrs` : null, d.tripsDone ? `${d.tripsDone} trips` : null].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  card: { width: 128, alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md, ...shadowSoft },
  photo: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: colors.brandLight },
});
