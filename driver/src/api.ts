export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000').replace(/\/+$/, '');
export const TOKEN_KEY = 'ry_driver_token';

export type User = { id: string; name: string; email: string | null; phone: string; role: 'CUSTOMER' | 'DRIVER' | 'ADMIN' };
/** emailOtp: new drivers can verify by email instead of SMS. */
export type Config = { brandName: string; supportPhone: string; otpLogin: boolean; emailOtp?: boolean };
export type Stop = { id: string; city: string; name: string; address: string; lat: number | null; lng: number | null };
export type DutyStatus = 'SCHEDULED' | 'STARTED' | 'COMPLETED';
/** null until the driver accepts; a rejected duty leaves the driver's list. */
export type DutyResponse = 'ACCEPTED' | 'REJECTED' | null;
export type VehicleDocs = { insurance: string | null; permit: string | null; fitness: string | null; puc: string | null };
export type DutyVehicle = { id: string; name: string; regNumber: string; seats: number; docs?: VehicleDocs };
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUND_PENDING' | 'REFUNDED';
export type Passenger = {
  bookingId: string;
  code: string;
  name: string;
  phone: string;
  seatNos: number[];
  pickupStop: Stop | null;
  dropStop: Stop | null;
  paymentStatus: PaymentStatus;
  paymentMode: string | null;
  amountDue: number;
  boarded: boolean;
  noShow: boolean;
};
export type TripDuty = {
  kind: 'TRIP';
  id: string;
  fromCity: string;
  toCity: string;
  startAt: string;
  endAt: string;
  status: DutyStatus;
  response?: DutyResponse;
  boardingPoint: string;
  dropPoint: string;
  vehicle: DutyVehicle;
  blockedSeats: { seatNo: number; reason: string | null }[];
  passengers: Passenger[];
};
export type RentalDuty = {
  kind: 'RENTAL';
  id: string;
  code: string;
  rentalType: string | null;
  fromCity: string | null;
  toCity: string | null;
  startAt: string;
  endAt: string | null;
  status: DutyStatus;
  response?: DutyResponse;
  vehicle: DutyVehicle | null;
  customer: { name: string; phone: string; passengers: number };
  pickupAddress: string | null;
  dropAddress: string | null;
  estimatedKm: number | null;
  startOdometer: number | null;
  endOdometer: number | null;
  paymentStatus: PaymentStatus;
  paymentMode: string | null;
  amountDue: number;
};
export type Duty = TripDuty | RentalDuty;
export type DriverInfo = { name: string; phone: string; licenceNo: string | null; licenceExpiry: string | null; photoUrl: string | null };
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type Application = {
  status: ApplicationStatus;
  active: boolean;
  name: string;
  phone: string;
  licenceNo: string | null;
  licenceExpiry: string | null;
  address: string | null;
  experienceYears: number | null;
  emergencyContact: string | null;
  aadhaarLast4: string | null;
  photoUrl: string | null;
  licencePhotoUrl: string | null;
  aadhaarPhotoUrl: string | null;
  appliedAt: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
};
export type DutiesResponse = { driver: DriverInfo; duties: Duty[] };
export type BoardResult = { bookingId: string; name: string; seatNos: number[] | string; amountDue: number };
export type RentalEndResult = { kmDriven: number | null; includedKm: number | null; amountDue: number };
export type HistoryItem = {
  kind: 'TRIP' | 'RENTAL';
  id: string;
  title: string;
  at: string;
  completedAt: string;
  vehicleReg: string | null;
  passengers: number;
  km: number | null;
  cash: number;
};
export type EarningsDay = { date: string; duties: number; passengers: number; km: number; cash: number };
export type Earnings = { cashInHand: number; cashInHandCount: number; days: EarningsDay[]; history: HistoryItem[] };

/** "98765 43210", "+91 98765 43210" or "098765..." → "9876543210". Anything else (an email) is returned trimmed. */
export function normalizeLogin(login: string) {
  const t = login.trim();
  if (t.includes('@')) return t;
  const digits = t.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.length === 10 ? digits : t;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let authToken: string | null = null;
/** Called by the auth context so every request carries the Bearer token. */
export function setAuthToken(token: string | null) {
  authToken = token;
}
export const getAuthToken = () => authToken;

/** Server file paths (`/api/files/...`) become absolute URLs; absolute URLs are returned as they are. */
export const fileUrl = (path: string | null | undefined) => (!path ? null : /^https?:\/\//i.test(path) ? path : API_URL + (path.startsWith('/') ? '' : '/') + path);

/** Image source for a server file. Private documents need the Bearer token. */
export const fileSource = (path: string | null | undefined) => {
  const uri = fileUrl(path);
  if (!uri) return null;
  return authToken ? { uri, headers: { Authorization: `Bearer ${authToken}` } } : { uri };
};

// A duty endpoint answering 403 "under review" / "not approved" means the driver's application status
// changed (or never was approved). The auth context listens and re-runs the status routing.
let onAccessLost: (() => void) | null = null;
export function setAccessLostHandler(fn: (() => void) | null) {
  onAccessLost = fn;
}
const DUTY_PATH = /^\/api\/driver\/(?!application|apply)/;
const ACCESS_LOST = /under review|not approved|inactive/i;
function checkAccessLost(path: string, status: number, message: string) {
  if (status === 403 && DUTY_PATH.test(path) && ACCESS_LOST.test(message)) onAccessLost?.();
}

/** Typed fetch wrapper. Throws ApiError with the server's `{ error }` message on failure. */
export async function api<T>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = opts.token !== undefined ? opts.token : authToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_URL}. Check your internet connection.`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    checkAccessLost(path, res.status, message);
    throw new ApiError(res.status, message);
  }
  return data as T;
}

/**
 * POSTs multipart/form-data with the Bearer token, reporting upload progress (0..1).
 * Uses XMLHttpRequest because fetch has no upload progress. The Content-Type header (with the
 * multipart boundary) is set by the runtime, never by hand.
 */
export function uploadForm<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL + path);
    xhr.setRequestHeader('Accept', 'application/json');
    if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    xhr.timeout = 120_000;
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => {
      let data: any = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(new ApiError(xhr.status, data?.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new ApiError(0, `Can't reach the server at ${API_URL}. Check your internet connection.`));
    xhr.ontimeout = () => reject(new ApiError(0, 'The upload took too long. Check your internet connection and try again.'));
    xhr.send(form);
  });
}

/** POST with no body. */
export const post = <T = { ok: boolean }>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body });

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

let configPromise: Promise<Config> | null = null;
export function getConfig() {
  configPromise ??= api<Config>('/api/config').catch((e) => {
    configPromise = null;
    throw e;
  });
  return configPromise;
}
