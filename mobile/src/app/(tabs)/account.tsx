import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL, Config, getConfig } from '../../api';
import { useAuth } from '../../auth';
import { LogoMark } from '../../brand';
import { colors, radius, shadowSoft, spacing, tabular, type } from '../../theme';
import { Button, ListRow, Loading, Notice, Screen } from '../../ui';

/** "100% refund if cancelled 24+ hours before departure, 50% if 2+ hours before." */
function cancellationPolicy(config: Config) {
  const parts = [...config.cancellationSlabs]
    .sort((a, b) => b.minHoursBefore - a.minHoursBefore)
    .filter((sl) => sl.refundPercent > 0)
    .map((sl) => `${sl.refundPercent}% refund if cancelled ${sl.minHoursBefore}+ hours before departure`);
  return parts.length ? `Cancellation: ${parts.join('; ')}.` : 'Bookings are non-refundable once confirmed.';
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

export default function Account() {
  const { user, ready, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {});
  }, []);

  if (!ready) return <Loading />;

  const call = () => config && Linking.openURL(`tel:${config.supportPhone.replace(/[^\d+]/g, '')}`).catch(() => {});
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
              <QuickAction icon="headset-outline" label="Support" onPress={config ? call : undefined} />
            </View>
          ) : (
            <View style={[st.card, { alignItems: 'center', padding: spacing.xl }]}>
              <LogoMark size={56} />
              <Text style={[type('lg', 'bold'), { marginTop: spacing.md }]}>Welcome to Road Yatra</Text>
              <Text style={[type('sm', 'regular', colors.textMuted), { textAlign: 'center', marginTop: 4, marginBottom: spacing.lg }]}>
                Log in to book seats, hire a cab and keep your tickets in one place.
              </Text>
              <Button title="Log in" onPress={() => router.push('/login')} />
              <Button title="Create account" variant="outline" onPress={() => router.push('/register')} style={{ marginTop: spacing.sm }} />
            </View>
          )}

          {user?.role === 'DRIVER' ? (
            <Notice tone="warning" icon="car-sport-outline">
              This is a driver account. Please use the Road Yatra Driver app for your duties.
            </Notice>
          ) : null}

          <Text style={st.group}>HELP & INFORMATION</Text>
          <View style={[st.card, { padding: 0, overflow: 'hidden' }]}>
            <ListRow
              icon="call-outline"
              title="Help & support"
              subtitle={config ? `Call us on ${config.supportPhone}` : "Support details unavailable (can't reach the server)."}
              tone="success"
              onPress={config ? call : undefined}
            />
            <ListRow
              icon="shield-checkmark-outline"
              title="Cancellation policy"
              subtitle={config ? 'Refunds and charges' : undefined}
              tone="warning"
              onPress={config ? () => Alert.alert('Cancellation policy', cancellationPolicy(config)) : undefined}
            />
            <ListRow
              icon="information-circle-outline"
              title="About Road Yatra"
              subtitle={`Version ${version}`}
              tone="neutral"
              last
              onPress={() => Alert.alert('Road Yatra', `Khatima ↔ Delhi shared taxi seats and full cab hire.\n\nVersion ${version}\nServer: ${API_URL}`)}
            />
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
            Road Yatra · v{version}
          </Text>
        </View>
      </ScrollView>
    </Screen>
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
  group: { ...type('xs', 'bold', colors.textMuted), letterSpacing: 0.6, marginTop: spacing.sm, marginLeft: spacing.xs },
});
