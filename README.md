# Road Yatra

Intercity shared-taxi and full-cab booking for **Khatima ↔ Delhi**, running your own vehicles and drivers.
It follows Phase 1 of the SOW. Existing routes can be extended, for example to Rudrapur, Haldwani, Bareilly or Dehradun, from the admin panel.

> **"Khatima se Delhi – Seat bhi book karein, Puri Cab bhi."**

```
road_yatra/
├── web/      Website + admin panel + REST API (the backend for everything)
├── mobile/   Customer app (Android & iOS, Expo)
├── driver/   Driver app (Android & iOS, Expo)
└── API.md    API reference
```

## Run it on your computer

Requires Node.js 20 or newer.

```bash
cd web
npm install
npm run setup     # creates the database and loads Khatima ↔ Delhi sample data
npm run dev       # http://localhost:3000
```

The two apps are covered in [mobile/README.md](mobile/README.md) and [driver/README.md](driver/README.md).

Sample logins:

| Who | Login | Password |
|---|---|---|
| Admin | admin@roadyatra.in | admin123 |
| Customer | 9999999999 | demo123 (or OTP) |
| Drivers | 9000000001, 9000000002 | driver123 (or OTP) |

In development, `OTP_DEV_MODE=true` shows the OTP on screen, because no SMS is sent. **Change the admin password and set `OTP_DEV_MODE=false` before going live.**

## What's included (SOW Phase 1)

**Customers (website + app)**
- Mobile OTP login and sign-up, with password as a fallback
- **Shared taxi**: scheduled departures, seat map, pickup and drop points (e.g. Khatima Bus Stand → Anand Vihar ISBT), seat lock → pay → confirm, and automatic release after 10 minutes if unpaid
- **Full cab**: one way, round trip, local (8 hr / 80 km) and airport. The fare is built from rate/km, driver allowance, toll and parking, plus 5% GST
- Pay online (Razorpay: UPI, cards, net banking) or **cash to driver** (can be switched off)
- Boarding pass with a **QR code and 4-digit OTP**. Full cabs also get an end-of-trip OTP
- Driver name, phone and vehicle number once a driver is assigned
- **Live tracking page** with a map and ETA that can be shared with family, plus SOS (112) and support buttons
- Cancellation with refund charges by time slab, and a printable **GST tax invoice**

**Drivers (driver app)**
- Today's and upcoming duties, and the passenger manifest grouped by pickup point
- Scan the ticket QR or enter the OTP to board passengers, mark no-shows, and record cash collected
- Start and end trips. Full cabs need the customer's OTP and odometer readings
- Shares GPS location while a trip is in progress

**Office (admin panel at /admin)**
- Dashboard: collections, bookings, occupancy, cash to collect, refunds, today's trips and pickups, and **document expiry alerts** (insurance, permit, fitness, PUC, licences)
- Trips: schedule daily departures, assign drivers, **block seats** (VIP, driver, corporate…), take **phone/walk-in bookings**, and see the printable manifest
- Full-cab phone bookings, driver assignment, mark paid, and cancel with a refund override
- Vehicles (rates, toll multiplier, seat layout, documents), drivers, routes (distance, time, toll, parking), and pickup points
- Settings: business and GST details for invoices, cancellation slabs, and cash on/off
- **Reports** with CSV download: daily sales, route, vehicle, driver, occupancy, cancellations, payments and GST summary
- SMS/WhatsApp message log

## Connecting real services

All keys go in `web/.env` (see `web/.env.example`).

| Service | What for | Keys |
|---|---|---|
| Razorpay | Online payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (demo mode until set) |
| Message Central | OTP SMS (login and sign-up), no DLT registration needed | `MESSAGE_CENTRAL_CUSTOMER_ID`, `MESSAGE_CENTRAL_PASSWORD` |
| SMTP (Gmail, Brevo, Mailjet…) | Email OTP for sign-up | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` |
| MSG91 | Booking SMS (and OTP SMS if Message Central is not set) | `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_*` (DLT-approved templates are required in India) |
| WhatsApp Business (Meta Cloud API) | Confirmations, driver details, tracking link | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_*` |

Until SMS and WhatsApp are connected, messages are only recorded in Admin → SMS / WhatsApp log.
Maps use OpenStreetMap, which is free and needs no key.

## Things to confirm with your CA / transport office

- **GST**: the system uses 5% on the fare. CGST+SGST applies when the journey starts in Uttarakhand, and IGST when it starts in another state (e.g. Delhi). Toll and parking are shown as a non-taxable reimbursement. Confirm the rate, SAC code and toll treatment with your CA. Refunds on cancelled paid bookings need credit notes, which are **not generated yet**.
- **Permits**: selling individual seats in a taxi or MUV on a fixed route has permit implications (contract carriage vs stage carriage). Check with the RTO before launch.

## Going live

1. **Database**: in `web/prisma/schema.prisma`, change `provider = "sqlite"` to `"postgresql"` and set `DATABASE_URL`, then run `npm run setup`. For a fresh database, edit `prisma/seed.ts` first or skip the seed.
2. **Hosting**: deploy `web/` to a Node host such as Railway, Render, a VPS or Vercel. Set all the `.env` values, including `APP_URL=https://your-domain` (used in SMS, tracking and invoice links). HTTPS is required for the apps.
3. **Apps**: set `EXPO_PUBLIC_API_URL=https://your-domain` and build with EAS. Publish the customer app and the driver app to the Play Store. For the driver app you can also share the APK directly with your drivers.

## Phase 2 (not built yet)

B2B corporate portal and travel-agent portal (credit, commissions, monthly billing), wallet, referral and loyalty, ratings and reviews, push notifications (Firebase), automatic Razorpay refunds and credit notes, trip-reminder SMS (needs a scheduled job), staff roles (operations / finance / support), and dynamic pricing (weekend and festival fares).
