import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { api, errorMessage } from './api';
import { colors, radius, spacing, type } from './theme';
import { Button } from './ui';

const SEND_EVERY_MS = 20_000;

/**
 * "Share my live location" around pickup time: the driver sees where the passenger is until they board.
 * Sends the phone's position every ~20 s while this screen is open (no background tracking), and clears it on stop.
 */
export function ShareLiveLocation({ bookingId, active }: { bookingId: string; active: boolean }) {
  const [sharing, setSharing] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const lastPost = useRef(0);

  const unwatch = () => {
    sub.current?.remove();
    sub.current = null;
  };
  useEffect(() => unwatch, []);
  // Boarded / trip started / window over: stop quietly.
  useEffect(() => {
    if (!active && sharing) {
      unwatch();
      setSharing(false);
    }
  }, [active, sharing]);

  const send = async (lat: number, lng: number) => {
    lastPost.current = Date.now();
    try {
      await api(`/api/bookings/${bookingId}/location`, { body: { lat, lng } });
      setLastSent(new Date());
    } catch (e) {
      setError(errorMessage(e));
      unwatch();
      setSharing(false);
    }
  };

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('Location permission is needed to share where you are.');
      if (!(await Location.hasServicesEnabledAsync())) throw new Error('Turn on Location (GPS) on your phone and try again.');
      lastPost.current = 0;
      sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 0 }, (p) => {
        if (Date.now() - lastPost.current >= SEND_EVERY_MS) send(p.coords.latitude, p.coords.longitude);
      });
      setSharing(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    unwatch();
    setSharing(false);
    setLastSent(null);
    await api(`/api/bookings/${bookingId}/location`, { method: 'DELETE' }).catch(() => {});
  };

  if (!active) return null;
  return (
    <View style={{ backgroundColor: colors.brandLight, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="navigate-circle" size={24} color={colors.brand} />
        <View style={{ flex: 1 }}>
          <Text style={type('sm', 'bold', colors.text)}>Help the driver find you</Text>
          <Text style={type('xs', 'regular', colors.textMuted)}>Shares your live location with the driver until you board, while this screen is open.</Text>
        </View>
      </View>
      {sharing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text style={type('xs', 'bold', colors.success)}>
            ● Sharing live{lastSent ? ` · sent ${lastSent.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : ' · finding you…'}
          </Text>
          <Button title="Stop sharing" icon="stop-circle-outline" variant="ghost" size="md" onPress={stop} />
        </View>
      ) : (
        <Button title="Share my live location" icon="navigate-outline" size="md" loading={busy} onPress={start} />
      )}
      {error ? <Text style={type('xs', 'medium', colors.danger)}>{error}</Text> : null}
    </View>
  );
}
