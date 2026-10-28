// Home screen extras: "Book on WhatsApp" and pilgrimage trips (Khatu Shyam ji, Haridwar, Kainchi Dham...).
// Enquiries open WhatsApp with a ready message, because most customers already plan trips there.
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BRAND } from './brand';
import { colors, radius, spacing, type } from './theme';
import { hapticTap } from './ui';

const WHATSAPP_GREEN = '#25D366';

/** wa.me link to the office number (from the server config when set, else the brand number) with a message. */
export function openWhatsApp(text: string, phone?: string) {
  const digits = (phone ?? '').replace(/\D/g, '');
  const base = digits.length >= 10 ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}` : BRAND.whatsapp;
  Linking.openURL(`${base}?text=${encodeURIComponent(text)}`).catch(() => {});
}

export function WhatsAppBookCard({ phone }: { phone?: string }) {
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        openWhatsApp('Namaste, I want to book a trip.\nFrom: \nTo: \nDate: \nSeats / people: ', phone);
      }}
      style={({ pressed }) => [st.wa, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel="Book on WhatsApp"
    >
      <View style={st.waIcon}>
        <MaterialCommunityIcons name="whatsapp" size={28} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type('md', 'bold')}>Book on WhatsApp</Text>
        <Text style={type('xs', 'regular', colors.textMuted)}>Send your route and date — we reply with seats and price.</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
    </Pressable>
  );
}

type Yatra = { name: string; place: string; note: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string };

const YATRAS: Yatra[] = [
  { name: 'Khatu Shyam ji', place: 'Khatu, Sikar (Rajasthan)', note: 'Ekadashi & Phalgun mela trips', icon: 'flower', tint: '#DB2777' },
  { name: 'Haridwar', place: 'Har Ki Pauri, Ganga aarti', note: 'Daily shared taxi + snan dates', icon: 'waves', tint: '#0284C7' },
  { name: 'Kainchi Dham', place: 'Neem Karoli Baba, Nainital', note: 'Day trips from Khatima', icon: 'temple-hindu', tint: '#EA580C' },
  { name: 'Purnagiri', place: 'Maa Purnagiri, Tanakpur', note: 'Navratri special', icon: 'image-filter-hdr', tint: '#16A34A' },
  { name: 'Vrindavan', place: 'Banke Bihari ji, Mathura', note: 'Weekend family trips', icon: 'bell-outline', tint: '#7C3AED' },
];

/** Horizontal cards; tapping opens WhatsApp with a full-cab enquiry for that place. */
export function PilgrimageSection({ phone }: { phone?: string }) {
  return (
    <View>
      <Text style={[type('lg', 'bold'), { marginTop: spacing.xxl, marginBottom: spacing.md }]}>Pilgrimage trips</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
        {YATRAS.map((y) => (
          <Pressable
            key={y.name}
            onPress={() => {
              hapticTap();
              openWhatsApp(`Namaste, I want a full cab for ${y.name} (${y.place}).\nFrom: Khatima\nDate: \nPeople: \nOne way / round trip: `, phone);
            }}
            style={({ pressed }) => [st.yatra, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel={`${y.name} trip enquiry`}
          >
            <View style={st.yatraIcon}>
              <MaterialCommunityIcons name={y.icon} size={24} color={colors.brand} />
            </View>
            <Text style={type('sm', 'extrabold')} numberOfLines={1}>
              {y.name}
            </Text>
            <Text style={type('xs', 'regular', colors.textMuted)} numberOfLines={1}>
              {y.place}
            </Text>
            <Text style={[type('xs', 'semibold', colors.brand), { marginTop: 4 }]} numberOfLines={1}>
              {y.note}
            </Text>
            <View style={st.yatraCta}>
              <MaterialCommunityIcons name="whatsapp" size={14} color={WHATSAPP_GREEN} />
              <Text style={type('xs', 'bold', colors.text)}>Get a quote</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  wa: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  waIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: WHATSAPP_GREEN, alignItems: 'center', justifyContent: 'center' },
  yatra: { width: 168, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  yatraIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  yatraCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
