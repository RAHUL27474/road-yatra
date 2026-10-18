// Copies of the passenger's bookings kept on the phone, so tickets (QR + OTP) open with no internet
// at the pickup point. Every call swallows storage errors: a lost cache must never break the app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Booking } from './api';

const LIST = 'ry_bookings_cache';
const ONE = (id: string) => `ry_booking_${id}`;

async function read<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function write(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const cachedBookings = () => read<Booking[]>(LIST);
/** The list is the freshest copy (background task, list screen): refresh each ticket's own copy from it too. */
export async function cacheBookings(list: Booking[]) {
  await write(LIST, list);
  await Promise.all(list.map((b) => write(ONE(b.id), b)));
}

/** A single ticket: the detail copy if we have one, else the copy from the list. */
export async function cachedBooking(id: string) {
  return (await read<Booking>(ONE(id))) ?? (await cachedBookings())?.find((b) => b.id === id || b.code === id) ?? null;
}
export const cacheBooking = (b: Booking) => write(ONE(b.id), b);

/** Logout: nothing of this account stays on the phone. */
export async function clearBookingCache() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k === LIST || k === 'ry_saved_travellers' || k.startsWith('ry_booking_') || k.startsWith('ry_notify_'));
    await AsyncStorage.multiRemove(keys);
  } catch {}
}
