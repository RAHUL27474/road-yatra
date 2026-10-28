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

## Admin (role ADMIN)
Everything the website's office panel (`/admin`) can do, for the app. Send the admin's Bearer token. Not logged in → 401, not an admin → 403,
unknown id → 404, a refused change → 400; errors are `{ error }` with a message to show as is. Dates are ISO strings; money is in rupees.
Photo uploads are website-only (send `photoUrl` / `imageUrl` as text instead).

### Reading
| Method | Path | Returns |
|---|---|---|
| GET | `/api/admin/dashboard` | `{ stats: Stat[], sos: Sos[], pendingDrivers: number, alerts: {what, date, expired}[], todaysTrips: AdminTrip[], todaysRentals: (Booking & {vehicleReg, driverId, driverResponse, driverNote})[], recent: Booking[] }` |
| GET | `/api/admin/bookings?status=&kind=&q=` | `{ bookings: AdminBooking[], drivers: DriverBrief[], statuses: string[] }`. `status`: ALL/CONFIRMED/PENDING/COMPLETED/CANCELLED/EXPIRED, `kind`: ALL/SEAT/RENTAL, `q`: code, name or phone. Newest first, max 200 |
| GET | `/api/admin/bookings/:idOrCode` | `{ booking: AdminBooking, drivers: DriverBrief[] }` |
| GET | `/api/admin/trips` | `{ trips: AdminTrip[] /* SCHEDULED+STARTED from 12 h ago */, routes: RouteBrief[], vehicles: {id, name, regNumber, seats}[] /* seat-selling vehicles */, drivers: DriverBrief[], today: "YYYY-MM-DD" }` |
| GET | `/api/admin/trips/:id` | `TripControl` (below) |
| GET | `/api/admin/vehicles` | `{ vehicles: AdminVehicle[], vehicleTypes: Record<type, label> }` |
| GET | `/api/admin/vehicles/:id` | `{ vehicle: AdminVehicle, vehicleTypes }` |
| GET | `/api/admin/drivers` | `{ loadedAt, pending: DriverListRow[], drivers: DriverListRow[] }` (pending = applications waiting for approval, oldest first) |
| GET | `/api/admin/drivers/:id` | `{ driver: AdminDriver }` |
| GET | `/api/admin/routes` | `{ routes: {id, fromCity, toCity, distanceKm, durationMins, tollAmount, parkingAmount, trips, canDelete}[] }` |
| GET | `/api/admin/stops` | `{ stops: (Stop & {landmark, photoUrl, sortOrder, active})[], cities: string[] }` |
| GET | `/api/admin/fleet` | `{ onRoad: OnRoad[], vehicles: {id, name, regNumber, seats, allowSeatBooking, allowRental}[], routes: FleetRoute[] }` |
| GET | `/api/admin/settings` | `{ settings: Settings, status: { onlinePayments: boolean, mobileOtp: boolean } }` |
| GET | `/api/admin/feedback` | `{ average: number\|null, total, open, feedback: {id, name, phone, rating, comment, bookingCode, source, handled, createdAt}[], ratings: {bookingId, code, rating, comment, ratedAt, passengerName, title, driverName}[] }` |
| GET | `/api/admin/messages` | `{ connected: boolean, templates: {event, to, category, vars: string[], name: string\|null}[], messages: {id, channel, to, event, body, status: "SENT"\|"FAILED"\|"LOGGED", error, createdAt}[] }` |
| GET | `/api/admin/reports?type=&from=&to=` | `{ types: Record<type, label>, type, from, to, title, note, columns: string[], rows: (string\|number)[][], moneyColumns: boolean[], totals: (string\|number)[]\|null, csvUrl }`. Types: daily, route, vehicle, driver, occupancy, cancellations, payments, gst. Dates `YYYY-MM-DD` (default: this month) |
| GET | `/admin/reports/export?type=&from=&to=` | CSV file (accepts the Bearer token too) — this is `csvUrl` |
| GET | `/api/admin/options` | `{ routes: RouteBrief[], vehicles: {id, name, regNumber, seats, allowSeatBooking, allowRental}[], drivers: DriverBrief[], cities: string[], stops: Stop[], blockReasons: string[], rentalTypes: Record<type, label>, vehicleTypes: Record<type, label>, bookingStatuses: string[] }` — lists for forms |

