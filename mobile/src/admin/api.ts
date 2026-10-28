// Admin (office) API: types and hooks for the /api/admin endpoints. See "## Admin (role ADMIN)" in API.md.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, API_URL, ApiError, Booking, errorMessage, Stop } from '../api';
import { useAuth } from '../auth';
import { TOKEN_KEY } from '../background';
import * as storage from '../storage';

/** The saved login token, for requests outside api() (private images, CSV download). */
export const loadToken = () => storage.getItem(TOKEN_KEY).catch(() => null);

/** Authorization header for private files (driver documents need the admin's token). */
export function useAuthHeaders() {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    loadToken().then((t) => setHeaders(t ? { Authorization: `Bearer ${t}` } : {}));
  }, []);
  return headers;
}

/** Absolute URL for a server path such as /api/files/private/x.jpg. */
export const serverUrl = (path: string) => (/^https?:\/\//.test(path) ? path : API_URL + path);

/** Downloads a text file (the report CSV) with the admin's token. */
export async function fetchText(path: string) {
  const token = await loadToken();
  let res: Response;
  try {
    res = await fetch(serverUrl(path), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_URL}.`);
  }
  if (!res.ok) throw new ApiError(res.status, `Download failed (${res.status})`);
  return res.text();
}

export type DriverBrief = { id: string; name: string; phone: string };
export type RouteBrief = {
  id: string;
  fromCity: string;
  toCity: string;
  distanceKm: number;
  durationMins: number;
};
export type VehicleBrief = {
  id: string;
  name: string;
  regNumber: string;
  seats: number;
  allowSeatBooking?: boolean;
  allowRental?: boolean;
};
export type TripStatus = 'SCHEDULED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
export type DriverResponse = 'ACCEPTED' | 'REJECTED' | null;

export type Stat = {
  key: string;
  label: string;
  value: string;
  amount: number;
  sub: string;
};
export type Sos = {
  id: string;
  createdAt: string;
  driverName: string;
  driverPhone: string;
  vehicleReg: string | null;
  lat: number | null;
  lng: number | null;
  mapUrl: string | null;
};
export type AdminTrip = {
  id: string;
  routeId: string;
  fromCity: string;
  toCity: string;
  departAt: string;
  arriveAt: string;
  fare: number;
  boardingPoint: string;
  status: TripStatus;
  vehicle: { id: string; name: string; regNumber: string; seats: number };
  driver: DriverBrief | null;
  driverResponse: DriverResponse;
  driverNote: string | null;
  seatsTaken: number;
};
export type RentalRow = Booking & {
  vehicleReg: string | null;
  driverId: string | null;
  driverResponse: DriverResponse;
  driverNote: string | null;
};
export type Dashboard = {
  stats: Stat[];
  sos: Sos[];
  pendingDrivers: number;
  alerts: { what: string; date: string; expired: boolean }[];
  todaysTrips: AdminTrip[];
  todaysRentals: RentalRow[];
  recent: Booking[];
};

export type AdminBooking = RentalRow & {
  trackUrl: string | null;
  invoiceUrl: string | null;
  bookedBy: { name: string; phone: string } | null;
  paymentId: string | null;
  noShow: boolean;
  startOdometer: number | null;
  endOdometer: number | null;
  adminNote: string | null;
  seatRefundDue: number;
  suggestedRefund: number;
  can: {
    cashOrUpi: boolean;
    complete: boolean;
    markRefunded: boolean;
    seatRefunded: boolean;
    assignDriver: boolean;
    cancel: boolean;
    refundAmount: boolean;
  };
};

export type SeatState = {
  seatNo: number;
  state: 'FREE' | 'BOOKED' | 'BLOCKED';
  blockReason: string | null;
  bookingId: string | null;
  female: boolean;
};
export type ManifestRow = {
  id: string;
  code: string;
  status: string;
  source: 'ONLINE' | 'OFFLINE';
  seatNos: number[];
  passengers: number;
  passengerName: string;
  passengerPhone: string;
  pickup: string;
  drop: string;
  paymentStatus: string;
  totalAmount: number;
  cashDue: number;
  boardedAt: string | null;
  noShow: boolean;
};
export type TripControl = {
  trip: AdminTrip & {
    seatsPerRow: number;
    aisleAfter: number;
    seatLayout: string;
  };
  summary: {
    sold: number;
    seats: number;
    blocked: number;
    cashToCollect: number;
  };
  editable: boolean;
  seats: SeatState[];
  manifest: ManifestRow[];
  pickupStops: Stop[];
  dropStops: Stop[];
  drivers: DriverBrief[];
  blockReasons: string[];
};

export type AdminVehicle = {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  regNumber: string;
  seats: number;
  seatsPerRow: number;
  aisleAfter: number;
  seatLayout: string;
  amenities: string;
  imageUrl: string | null;
  allowSeatBooking: boolean;
  allowRental: boolean;
  ratePerKm: number;
  minKmPerDay: number;
  driverAllowance: number;
  localPackage: number;
  airportFare: number;
  tollFactor: number;
  insuranceExpiry: string | null;
  permitExpiry: string | null;
  fitnessExpiry: string | null;
  pucExpiry: string | null;
  active: boolean;
};

export type AdminDriver = {
  id: string;
  userId: string;
  name: string;
  phone: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  active: boolean;
  licenceNo: string;
  licenceExpiry: string | null;
  photoUrl: string | null;
  licencePhotoUrl: string | null;
  aadhaarPhotoUrl: string | null;
  aadhaarLast4: string | null;
  address: string;
  experienceYears: number | null;
  emergencyContact: string;
  showOnWebsite: boolean;
  notes: string;
  appliedAt: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
};
export type DriverListRow = AdminDriver & {
  tripsDone: number;
  cashHeld: { amount: number; count: number };
  rating: { average: number; count: number } | null;
};

export type AdminRoute = RouteBrief & {
  tollAmount: number;
  parkingAmount: number;
  trips: number;
  canDelete: boolean;
};
export type AdminStop = Stop & {
  landmark: string;
  photoUrl: string | null;
  sortOrder: number;
  active: boolean;
};

export type OnRoad = {
  vehicle: { id: string; name: string; regNumber: string };
  what: string;
  since: string | null;
  driverName: string | null;
  location: {
    lat: number;
    lng: number;
    speed: number | null;
    updatedAt: string;
    mapUrl: string;
  } | null;
};
export type FleetRoute = RouteBrief & {
  vehicles: {
    vehicleId: string;
    on: boolean;
    upcomingTrips: number;
    today: {
      id: string;
      departAt: string;
      status: string;
      seatsTaken: number;
      driverName: string | null;
    }[];
    next: { id: string; departAt: string } | null;
  }[];
};
export type Fleet = {
  onRoad: OnRoad[];
  vehicles: VehicleBrief[];
  routes: FleetRoute[];
};

export type Settings = {
  business: {
    legalName: string;
    gstin: string;
    address: string;
    stateName: string;
    stateCode: string;
    sacCode: string;
    email: string;
  };
  cancellationSlabs: { minHoursBefore: number; refundPercent: number }[];
  allowCash: boolean;
  travelPolicy: string;
  returnDiscountPercent: number;
  freeChangeHours: number;
  advancePerSeat: number;
  upiId: string;
  upiName: string;
};

export type Feedback = {
  average: number | null;
  total: number;
  open: number;
  feedback: {
    id: string;
    name: string;
    phone: string;
    rating: number;
    comment: string;
    bookingCode: string | null;
    source: string;
    handled: boolean;
    createdAt: string;
  }[];
  ratings: {
    bookingId: string;
    code: string;
    rating: number;
    comment: string | null;
    ratedAt: string;
    passengerName: string;
    title: string;
    driverName: string | null;
  }[];
};

export type Messages = {
  connected: boolean;
  templates: {
    event: string;
    to: string;
    category: string;
    vars: string[];
    name: string | null;
  }[];
  messages: {
    id: string;
    channel: string;
    to: string;
    event: string;
    body: string;
    status: 'SENT' | 'FAILED' | 'LOGGED';
    error: string | null;
    createdAt: string;
  }[];
};

export type Report = {
  types: Record<string, string>;
  type: string;
  from: string;
  to: string;
  title: string;
  note: string;
  columns: string[];
  rows: (string | number)[][];
  moneyColumns: boolean[];
  totals: (string | number)[] | null;
  csvUrl: string;
};

export type Options = {
  routes: RouteBrief[];
  vehicles: VehicleBrief[];
  drivers: DriverBrief[];
  cities: string[];
  stops: Stop[];
  blockReasons: string[];
  rentalTypes: Record<string, string>;
  vehicleTypes: Record<string, string>;
  bookingStatuses: string[];
};

export type ActionResult = {
  ok: true;
  redirect?: string;
  created?: number;
  skipped?: number;
  code?: string;
  removed?: string;
  reviewed?: string;
  saved?: boolean;
};

/** Runs one office action (same code as the website's admin forms). Throws ApiError with the server's message. */
export const adminAction = (name: string, body: Record<string, unknown>) => api<ActionResult>(`/api/admin/actions/${name}`, { body });

/**
 * Loads an admin endpoint and reloads it whenever the screen comes back into focus.
 * `data` keeps the last good response while reloading, so lists don't flash.
 */
export function useAdmin<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);
  // Wait until the saved login is restored: on a cold start (or a deep link into /admin) the screen mounts first.
  const { ready, user } = useAuth();
  const signedIn = ready && user?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!path || !signedIn) return;
    const n = ++seq.current;
    try {
      const d = await api<T>(path);
      if (n !== seq.current) return;
      setData(d);
      setError(null);
    } catch (e) {
      if (n === seq.current) setError(errorMessage(e));
    }
  }, [path, signedIn]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { data, error, refreshing, refresh, reload: load, setData };
}

/** Form lists (routes, vehicles, drivers, cities, stops…), cached for the session. */
let optionsPromise: Promise<Options> | null = null;
export function getOptions(fresh = false) {
  if (fresh) optionsPromise = null;
  optionsPromise ??= api<Options>('/api/admin/options').catch((e) => {
    optionsPromise = null;
    throw e;
  });
  return optionsPromise;
}

/** ISO date → "YYYY-MM-DD" in India time (empty for null), for date fields sent back to the server. */
export function isoToYmd(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** Date → "YYYY-MM-DDTHH:mm" in India time, the server's date-time format for actions. */
export function toIstLocal(d: Date) {
  return new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16);
}
