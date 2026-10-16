// Checks the passenger's bookings while the app is closed (Android decides the exact time, roughly every
// 15 minutes) and notifies about changes. Defined at module scope and imported from the root layout so the
// task exists when the OS wakes the app.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { api, Booking, setAuthToken } from './api';
import { cacheBookings } from './cache';
import { checkBookingUpdates, syncTripReminders } from './notifications';
import * as storage from './storage';

export const BOOKING_CHECK_TASK = 'ry-booking-check';
export const TOKEN_KEY = 'ry_token';

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(BOOKING_CHECK_TASK)) {
  TaskManager.defineTask(BOOKING_CHECK_TASK, async () => {
    try {
      const token = await storage.getItem(TOKEN_KEY);
      if (!token) return BackgroundTask.BackgroundTaskResult.Success;
      setAuthToken(token);
      const { bookings } = await api<{ bookings: Booking[] }>('/api/bookings');
      await cacheBookings(bookings);
      await checkBookingUpdates(bookings);
      await syncTripReminders(bookings);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function startBookingChecks() {
  if (Platform.OS === 'web') return;
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(BOOKING_CHECK_TASK))) await BackgroundTask.registerTaskAsync(BOOKING_CHECK_TASK, { minimumInterval: 15 });
  } catch (e) {
    console.warn('Background booking check unavailable:', e);
  }
}

export async function stopBookingChecks() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BOOKING_CHECK_TASK)) await BackgroundTask.unregisterTaskAsync(BOOKING_CHECK_TASK);
  } catch {}
}
