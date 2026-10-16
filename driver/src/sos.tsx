// Emergency button: alerts the office (SMS + admin dashboard) and the driver's emergency contact with the
// current location, and offers to call 112. Without network it falls back to an SMS from the phone itself.
import * as Location from 'expo-location';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet } from 'react-native';
import { ApiError, getConfig, post } from './api';
import { BRAND } from './brand';
import { colors, fonts, radius } from './theme';
import { haptic, Ionicons, T } from './ui';

async function currentPosition() {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
    if (last) return last.coords;
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), 8_000)),
    ]);
    return fix?.coords ?? null;
  } catch {
    return null;
  }
}

async function sendSos() {
  const pos = await currentPosition();
  const where = pos ? { lat: pos.latitude, lng: pos.longitude } : {};
  try {
    await post('/api/driver/sos', where);
    haptic.success();
    Alert.alert('SOS sent', 'The office has been alerted with your location. Stay safe — call 112 if you are in danger.', [
      { text: 'OK', style: 'cancel' },
      { text: 'Call 112', style: 'destructive', onPress: () => Linking.openURL('tel:112') },
    ]);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 0) throw e;
    // No internet: SMS the office from the phone (needs only mobile signal).
    const office = ((await getConfig().catch(() => null))?.supportPhone || BRAND.phone).replace(/[^\d+]/g, '');
    const map = pos ? ` Location: https://maps.google.com/?q=${pos.latitude},${pos.longitude}` : '';
    Linking.openURL(`sms:${office}?body=${encodeURIComponent(`SOS from JSS Travels driver. Need help urgently.${map}`)}`).catch(() => Linking.openURL('tel:112'));
  }
}

/** Red "SOS" pill for the screen headers. Asks first, so a pocket tap never raises an alarm. */
export function SosButton() {
  const [busy, setBusy] = useState(false);
  const press = () => {
    haptic.heavy();
    Alert.alert('Emergency?', 'Send an SOS alert with your location to the office, or call 112 (police / ambulance).', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call 112', onPress: () => Linking.openURL('tel:112') },
      {
        text: 'Send SOS',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await sendSos();
          } catch (e) {
            Alert.alert('SOS not sent', `${e instanceof Error ? e.message : 'Something went wrong.'}\n\nCall the office or 112 now.`, [
              { text: 'Call 112', style: 'destructive', onPress: () => Linking.openURL('tel:112') },
              { text: 'Close', style: 'cancel' },
            ]);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };
  return (
    <Pressable onPress={press} disabled={busy} style={({ pressed }) => [st.pill, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel="SOS emergency">
      {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Ionicons name="warning" size={18} color={colors.white} />}
      <T style={st.text}>SOS</T>
    </Pressable>
  );
}

const st = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DC2626', borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 40, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  text: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 15, letterSpacing: 1 },
});