```ts
type Stat = { key: "collectedToday"|"collectedMonth"|"bookingsToday"|"occupancyToday"|"cashToCollect"|"cashWithDrivers"|"refundsPending";
              label: string; value: string /* formatted, e.g. "₹1,700" or "40%" */; amount: number; sub: string }
type Sos = { id; createdAt; driverName; driverPhone; vehicleReg; lat; lng; mapUrl: string|null }
type DriverBrief = { id; name; phone }
type RouteBrief = { id; fromCity; toCity; distanceKm; durationMins }
type AdminTrip = { id; routeId; fromCity; toCity; departAt; arriveAt; fare; boardingPoint; status: "SCHEDULED"|"STARTED"|"COMPLETED"|"CANCELLED";
                   vehicle: { id; name; regNumber; seats }; driver: DriverBrief|null;
                   driverResponse: "ACCEPTED"|"REJECTED"|null; driverNote: string|null /* why the last driver turned it down */; seatsTaken: number }
// Booking = the customer Booking object above (serializeBooking) — code, kind, status, paymentStatus, totals, seatNos, trip, driver, …
type AdminBooking = Booking & {
  trackUrl: string|null; invoiceUrl: string|null; vehicleReg: string|null; driverId: string|null; driverResponse; driverNote;
  bookedBy: { name; phone }; createdAt; paymentId: string|null; noShow: boolean; startOdometer: number|null; endOdometer: number|null;
  adminNote: string|null; seatRefundDue: number; suggestedRefund: number /* default for "refundAmount" when cancelling */;
  can: { cashOrUpi; complete; markRefunded; seatRefunded; assignDriver; cancel; refundAmount /* show the refund field */: boolean } }
type TripControl = {
  trip: AdminTrip & { seatsPerRow; aisleAfter; seatLayout };
  summary: { sold; seats; blocked; cashToCollect };
  editable: boolean;                       // SCHEDULED: seats can be blocked and phone bookings taken
  seats: { seatNo; state: "FREE"|"BOOKED"|"BLOCKED"; blockReason: string|null; bookingId: string|null; female: boolean }[];
  manifest: { id; code; status; source: "ONLINE"|"OFFLINE"; seatNos: number[]; passengers; passengerName; passengerPhone;
              pickup: string; drop: string; paymentStatus; totalAmount; cashDue: number; boardedAt: string|null; noShow: boolean }[];
  pickupStops: Stop[]; dropStops: Stop[]; drivers: DriverBrief[]; blockReasons: string[] }
type AdminVehicle = { id; name; type; typeLabel; regNumber; seats; seatsPerRow; aisleAfter; seatLayout; amenities: string /* "AC,Music" */; imageUrl;
                      allowSeatBooking; allowRental; ratePerKm; minKmPerDay; driverAllowance; localPackage; airportFare; tollFactor;
                      insuranceExpiry; permitExpiry; fitnessExpiry; pucExpiry; active }
type AdminDriver = { id; userId; name; phone; status: "PENDING"|"APPROVED"|"REJECTED"; active; licenceNo; licenceExpiry; photoUrl;
                     licencePhotoUrl; aadhaarPhotoUrl /* need the Bearer token */; aadhaarLast4; address; experienceYears; emergencyContact;
                     showOnWebsite; notes; appliedAt; reviewedAt; rejectReason }
type DriverListRow = AdminDriver & { tripsDone: number; cashHeld: { amount; count }; rating: { average; count }|null }
type OnRoad = { vehicle: { id; name; regNumber }; what: string; since: string|null; driverName: string|null;
                location: { lat; lng; speed; updatedAt; mapUrl }|null }
type FleetRoute = { id; fromCity; toCity; distanceKm; durationMins;
                    vehicles: { vehicleId; on: boolean; upcomingTrips: number /* next 14 days */;
                                today: { id; departAt; status; seatsTaken; driverName }[]; next: { id; departAt }|null }[] }
type Settings = { business: { legalName; gstin; address; stateName; stateCode; sacCode; email }; cancellationSlabs: { minHoursBefore; refundPercent }[];
                  allowCash; travelPolicy; returnDiscountPercent; freeChangeHours; advancePerSeat; upiId; upiName }
```

