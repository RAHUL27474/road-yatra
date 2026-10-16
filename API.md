# Road Yatra API

Base URL: the web app (`http://<your-computer-ip>:3000` in development). All bodies are JSON.
Errors always come back as `{ "error": "message" }` with a 4xx/5xx status. Times are ISO strings (UTC); show them in IST.

Auth: the website uses an http-only cookie. The mobile apps send `Authorization: Bearer <token>`,
using the `token` returned by any login call (valid 30 days).

## Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/otp/request` | `{ phone, email?, channel? }` | `{ sent, isNewUser, devOtp? }` — `devOtp` only in test mode (no SMS/email provider). `channel: "EMAIL"` sends the OTP to `email` instead (new accounts only; 409 if the phone or email is already registered) |
| POST | `/api/auth/otp/verify` | `{ phone, otp (6 digits), name?, email?, channel? }` | `{ token, user }`, or `{ needsName: true }` for a new number without `name` (OTP not used up yet; resend with `name`) |
| POST | `/api/auth/login` | `{ login (email or phone), password }` | `{ token, user }` |
| POST | `/api/auth/register/otp` | `{ name, phone, email?, password, channel: "PHONE" \| "EMAIL" }` | `{ sent, channel, sentTo, devOtp? }` — sign-up step 1: checks the details (409 if already registered) and sends the OTP to the mobile or the email |
| POST | `/api/auth/register` | `{ name, phone, email?, password, channel, otp }` | `{ token, user }` — sign-up step 2: the OTP from step 1. While `/api/config` has `otpLogin` and `emailOtp` both false (no SMS/email set up), sign up here directly without `otp` |
| POST | `/api/auth/logout` | – | `{ ok }` |
| GET | `/api/auth/me` | – | `{ user }` (401 if not logged in) |

`user = { id, name, email: string|null, phone, role: "CUSTOMER" | "DRIVER" | "ADMIN" }`.
If `/api/auth/otp/request` returns 503, OTP login is not set up: fall back to password login.

## Public data
| Method | Path | Returns |
|---|---|---|
| GET | `/api/config` | `{ brandName, supportPhone, demoPayments, allowCash, otpLogin, emailOtp, gstRate, holdMinutes, cancellationSlabs: {minHoursBefore, refundPercent}[] }` |
| GET | `/api/cities` | `{ cities: string[] }` |
| GET | `/api/stops?city=Khatima` | `{ stops: Stop[] }` (all cities if `city` omitted) |
| GET | `/api/trips/search?from=Khatima&to=Delhi&date=YYYY-MM-DD` | `{ trips: TripSummary[] }` |
| GET | `/api/trips/:id` | `{ trip: TripDetail }` |
| POST | `/api/rentals/quote` | `{ plan, results: Quote[] }` |

```ts
type Vehicle = { id; name; type: "SEDAN"|"ERTIGA"|"SUV"|"INNOVA_CRYSTA"|"TEMPO_TRAVELLER"|"BUS"|"OTHER"; seats; seatsPerRow; aisleAfter; amenities: string[]; imageUrl: string|null }
type Stop = { id; city; name; address; lat: number|null; lng: number|null }
type TripSummary = { id; fromCity; toCity; departAt; arriveAt; durationMins; fare; boardingPoint; dropPoint; seatsLeft; vehicle: Vehicle }
type TripDetail = { id; fromCity; toCity; departAt; arriveAt; fare; boardingPoint; dropPoint; vehicle: Vehicle; takenSeats: number[]; pickupStops: Stop[]; dropStops: Stop[] }
```
`boardingPoint` is now a free-text note (e.g. "Reach 10 minutes early"); the customer picks a pickup and drop **stop**.
Seat map: seats `1..vehicle.seats`, rows of `seatsPerRow`, gap after `aisleAfter` seats if > 0. `takenSeats` includes seats blocked by the office.

Rental quote body: `{ rentalType: "ONE_WAY"|"ROUND_TRIP"|"LOCAL"|"AIRPORT", pickupCity, dropCity?, startAt, returnAt? }` (`dropCity` for ONE_WAY/ROUND_TRIP; `returnAt` for ROUND_TRIP).
```ts
type Quote = { vehicle: Vehicle; available: boolean; baseAmount; taxAmount; extraCharges; totalAmount; billableKm; toll; parking; driverAllowance }
// totalAmount = baseAmount + taxAmount + extraCharges (extraCharges = toll + parking, no GST)
```

