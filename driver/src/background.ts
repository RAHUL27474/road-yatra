// Checks for new duties while the app is closed. Android runs it roughly every 15 minutes (the OS decides
// the exact time, and may delay it on battery saver). Must be defined at module scope: it is imported from
// the root layout so the task exists when the OS wakes the app.
import * as BackgroundTask from 'expo-background-task';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { api, DutiesResponse, setAuthToken, TOKEN_KEY } from './api';
import { notifyNewDuties, remindExpiringDocs, takeNewDuties } from './notifications';
import { flushQueue } from './offline';
import { KEYS, save } from './storage';

export const DUTY_CHECK_TASK = 'ry-driver-duty-check';

if (!TaskManager.isTaskDefined(DUTY_CHECK_TASK)) {
  TaskManager.defineTask(DUTY_CHECK_TASK, async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) return BackgroundTask.BackgroundTaskResult.Success;
      // The OS may start the app only to run this task: no React tree, so set the token for every request
      // (including the offline-queue flush below).
      setAuthToken(token);
      const data = await api<DutiesResponse>('/api/driver/duties', { token });
      await save(KEYS.duties, data);
      await notifyNewDuties(await takeNewDuties(data.duties));
      await remindExpiringDocs(data.driver, data.duties);
      await flushQueue().catch(() => {});
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Turns the background check on (idempotent). Fails quietly where background tasks aren't available. */
export async function startDutyChecks() {
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(DUTY_CHECK_TASK))) await BackgroundTask.registerTaskAsync(DUTY_CHECK_TASK, { minimumInterval: 15 });
  } catch (e) {
    console.warn('Background duty check unavailable:', e);
  }
}

export async function stopDutyChecks() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(DUTY_CHECK_TASK)) await BackgroundTask.unregisterTaskAsync(DUTY_CHECK_TASK);
  } catch {}
}
