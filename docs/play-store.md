# Google Play — what to fill in

Both apps go on the **Tokri Bazaar** organization account (developer name shown: Tokri Bazaar). They can be moved
later to a Jai Shree Shyam account with Google's *App transfer*.

| | Customer app | Driver app |
|---|---|---|
| App name | Jai Shree Shyam Travels | JSS Travels Driver |
| Package | `in.roadyatra.app` | `in.roadyatra.driver` |
| Upload file | `D:\JSS-Travels-Customer.aab` | `D:\JSS-Travels-Driver.aab` |
| Category | Travel & Local | Travel & Local (or Business) |
| Free / paid | Free | Free |

**Signing:** choose *Use Google-generated key* (Play App Signing). Our files are signed with the **upload key**
`D:\ry\keys\jss-upload.jks` — keep a backup of that file and `upload-key-info.txt`. Lost upload key = ask Google
support to reset it.

**Links (both apps)**
- Privacy policy: https://jaishreeshyamtravels.com/privacy
- Delete account: https://jaishreeshyamtravels.com/delete-account
- Website: https://jaishreeshyamtravels.com — Email: info@jaishreeshyamtravels.com — Phone: +91 99976 81790

---

## Customer app — store listing

**Short description (80 chars)**
Khatima ⇄ Delhi & Haridwar shared taxi seats and full cab hire. Pick your seat.

**Full description**
Book a seat in a shared taxi or hire a full cab with Jai Shree Shyam Tour & Travels, Khatima.

• Daily shared taxi: Khatima ⇄ Delhi and Khatima ⇄ Haridwar — choose your exact seat on the seat map
• Full cab hire: one way, round trip, local and airport — Ertiga, Dzire and more, with a driver
• Women's seats: the seat next to a woman passenger is kept for women
• Pay at boarding — cash or UPI. Your booking is confirmed instantly
• E-ticket with QR code that works without internet
• Driver name, photo and vehicle number as soon as a driver is assigned
• Live tracking — share your trip with family; alerts when the vehicle is near
• Change your date or pickup point for free, cancel single seats, book your return in one tap
• Trip reminders, ratings, WhatsApp support
• Pilgrimage trips: Khatu Shyam ji, Haridwar, Kainchi Dham, Purnagiri, Vrindavan

॥ जय श्री श्याम ॥ — Your Journey, Our Priority.

**Screenshots** (phone, at least 2, 1080×1920 or similar): Home, Seat map, Ticket with QR, Driver card / tracking,
Manage booking. (Connect the phone and I will capture them.)

## Driver app — store listing

**Short description**
For Jai Shree Shyam Travels drivers: duties, passenger boarding and trip tracking.

**Full description**
The official app for drivers of Jai Shree Shyam Tour & Travels. Only approved drivers can use it.

• Apply to drive: upload licence and photo, get approved by the office
• See today's and upcoming duties, accept or decline new ones
• Board passengers by scanning their QR ticket or entering the OTP
• Record cash or UPI payments, see the cash to hand over
• Share the vehicle's live location with passengers and the office during a trip
• SOS button, navigation to pickup points, call or WhatsApp passengers
• Works in low-network areas: actions are saved and synced later

---

## App content (Policy → App content)

**App access:** *All or some functionality is restricted* → give the reviewer test logins (create them before
submitting — see the end of this file).

**Ads:** No ads.

**Content rating questionnaire:** Category *Utility / Productivity / Communication / Other*; answer **No** to
violence, sexual content, drugs, gambling. Users can interact? **No** (no chat between users). Shares location?
**Yes** (driver app: with the operator and passengers during trips).

**Target audience:** 18+ (both apps).

**News app:** No. **Government app:** No. **Financial features:** None (no lending, no wallet).

### Data safety — Customer app
Data is encrypted in transit (HTTPS): **Yes**. Users can request deletion: **Yes** (in app + web link).

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Name | Yes | Yes — with the assigned driver | App functionality (bookings) | Required |
| Phone number | Yes | Yes — with the assigned driver; WhatsApp messages via Meta | App functionality, communications | Required |
| Email | Yes | No | Account management | Optional |
| Purchase history (bookings) | Yes | No | App functionality | Required |
| App interactions / feedback (ratings, comments) | Yes | No | App functionality, analytics of service quality | Optional |
| Location | **No** (customer app does not read location) | — | — | — |

### Data safety — Driver app
| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Name, phone, address | Yes | Name & phone with passengers of their trips | Account management, app functionality | Required |
| Photos (licence, Aadhaar, profile) | Yes | No (profile photo shown to passengers) | Account management (verification) | Required |
| Precise location | Yes — **during trips only**, also in background | Yes — with passengers and the operator | App functionality (live tracking, safety/SOS) | Required for trips |
| Government ID (Aadhaar last 4, licence number) | Yes | No | Account management (verification) | Required |

### Permissions declarations (driver app)
- **Background location** (`ACCESS_BACKGROUND_LOCATION`): Play asks for a declaration + a short **video**.
  *Use:* "While a driver has started a trip, the app shares the vehicle's location with the passengers of that
  trip and the operator's office, so passengers can track the vehicle and the office can respond to SOS alerts.
  Location is collected only between 'Start trip' and 'End trip' and is shown with a persistent notification."
  *Video (30–60 s, screen recording):* log in as the test driver → open a duty → Start trip → the in-app
  explanation dialog → Android's "Allow all the time" → the "Sharing trip location" notification → End trip.
- **Foreground service — location** (`FOREGROUND_SERVICE_LOCATION`): same purpose, same video.
- **Camera:** scan passenger QR tickets, take licence/profile photos.

### Permissions (customer app)
- **Notifications:** booking updates and trip reminders. No location, no camera.

---

## Before submitting
1. Create test logins for Google's reviewer (I can create them in the admin panel):
   - Customer: a test customer account with a password.
   - Driver: an approved test driver with a password, and one test duty assigned to it.
2. Fill **App access** with those logins.
3. Upload the AAB to **Testing → Internal testing** first, install from Play on the TECNO phone, check, then
   promote to **Production**.
4. Version: both apps are version 1.0.0 (versionCode 1). Every new upload needs a higher versionCode — I bump it
   when building the next AAB.
