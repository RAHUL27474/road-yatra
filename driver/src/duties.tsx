import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { api, ApiError, DriverInfo, Duty, DutiesResponse, errorMessage } from './api';
import { useAuth } from './auth';
import { startDutyChecks, stopDutyChecks } from './background';
import { onSharingChange, startLocationSharing, stopLocationSharing } from './location';
import { ensureNotifications, notifyNewDuties, remindExpiringDocs, takeNewDuties } from './notifications';
import { flushQueue, onQueueChange, QueuedAction } from './offline';
import { KEYS, load, save } from './storage';

const POLL_MS = 60_000; // while the app is open, check for new duties every minute

type DutiesState = {
  driver: DriverInfo | null;
  duties: Duty[] | null;
  error: string | null;
  /** True when the list on screen is the copy saved on the phone (no network). */
  offline: boolean;
  sharing: boolean;
  /** Actions saved while offline, waiting to be sent. */
  pending: QueuedAction[];
  refresh: () => Promise<void>;
};

const DutiesContext = createContext<DutiesState | null>(null);

/**
 * Loads the driver's duties once for all screens, keeps them fresh (every minute while open, every ~15 min in
 * the background), keeps a copy for offline use, and runs location sharing while any duty is STARTED.
 */
export function DutiesProvider({ children }: { children: ReactNode }) {
  const { access } = useAuth();
  // Duties only load for approved drivers; applicants never call the duty endpoints.
  const isDriver = access === 'driver';
  const [data, setData] = useState<DutiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [pending, setPending] = useState<QueuedAction[]>([]);
  const isDriverRef = useRef(isDriver);
  isDriverRef.current = isDriver;
  const hasData = useRef(false);
  hasData.current = !!data;

  const refresh = useCallback(async () => {
    await flushQueue().catch(() => {});
    try {
      const fresh = await api<DutiesResponse>('/api/driver/duties');
      if (!isDriverRef.current) return;
      setData(fresh);
      setError(null);
      setOffline(false);
      save(KEYS.duties, fresh);
      notifyNewDuties(await takeNewDuties(fresh.duties));
      remindExpiringDocs(fresh.driver, fresh.duties);
    } catch (e) {
      // No network: keep showing what we have (or the saved copy) and say so.
      if (e instanceof ApiError && e.status === 0) {
        setOffline(true);
        if (!hasData.current) {
          const cached = await load<DutiesResponse | null>(KEYS.duties, null);
          if (cached && isDriverRef.current) {
            setData(cached);
            setError(null);
            return;
          }
        } else return; // the offline banner explains; keep the list as it is
      }
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    if (!isDriver) {
      setData(null);
      setError(null);
      setOffline(false);
      stopDutyChecks();
      return;
    }
    // Show the saved copy straight away, then load fresh data.
    load<DutiesResponse | null>(KEYS.duties, null).then((cached) => {
      if (cached && isDriverRef.current) setData((cur) => cur ?? cached);
    });
    ensureNotifications();
    startDutyChecks();
    refresh();
    let timer: ReturnType<typeof setInterval> | null = setInterval(refresh, POLL_MS);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        refresh();
        timer ??= setInterval(refresh, POLL_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    return () => {
      sub.remove();
      if (timer) clearInterval(timer);
    };
  }, [isDriver, refresh]);

  useEffect(() => onSharingChange(setSharing), []);
  useEffect(() => onQueueChange(setPending), []);

  const onTrip = isDriver && !!data?.duties.some((d) => d.status === 'STARTED');
  useEffect(() => {
    if (onTrip)
      startLocationSharing().then((ok) => {
        if (!ok) Alert.alert('Location needed', 'Allow location access so passengers and the office can track the vehicle during the trip.');
      }, () => {});
    else stopLocationSharing();
  }, [onTrip]);

  const value = useMemo(
    () => ({ driver: data?.driver ?? null, duties: data?.duties ?? null, error, offline, sharing, pending, refresh }),
    [data, error, offline, sharing, pending, refresh],
  );
  return <DutiesContext.Provider value={value}>{children}</DutiesContext.Provider>;
}

export function useDuties() {
  const ctx = useContext(DutiesContext);
  if (!ctx) throw new Error('useDuties must be used inside DutiesProvider');
  return ctx;
}
