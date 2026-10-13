import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { api, DriverInfo, Duty, DutiesResponse, errorMessage } from './api';
import { useAuth } from './auth';
import { onSharingChange, startLocationSharing, stopLocationSharing } from './location';

type DutiesState = {
  driver: DriverInfo | null;
  duties: Duty[] | null;
  error: string | null;
  sharing: boolean;
  refresh: () => Promise<void>;
};

const DutiesContext = createContext<DutiesState | null>(null);

/** Loads the driver's duties once for all screens, and runs location sharing while any duty is STARTED. */
export function DutiesProvider({ children }: { children: ReactNode }) {
  const { access } = useAuth();
  // Duties only load for approved drivers; applicants never call the duty endpoints.
  const isDriver = access === 'driver';
  const [data, setData] = useState<DutiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setData(await api<DutiesResponse>('/api/driver/duties'));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    if (!isDriver) {
      setData(null);
      setError(null);
      return;
    }
    refresh();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => sub.remove();
  }, [isDriver, refresh]);

  useEffect(() => onSharingChange(setSharing), []);

  const onTrip = isDriver && !!data?.duties.some((d) => d.status === 'STARTED');
  useEffect(() => {
    if (onTrip)
      startLocationSharing().then((ok) => {
        if (!ok) Alert.alert('Location needed', 'Allow location access so passengers and the office can track the vehicle during the trip.');
      }, () => {});
    else stopLocationSharing();
  }, [onTrip]);

  const value = useMemo(
    () => ({ driver: data?.driver ?? null, duties: data?.duties ?? null, error, sharing, refresh }),
    [data, error, sharing, refresh],
  );
  return <DutiesContext.Provider value={value}>{children}</DutiesContext.Provider>;
}

export function useDuties() {
  const ctx = useContext(DutiesContext);
  if (!ctx) throw new Error('useDuties must be used inside DutiesProvider');
  return ctx;
}
