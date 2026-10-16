// Boarding, no-show and cash actions keep working with no signal (the Khatima–Delhi highway has dead zones):
// a request that can't reach the server is saved on the phone and sent again when the network is back.
// The server still checks everything (OTP, ownership) when the action arrives.
import { Alert, AppState } from 'react-native';
import { ApiError, post } from './api';
import { KEYS, load, save } from './storage';

export type QueuedAction = {
  id: string;
  path: string;
  body?: unknown;
  /** What the trip screen should show meanwhile. */
  effect: { kind: 'board' | 'noShow' | 'cash'; bookingId: string };
  label: string; // e.g. "Board Ramesh (seat 3)"
  createdAt: number;
};

let queue: QueuedAction[] = [];
let loaded: Promise<void> | null = null;
let flushing: Promise<void> | null = null;
const listeners = new Set<(q: QueuedAction[]) => void>();

const ensureLoaded = () => (loaded ??= load<QueuedAction[]>(KEYS.queue, []).then((q) => void (queue = q)));

function emit() {
  const snapshot = [...queue];
  listeners.forEach((l) => l(snapshot));
  save(KEYS.queue, snapshot);
}

/** Subscribe to the list of actions waiting to be sent. Returns an unsubscribe function. */
export function onQueueChange(l: (q: QueuedAction[]) => void) {
  listeners.add(l);
  ensureLoaded().then(() => l([...queue]));
  return () => void listeners.delete(l);
}

/**
 * POSTs now if possible. With no network the action is queued and `{ queued: true }` is returned;
 * any server answer (success or a real error such as a wrong OTP) behaves exactly like `post`.
 */
export async function postOrQueue<T>(path: string, body: unknown, effect: QueuedAction['effect'], label: string): Promise<{ queued: true } | { queued: false; result: T }> {
  try {
    return { queued: false, result: await post<T>(path, body) };
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 0) throw e;
    await ensureLoaded();
    queue.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, path, body, effect, label, createdAt: Date.now() });
    emit();
    return { queued: true };
  }
}

/**
 * Worth trying again later rather than dropping: no network, not logged in yet (e.g. the background task ran
 * before the token was set), rate limited, or a server/hosting hiccup. Anything else is a real refusal
 * (wrong OTP, already boarded, not your trip...).
 */
const retryLater = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.status === 401 || e.status === 408 || e.status === 429 || e.status >= 500);

/** Sends waiting actions in order. Stops at the first temporary failure; drops (and reports) ones the server refuses. */
export function flushQueue(): Promise<void> {
  flushing ??= (async () => {
    await ensureLoaded();
    const rejected: string[] = [];
    while (queue.length) {
      const a = queue[0];
      try {
        await post(a.path, a.body);
      } catch (e) {
        if (retryLater(e)) break; // keep it for the next try
        rejected.push(`${a.label}: ${e instanceof Error ? e.message : 'failed'}`);
      }
      queue.shift();
      emit();
    }
    // Only tell the driver when they can see it (not from the background task).
    if (rejected.length && AppState.currentState === 'active') Alert.alert('Some offline actions were not accepted', rejected.join('\n\n'));
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** Logout: forget everything still waiting (it belongs to the driver who is leaving). */
export async function clearQueue() {
  await ensureLoaded();
  queue = [];
  emit();
}
