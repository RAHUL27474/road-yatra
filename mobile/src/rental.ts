import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errorMessage, QuoteResponse, RentalRequest, RentalType } from './api';
import { rentalCache, sameRequest } from './store';

/** Reads the rental request back out of the route params. */
export function useRentalRequest(): RentalRequest {
  const p = useLocalSearchParams<{ rentalType: RentalType; pickupCity: string; dropCity?: string; startAt: string; returnAt?: string }>();
  return useMemo(
    () => ({
      rentalType: p.rentalType,
      pickupCity: p.pickupCity,
      startAt: p.startAt,
      ...(p.dropCity ? { dropCity: p.dropCity } : {}),
      ...(p.returnAt ? { returnAt: p.returnAt } : {}),
    }),
    [p.rentalType, p.pickupCity, p.dropCity, p.startAt, p.returnAt],
  );
}

/** Returns the cached quote for this request, or fetches a fresh one. */
export function useQuote(req: RentalRequest) {
  const [data, setData] = useState<QuoteResponse | null>(sameRequest(rentalCache.req, req) ? rentalCache.data : null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setError(null);
    try {
      const d = await api<QuoteResponse>('/api/rentals/quote', { body: req });
      rentalCache.req = req;
      rentalCache.data = d;
      setData(d);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [req]);
  useEffect(() => {
    if (!data) reload();
  }, [data, reload]);
  return { data, error, reload };
}