## Bookings (login required)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/bookings` | – | `{ bookings: Booking[] }` |
| POST | `/api/bookings` | seat or rental body | `{ booking, payUrl, payToken }` (201). `payUrl`/`payToken` are `null` for cash bookings |
| GET | `/api/bookings/:idOrCode` | – | `{ booking }` |
| POST | `/api/bookings/:id/cancel` | – | `{ booking }` |
| POST | `/api/bookings/:id/pay-link` | – | `{ payUrl, payToken }` fresh link for your own PENDING booking |
| POST | `/api/bookings/:id/pay` | `{ payToken? }` | `{ mode: "DEMO", amount }` or `{ mode: "RAZORPAY", keyId, orderId, amountPaise, code }` |
| POST | `/api/bookings/:id/confirm-payment` | `{ payToken?, razorpay_order_id?, razorpay_payment_id?, razorpay_signature? }` | `{ status, code }` |

Seat body: `{ kind: "SEAT", tripId, seatNos: number[], pickupStopId?, dropStopId?, passengerName, passengerPhone, payment: "ONLINE"|"CASH" }`
Rental body: `{ kind: "RENTAL", vehicleId, rentalType, pickupCity, dropCity?, startAt, returnAt?, pickupAddress, dropAddress?, passengers, passengerName, passengerPhone, payment: "ONLINE"|"CASH" }`

- `payment: "ONLINE"` → booking is `PENDING`, holds seats/vehicle for `holdMinutes` (10). Open `payUrl` in a browser (works without login); afterwards re-fetch the booking.
- `payment: "CASH"` (only if `config.allowCash`) → booking is `CONFIRMED` immediately, `paymentMode: "CASH"`, `paymentStatus: "UNPAID"`; the passenger pays the driver.

```ts
type Booking = {
  id; code; kind: "SEAT"|"RENTAL"; status: "PENDING"|"CONFIRMED"|"CANCELLED"|"EXPIRED"|"COMPLETED"; source: "ONLINE"|"OFFLINE";
  tripStatus: "SCHEDULED"|"STARTED"|"COMPLETED"|"CANCELLED";   // the journey itself
  paymentStatus: "UNPAID"|"PAID"|"REFUND_PENDING"|"REFUNDED"; paymentMode: "RAZORPAY"|"DEMO"|"CASH"|null;
  passengerName; passengerPhone; passengers; baseAmount; taxAmount; extraCharges; totalAmount;
  seatNos: number[]; pickupStop: Stop|null; dropStop: Stop|null;
  rentalType; pickupCity; dropCity; pickupAddress; dropAddress; startAt; endAt; estimatedKm;
  trip: { id; fromCity; toCity; departAt; arriveAt; boardingPoint; dropPoint } | null;
  vehicle: Vehicle|null; vehicleNumber: string|null;              // number shown once a driver is assigned
  driver: { name; phone; photoUrl } | null;
  boardingOtp: string|null; qrData: string|null;                  // show as QR + OTP until boarded ("RY:<code>:<otp>")
  endOtp: string|null;                                             // rentals in progress: customer gives it to driver at the end
  boardedAt; canCancel: boolean;
  cancellation: { refundPercent; refundAmount; charge } | null;    // what cancelling NOW would refund (when canCancel)
  cancelledAt; refundAmount; cancellationCharge; invoiceNo;
  trackable: boolean; trackUrl: string|null;                       // public live-tracking page (open in browser / share)
  invoiceUrl: string|null;                                         // printable GST invoice page
  holdExpiresAt: string|null; createdAt;
}
```

## Live tracking
| GET | `/api/track/:bookingId?t=<token from trackUrl>` | `{ code, status, tripStatus, title, startAt, driver, vehicle: {name, number}, pickup, drop, onBoard, location: {lat,lng,speed,updatedAt,stale}|null, eta: {minutes, to: "pickup"|"drop", place}|null }` |
|---|---|---|

