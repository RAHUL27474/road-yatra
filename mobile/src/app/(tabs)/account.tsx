import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL, Config, errorMessage, getConfig } from '../../api';
import { useAuth } from '../../auth';
import { BRAND, Devotional, Emblem, supportPhone, telUrl } from '../../brand';
import { openPage } from '../../store';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../../theme';
import { Button, Input, ListRow, Loading, Notice, Screen } from '../../ui';

/** "100% refund if cancelled 24+ hours before departure, 50% if 2+ hours before." */
function cancellationPolicy(config: Config) {
  const parts = [...config.cancellationSlabs]
    .sort((a, b) => b.minHoursBefore - a.minHoursBefore)
    .filter((sl) => sl.refundPercent > 0)
    .map((sl) => `${sl.refundPercent}% refund if cancelled ${sl.minHoursBefore}+ hours before departure`);
  return parts.length ? `Cancellation: ${parts.join('; ')}.` : 'Bookings are non-refundable once confirmed.';
}

const WHATSAPP_GREEN = '#25D366';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

export default function Account() {
  const { user, ready, logout, updateProfile, deleteAccount } = useAuth();
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState<Config | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setEditing(true);
  };
  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() });
      setEditing(false);
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const askDelete = () =>
    Alert.alert(
      'Delete account?',
      'Your name, mobile number, email and password will be removed and you will be logged out. Past bookings are kept only for our tax records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => deleteAccount().catch((e) => Alert.alert('Could not delete account', errorMessage(e))),
        },
      ],
    );

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {});
  }, []);

  if (!ready) return <Loading />;

  const phone = supportPhone(config?.supportPhone);
  const call = () => Linking.openURL(telUrl(phone)).catch(() => {});
  const callOffice = () => Linking.openURL(telUrl(BRAND.phone)).catch(() => {});
  const whatsapp = () => Linking.openURL(BRAND.whatsapp).catch(() => {});
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={colors.brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 56 }}
        >
          <View style={st.decor} />
          <Text style={type('lg', 'bold', colors.white)}>Account</Text>
          {user ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg }}>
              <View style={st.avatar}>
                <Text style={type('xl', 'extrabold', colors.brand)}>{initials(user.name)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={type('xl', 'extrabold', colors.white)} numberOfLines={1}>
                  {user.name}
                </Text>
                <Text style={[type('sm', 'medium', colors.onBrandMuted), tabular]} numberOfLines={1}>
                  +91 {user.phone}
                  {user.email ? ` · ${user.email}` : ''}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[type('sm', 'medium', colors.onBrandMuted), { marginTop: 2 }]}>Manage your trips, tickets and support</Text>
          )}
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -40, gap: spacing.md }}>
          {user ? (
            <View style={st.stats}>
              <QuickAction icon="ticket-outline" label="My bookings" onPress={() => router.navigate('/bookings')} />
              <View style={st.statSep} />
              <QuickAction icon="search-outline" label="Book a trip" onPress={() => router.navigate('/')} />
              <View style={st.statSep} />
              <QuickAction icon="headset-outline" label="Support" onPress={call} />
            </View>
          ) : (
            <View style={[st.card, { alignItems: 'center', padding: spacing.xl }]}>
              <Emblem size={64} />
              <Devotional size={12} color={colors.accent} style={{ marginTop: spacing.md }} />
              <Text style={[type('lg', 'bold'), { textAlign: 'center' }]}>Welcome to {BRAND.name}</Text>
              <Text style={[type('sm', 'regular', colors.textMuted), { textAlign: 'center', marginTop: 4, marginBottom: spacing.lg }]}>
                Log in to book seats, hire a cab and keep your tickets in one place.
              </Text>
              <Button title="Log in" onPress={() => router.push('/login')} />
              <Button title="Create account" variant="outline" onPress={() => router.push('/register')} style={{ marginTop: spacing.sm }} />
            </View>
          )}

          {user && editing ? (
            <View style={st.card}>
              <Text style={[type('md', 'bold'), { marginBottom: spacing.md }]}>Edit profile</Text>
              <Input label="Name" icon="person-outline" value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" />
              <Input
                label="Email (optional)"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[type('xs', 'regular', colors.textMuted), { marginTop: -spacing.sm, marginBottom: spacing.md }]}>
                Your mobile number (+91 {user.phone}) is your login and can't be changed here.
              </Text>
              <Button title="Save" icon="checkmark" onPress={saveProfile} loading={saving} disabled={name.trim().length < 2} />
              <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} style={{ marginTop: spacing.xs }} />
            </View>
          ) : null}

          {user?.role === 'DRIVER' ? (
            <Notice tone="warning" icon="car-sport-outline">
              This is a driver account. Please use the JSS Travels Driver app for your duties.
            </Notice>
          ) : null}

          <Text style={st.group}>HELP & INFORMATION</Text>
          <View style={[st.card, { padding: 0, overflow: 'hidden' }]}>
            <ListRow
              icon="call-outline"
              title="Help & support"
              subtitle={`Call us on ${phone} · 24×7`}
              tone="success"
              onPress={call}
            />
            <ListRow
              icon="shield-checkmark-outline"
              title="Cancellation policy"
              subtitle={config ? 'Refunds and charges' : undefined}
              tone="warning"
              onPress={config ? () => Alert.alert('Cancellation policy', cancellationPolicy(config)) : undefined}
            />
            <ListRow icon="star-outline" title="Give feedback" subtitle="Rate us in one tap" tone="warning" onPress={() => router.push('/feedback')} />
            <ListRow icon="document-text-outline" title="Terms & cancellation" tone="brand" onPress={() => openPage(`${API_URL}/terms`)} />
            <ListRow icon="lock-closed-outline" title="Privacy policy" tone="brand" onPress={() => openPage(`${API_URL}/privacy`)} />
            <ListRow
              icon="information-circle-outline"
              title="App information"
              subtitle={`Version ${version}`}
              tone="neutral"
              last
              onPress={() => Alert.alert(BRAND.short, `${BRAND.name}\nShared taxi seats and full cab hire.\n\nVersion ${version}`)}
            />
          </View>

          {user ? (
            <>
              <Text style={st.group}>MY ACCOUNT</Text>
              <View style={[st.card, { padding: 0, overflow: 'hidden' }]}>
                <ListRow icon="create-outline" title="Edit profile" subtitle="Name and email" tone="brand" onPress={startEdit} />
                <ListRow icon="trash-outline" title="Delete account" subtitle="Remove your account and personal details" tone="danger" last onPress={askDelete} />
              </View>
            </>
          ) : null}

          <Text style={st.group}>ABOUT US</Text>
          <View style={st.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Emblem size={52} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Devotional size={11} color={colors.accent} />
                <Text style={type('md', 'extrabold', colors.brandDark)} numberOfLines={2}>
                  {BRAND.name}
                </Text>
                <Text style={type('xs', 'medium', colors.textMuted)} numberOfLines={1}>
                  {BRAND.tagline}
                </Text>
              </View>
            </View>
            <Text style={[type('sm', 'regular', colors.textMuted), { marginTop: spacing.md }]}>
              Daily shared taxi from ₹800 per person, plus one-way and round-trip cabs, 24×7. Khatima ⇄ Delhi, Khatima ⇄ Haridwar and hill
              stations (Nainital, Mussoorie, Rishikesh, Auli).
            </Text>
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <AboutLine icon="location-outline" text={BRAND.address} />
              <AboutLine icon="person-outline" text={`Proprietor: ${BRAND.proprietor}`} />
              <AboutLine icon="document-text-outline" text={`GSTIN: ${BRAND.gstin}`} />
              <AboutLine icon="mail-outline" text={BRAND.email} onPress={() => Linking.openURL(`mailto:${BRAND.email}`).catch(() => {})} />
              <AboutLine icon="globe-outline" text={BRAND.website} onPress={() => Linking.openURL(`https://${BRAND.website}`).catch(() => {})} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <Pressable
                onPress={callOffice}
                style={({ pressed }) => [st.aboutBtn, { backgroundColor: colors.brand }, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={`Call ${BRAND.phone}`}
              >
                <Ionicons name="call" size={16} color={colors.white} />
                <Text style={type('sm', 'bold', colors.white)}>Call</Text>
              </Pressable>
              <Pressable
                onPress={whatsapp}
                style={({ pressed }) => [st.aboutBtn, { backgroundColor: WHATSAPP_GREEN }, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel="Chat on WhatsApp"
              >
                <MaterialCommunityIcons name="whatsapp" size={18} color={colors.white} />
                <Text style={type('sm', 'bold', colors.white)}>WhatsApp</Text>
              </Pressable>
            </View>
            <Text style={[type('xs', 'medium', colors.textMuted), tabular, { textAlign: 'center', marginTop: spacing.sm }]}>
              {BRAND.phone} · {BRAND.contactPerson}
            </Text>
          </View>

          {user ? (
            <Button
              title="Log out"
              variant="dangerOutline"
              icon="log-out-outline"
              onPress={() =>
                Alert.alert('Log out?', '', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log out', style: 'destructive', onPress: logout },
                ])
              }
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
          <Text style={[type('xs', 'regular', colors.textSubtle), { textAlign: 'center', marginTop: spacing.sm }]} numberOfLines={1}>
            {BRAND.short} · v{version}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

type AboutIcon = 'location-outline' | 'person-outline' | 'document-text-outline' | 'mail-outline' | 'globe-outline';

function AboutLine({ icon, text, onPress }: { icon: AboutIcon; text: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'link' : undefined}
      style={({ pressed }) => [{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={16} color={colors.brand} style={{ marginTop: 1 }} />
      <Text style={[type('sm', onPress ? 'semibold' : 'medium', onPress ? colors.brand : colors.text), { flex: 1 }]}>{text}</Text>
    </Pressable>
  );
}

function QuickAction({ icon, label, onPress }: { icon: 'ticket-outline' | 'search-outline' | 'headset-outline'; label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: spacing.md }, pressed && { opacity: 0.6 }]}
    >
      <View style={st.qaIcon}>
        <Ionicons name={icon} size={20} color={colors.brand} />
      </View>
      <Text style={type('xs', 'semibold')} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  decor: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.06)', top: -80, right: -60 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, ...shadowSoft },
  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.card, paddingHorizontal: spacing.sm, ...shadowSoft },
  statSep: { width: 1, height: 36, backgroundColor: colors.border },
  qaIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  aboutBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.pill },
  group: { ...type('xs', 'bold', colors.textMuted), letterSpacing: 0.6, marginTop: spacing.sm, marginLeft: spacing.xs },
});
