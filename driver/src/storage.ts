// Small JSON store on the phone (AsyncStorage). Every call swallows storage errors: losing a cache must never break the app.
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function save(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function remove(...keys: string[]) {
  try {
    await AsyncStorage.multiRemove(keys);
  } catch {}
}

export const KEYS = {
  duties: 'ry_duties_cache', // last duties response, shown when offline
  knownDuties: 'ry_known_duties', // duty ids the driver has already been told about
  queue: 'ry_offline_queue', // actions waiting for the network
  docsRemindedOn: 'ry_docs_reminded_on', // YYYY-MM-DD of the last document-expiry reminder
} as const;