### Changing things
`POST /api/admin/actions/:name` with a JSON body. These run the same code as the website's admin forms. Success → `{ ok: true, redirect?, …extra }`.
Booleans are checkboxes: send `true` for ticked; **a missing or `false` flag means unticked**, so send every flag when saving a vehicle, driver or settings.
Dates `YYYY-MM-DD`, times `HH:mm`, date-times `YYYY-MM-DDTHH:mm` (all India time).

| Action | Body | Extra in the reply |
|---|---|---|
| `scheduleTrips` | `{ routeId, vehicleId, driverId?, startDate, time, days (1–90), fare, boardingPoint? }` | `created`, `skipped` (days the vehicle/driver was busy or already past) |
| `assignTripDriver` | `{ id (trip), driverId? }` (empty = unassign) | |
| `cancelTrip` | `{ id }` — SCHEDULED trips only; every booking cancelled with a full refund | |
| `blockSeats` | `{ tripId, seatNos: number[], reason (one of blockReasons) }` | |
| `unblockSeat` | `{ tripId, seatNo }` | |
| `offlineSeatBooking` | `{ tripId, seatNos: number[], passengerName, passengerPhone, pickupStopId?, dropStopId?, female?, paid? }` — confirmed straight away, cash | `code` |
| `offlineRentalBooking` | `{ rentalType, vehicleId, pickupCity, dropCity?, startAt, returnAt?, pickupAddress?, dropAddress?, passengers, passengerName, passengerPhone, paid? }` | `code` |
| `updateBooking` | `{ id, action, note?, refundAmount?, driverId? }`. `action`: `cancel` (optional `refundAmount`, `note`), `complete`, `cash`, `upi` (payment received), `refunded`, `seatRefunded`, `assign` (`driverId`, full cabs), `note` (saves `note` as the office note) | |
| `saveVehicle` | AdminVehicle fields (no `id` = new). Expiry dates as `YYYY-MM-DD` or empty; `amenities` comma separated; flags `allowSeatBooking`, `allowRental`, `active` | |
| `saveDriver` | `{ id?, name, phone, licenceNo, licenceExpiry?, password? (≥6, sets/changes it), photoUrl?, removePhoto?, notes?, showOnWebsite?, active? }` | |
| `removeDriver` | `{ id }` | `removed`: `"deleted"` (no history) or `"deactivated"` |
| `reviewDriverApplication` | `{ id, decision: "approve"\|"reject", reason? (required to reject) }` | `reviewed` |
| `markCashReceived` | `{ driverId, upTo: loadedAt from GET /api/admin/drivers }` | |
| `addRoute` | `{ fromCity, toCity, distanceKm, durationHours, tollAmount, parkingAmount, bothWays? }` (an existing route is updated) | |
| `deleteRoute` | `{ id }` (only routes with no trips: `canDelete`) | |
| `saveStop` | `{ id?, city, name, address?, landmark?, lat?, lng?, sortOrder?, active? (when editing), removePhoto? }` | |
| `toggleRouteVehicle` | `{ routeId, vehicleId }` — switches the vehicle on/off on that route | |
| `saveSettings` | `{ legalName, gstin, address, stateName, stateCode, sacCode, email, slabHours0..4, slabRefund0..4, allowCash?, travelPolicy, returnDiscountPercent, freeChangeHours, advancePerSeat, upiId, upiName }` — send all fields (a 0-hour slab is added if missing) | `saved` |
| `markFeedbackHandled` | `{ id }` — toggles seen / new | |
| `resolveSos` | `{ id }` | |

## Sample logins (from the seed)
- Customer: `9999999999` / `demo123` (or OTP)
- Drivers: `9000000001`, `9000000002` / `driver123` (or OTP)
- Admin: `admin@roadyatra.in` / `admin123`
- With `OTP_DEV_MODE=true` (default in development) the OTP is returned as `devOtp`.