## Driver registration (driver app, any logged-in user)
A new driver verifies their mobile (or their email, with `channel: "EMAIL"`) with OTP (`/api/auth/otp/request` → `/api/auth/otp/verify` with `name`; the account starts as role CUSTOMER), then applies.
The office approves in Admin → Drivers; on approval the role becomes DRIVER and the driver can use the endpoints below.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/driver/application` | – | `{ application: null \| { status: "PENDING"\|"APPROVED"\|"REJECTED", active, name, phone, licenceNo, licenceExpiry, address, experienceYears, emergencyContact, aadhaarLast4, photoUrl, licencePhotoUrl, aadhaarPhotoUrl, appliedAt, reviewedAt, rejectReason } }` |
| POST | `/api/driver/apply` | **multipart/form-data**: `name, licenceNo, licenceExpiry (YYYY-MM-DD), address, experienceYears, emergencyContact?, aadhaarLast4?` + files `photo` (required), `licencePhoto` (required), `aadhaarPhoto` (optional); JPG/PNG/WebP ≤ 6 MB | `{ status: "PENDING" }` (201). Allowed when there is no application or it was REJECTED (resubmit; files already uploaded are kept if not re-sent) |

`photoUrl`, `licencePhotoUrl` and `aadhaarPhotoUrl` are paths on the API server (prefix them with the base URL). Private document URLs need the Bearer token.
While PENDING or REJECTED, every `/api/driver/*` duty endpoint returns 403 with a message.

## Driver app (login as a user with role DRIVER)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/driver/duties` | – | `{ driver: {name, phone, licenceNo, licenceExpiry, photoUrl}, duties: Duty[] }` (yesterday → 7 days ahead, sorted by time) |
| POST | `/api/driver/trips/:tripId/start` | – | `{ ok }` (allowed from 3 h before departure) |
| POST | `/api/driver/trips/:tripId/end` | – | `{ ok }` — boarded passengers → COMPLETED, others marked no-show |
| POST | `/api/driver/board` | `{ qr }` or `{ bookingId, otp }` | `{ bookingId, name, seatNos, amountDue }` |
| POST | `/api/driver/bookings/:bookingId/no-show` | – | `{ ok }` |
| POST | `/api/driver/bookings/:bookingId/collect-cash` | – | `{ collected }` |
| POST | `/api/driver/rentals/:bookingId/start` | `{ otp (4 digits, customer's boardingOtp), odometer? }` | `{ ok }` |
| POST | `/api/driver/rentals/:bookingId/end` | `{ otp (customer's endOtp), odometer? }` | `{ kmDriven, includedKm, amountDue }` |
| POST | `/api/driver/location` | `{ lat, lng, speed? (km/h), heading? }` | `{ vehicleId }`; 409 if no trip is in progress. Send every ~20 s while a duty is STARTED |

```ts
type Duty =
  | { kind: "TRIP"; id; fromCity; toCity; startAt; endAt; status: "SCHEDULED"|"STARTED"|"COMPLETED"; boardingPoint; dropPoint;
      vehicle: { id; name; regNumber; seats }; blockedSeats: { seatNo; reason }[];
      passengers: { bookingId; code; name; phone; seatNos: number[]; pickupStop: Stop|null; dropStop: Stop|null;
                    paymentStatus; paymentMode; amountDue; boarded: boolean; noShow: boolean }[] }
  | { kind: "RENTAL"; id /* bookingId */; code; rentalType; fromCity; toCity; startAt; endAt; status: "SCHEDULED"|"STARTED"|"COMPLETED";
      vehicle: { id; name; regNumber; seats } | null; customer: { name; phone; passengers };
      pickupAddress; dropAddress; estimatedKm; startOdometer; endOdometer; paymentStatus; paymentMode; amountDue }
```

## Sample logins (from the seed)
- Customer: `9999999999` / `demo123` (or OTP)
- Drivers: `9000000001`, `9000000002` / `driver123` (or OTP)
- Admin: `admin@roadyatra.in` / `admin123`
- With `OTP_DEV_MODE=true` (default in development) the OTP is returned as `devOtp`.
