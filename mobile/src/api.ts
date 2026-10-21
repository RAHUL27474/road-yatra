export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000').replace(/\/+$/, '');

export type VehicleType = 'SEDAN' | 'HATCHBACK' | 'ERTIGA' | 'SUV' | 'INNOVA_CRYSTA' | 'TEMPO_TRAVELLER' | 'BUS' | 'OTHER';
export type Vehicle = {
  id: string;
  name: string;
  type: VehicleType;
  seats: number;
  seatsPerRow: number;
  aisleAfter: number;
  /** Seats per row, front to back, e.g. "1,3,2" (empty = plain grid of seatsPerRow). */
  seatLayout?: string;
  amenities: string[];
  imageUrl: string | null;
};
/** landmark + photoUrl help the passenger find the pickup spot. */
export type Stop = { id: string; city: string; name: string; address: string; landmark?: string; photoUrl?: string | null; lat: number | null; lng: number | null };
export type User = { id: string; name: string; email: string | null; phone: string; role: 'CUSTOMER' | 'DRIVER' | 'ADMIN' };
export type Config = {
  brandName: string;
  supportPhone: string;
  demoPayments: boolean;
  /** false until Razorpay is connected: customers can only pay cash to the driver. */
  onlinePayments?: boolean;
  allowCash: boolean;
  otpLogin: boolean;
  /** Email OTPs can be sent (for verifying a new account by email). */
  emailOtp?: boolean;
  gstRate: number;
  holdMinutes: number;
  cancellationSlabs: { minHoursBefore: number; refundPercent: number }[];
  /** Luggage / children / pets rules, one per line. */
  travelPolicy?: string;
  returnDiscountPercent?: number;
  /** Free date / pickup change up to this many hours before departure (0 = off). */
  freeChangeHours?: number;
  /** Online advance per seat (Razorpay); 0 = not offered. */
  advancePerSeat?: number;
  /** Office WhatsApp number for "Book on WhatsApp". */
  whatsapp?: string;
  /** Office UPI ID: passengers can pay by UPI at boarding (empty = cash only). */
  upiId?: string;
  upiName?: string;
  /** Android versionCodes: newer build on Play (latest) and oldest that still works (min). 0 = no prompt. */
  appUpdate?: { latest: number; min: number };
};
export type TripSummary = {
  id: string;
  fromCity: string;
  toCity: string;
  departAt: string;
  arriveAt: string;
  durationMins: number;
  fare: number;
  /** Free-text note for passengers (e.g. "Reach 10 minutes early"). */
  boardingPoint: string;
  dropPoint: string;
  seatsLeft: number;
  vehicle: Vehicle;
};
export type TripDetail = Omit<TripSummary, 'durationMins' | 'seatsLeft'> & {
  /** Seats booked by women, and free seats next to them that only a woman may book. */
  femaleSeats?: number[];
  womenOnlySeats?: number[];
  womenBooked?: number;
  /** Return-trip discount for the logged-in customer (0 if none). */
  discountPercent?: number;
  takenSeats: number[];
  pickupStops: Stop[];
  dropStops: Stop[];
};
export type RentalType = 'ONE_WAY' | 'ROUND_TRIP' | 'LOCAL' | 'AIRPORT';
export type RentalRequest = { rentalType: RentalType; pickupCity: string; dropCity?: string; startAt: string; returnAt?: string };
/** totalAmount = baseAmount + taxAmount + extraCharges (extraCharges = toll + parking, no GST). */
export type Quote = {
  vehicle: Vehicle;
  available: boolean;
  baseAmount: number;
  taxAmount: number;
  extraCharges: number;
  totalAmount: number;
  billableKm: number;
  toll: number;
  parking: number;
  driverAllowance: number;
};
export type QuoteResponse = {
  plan: { km: number; days: number; startAt: string; endAt: string; estimatedKm: number };
  results: Quote[];
};
export type PaymentChoice = 'ONLINE' | 'CASH' | 'ADVANCE';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'COMPLETED';
export type TripStatus = 'SCHEDULED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'PARTIAL' | 'REFUND_PENDING' | 'REFUNDED';
export type Booking = {
  id: string;
  code: string;
  kind: 'SEAT' | 'RENTAL';
  status: BookingStatus;
  source: 'ONLINE' | 'OFFLINE';
  tripStatus: TripStatus;
  paymentStatus: PaymentStatus;
  paymentMode: 'RAZORPAY' | 'DEMO' | 'CASH' | 'ADVANCE' | null;
  passengerName: string;
  passengerPhone: string;
  passengers: number;
  baseAmount: number;
  taxAmount: number;
  extraCharges: number;
  totalAmount: number;
  seatNos: number[];
  /** A traveller per seat, when the booker gave them (female = women's seat). */
  seatPassengers?: { seatNo: number; name: string | null; phone: string | null; female: boolean }[];
  discountPercent?: number;
  /** Paid online so far (an advance), and what is still to be paid in cash to the driver. */
  amountPaid?: number;
  cashDue?: number;
  changeCount?: number;
  canChangeDate?: boolean;
  canChangePickup?: boolean;
  changeDeadline?: string | null;
  /** Departure time passed and the trip hasn't started yet. */
  runningLate?: boolean;
  /** Vehicle distance / minutes from the pickup point while the trip is under way. */
  vehicleKm?: number | null;
  etaMinutes?: number | null;
  pickupStop: Stop | null;
  dropStop: Stop | null;
  rentalType: RentalType | null;
  pickupCity: string | null;
  dropCity: string | null;
  pickupAddress: string | null;
  dropAddress: string | null;
  startAt: string | null;
  endAt: string | null;
  estimatedKm: number | null;
  trip: { id: string; fromCity: string; toCity: string; departAt: string; arriveAt: string; boardingPoint: string; dropPoint: string } | null;
  vehicle: Vehicle | null;
  /** Registration number, shown once a driver is assigned. */
  vehicleNumber: string | null;
  driver: { name: string; phone: string; photoUrl: string | null } | null;
  /** Shown as QR + OTP until boarded. qrData = "RY:<code>:<otp>". */
  boardingOtp: string | null;
  qrData: string | null;
  /** Rentals in progress: the customer gives this to the driver at the end. */
  endOtp: string | null;
  boardedAt: string | null;
  canCancel: boolean;
  /** What cancelling NOW would refund (when canCancel). */
  cancellation: { refundPercent: number; refundAmount: number; charge: number } | null;
  cancelledAt: string | null;
  refundAmount: number | null;
  cancellationCharge: number | null;
  invoiceNo: string | null;
  trackable: boolean;
  /** 1-5 stars once rated; canRate while a completed trip can still be rated. */
  rating?: number | null;
  canRate?: boolean;
  trackUrl: string | null;
  invoiceUrl: string | null;
  holdExpiresAt: string | null;
  createdAt: string;
};
/** payUrl / payToken are null for cash bookings. */
export type CreateBookingResponse = { booking: Booking; payUrl: string | null; payToken: string | null };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
/** Called by the auth context: what to do when the server says the login is no longer valid. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}
/** Called by the auth context so every request carries the Bearer token. */
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Typed fetch wrapper. Throws ApiError with the server's `{ error }` message on failure. */
export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  let res: Response;
  // React Native's HTTP client never times out: give up after 20 s and treat it as "no network" (cached data shows).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  let data: any = null;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });
    data = await res.json().catch(() => null);
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_URL}. Check your internet connection.`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    // The login expired or was revoked mid-session: log out on the phone instead of "Please log in" everywhere.
    if (res.status === 401 && authToken && !path.startsWith('/api/auth/')) onUnauthorized?.();
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

// Small in-memory cache for the public config (support phone, GST rate, ...).
let configPromise: Promise<Config> | null = null;
export function getConfig() {
  configPromise ??= api<Config>('/api/config').catch((e) => {
    configPromise = null;
    throw e;
  });
  return configPromise;
}
