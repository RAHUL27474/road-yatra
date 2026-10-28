# Project status — Jai Shree Shyam Tour & Travels (Road Yatra)

Status as of **28 Oct 2026**. Client: Jai Shree Shyam Tour & Travels, Khatima.

The project has three parts, all in this repository:

| Part | Folder | What it is |
|---|---|---|
| Website, admin panel, API | `web/` | Next.js 15 + Prisma; Postgres (Neon) on Vercel |
| Customer app | `mobile/` | Expo / React Native, package `in.roadyatra.app` |
| Driver app | `driver/` | Expo / React Native, package `in.roadyatra.driver` |

Live site: https://jaishreeshyamtravels.com (Vercel project `tokribajar/road-yatra`, domain on GoDaddy).
API reference: [`API.md`](../API.md). Play Console guide: [`play-store.md`](play-store.md).

---

## 1. Done

### Website and admin panel
- Booking form at the top of the home page (visible without scrolling on a laptop).
- Shared seats and full-cab hire: one way, round trip, local, airport.
- Route pages (`/taxi/[route]`), pilgrimage page (`/yatra`), sitemap, feedback form, privacy, terms and delete-account pages.
- "Our drivers" section with driver photos (admin chooses who is shown).
- Admin panel:
  - Dashboard with SOS alerts and cash received.
  - Drivers: approve, photo upload, remove, ratings, cash handed over.
  - Trips: schedule, assign the day's driver inline.
  - **Fleet:** see which vehicle runs on which route and switch it on/off per route.
  - Bookings: cash/UPI received, seat refunds, search.
  - Feedback, Messages (WhatsApp template status), Stops (landmark, photo), Settings (UPI ID, travel policy, return discount, free-change window).

### Booking rules (server)
- Real seat layouts: Ertiga 1-3-2, Dzire 1-3.
- Women's seats: the seat next to a woman passenger is kept for women.
- Name and phone per seat, free date/pickup change once, cancel single seats, return trip with a discount.
- Pay at boarding by **cash or UPI**. Razorpay code is kept but switched off.
- Logins can be revoked (app tokens and website sessions); unverified numbers can't see office bookings.

### Customer app
- Seat map, travellers per seat, e-ticket with QR that works offline.
- Ride-app style driver card: name, photo, vehicle number plate, call/WhatsApp.
- Live tracking link, trip reminders, booking alerts, rating after the trip.
- Manage booking: change date/pickup, cancel seats, book return.
- Account: edit profile, delete account, feedback.
- **1.0.1 (versionCode 2):** update prompt driven by the server, "Share the app", "Rate us on Google Play", and a Play rating request after a 4–5 star trip.

### Driver app
- Apply to drive, approval by the office.
- Duties: accept/decline, new-duty alerts.
- Board passengers by QR scan or OTP; mark no-show.
- Record cash or UPI; Cash tab shows what to hand over.
- Live location during a trip (also in the background, with a notification); SOS button.
- Works offline: actions are queued and sent later.
- Profile with licence and vehicle papers.

### Messages
- All customer/driver messages go by **WhatsApp** (Meta Cloud API), not SMS.
- **OTP login by WhatsApp is live** using template `otp_registration_jss` (language `en_US`) on the Tokri Bazaar WhatsApp number. `OTP_DEV_MODE` is off.

### Google Play (Tokri Bazaar organization account)
- Release signing with an upload key; Play App Signing on.
- Store assets in `D:\Play-Store-Assets`: icons, feature graphics, 9:16 screenshots for both apps, background-location video for the driver app (personal notification blurred).
- Reviewer test accounts: one customer, one approved driver, and a hidden test trip with one booking (`RYTEST10`). Logins are in `D:\ry\keys\play-review-logins.txt` on the build laptop — not in this repo.
- Customer app: published to internal testing and installed from Play on the test phone; 1.0.1 uploaded.
- Driver app: AAB ready; Play Console steps given.

---

## 2. Pending

### Play Store
- [ ] **Driver app:** finish App content (data safety, background location + foreground service declarations with the YouTube video link), upload `D:\JSS-Travels-Driver.aab`, send for review.
- [ ] **Customer app:** confirm 1.0.1 is sent to Production review.
- [ ] **Reviewer test trip is on 29 Oct 2026, 09:30 IST.** If either review is still open, move it forward (the driver app only shows duties for the next 7 days).
- [ ] After customer 1.0.1 is live on Play: set `CUSTOMER_APP_LATEST_VERSION=2` in Vercel so older installs see the update prompt.
- [ ] Before installing the driver app from Play on the test phone, uninstall the old sideloaded build (different signature).

### WhatsApp
- [ ] Create and get approved the remaining templates (list in `web/src/lib/notify.ts` → `WHATSAPP_TEMPLATES`, also in Admin → Messages): booking confirmed, driver assigned, booking changed, cancelled, refund done, driver nearby, duty assigned, driver approved/rejected, duty rejected, SOS. Until each name is set in Vercel (`WHATSAPP_TEMPLATE_<EVENT>`), that message is only logged, not sent.
- [ ] Later: move from the Tokri Bazaar number to Jai Shree Shyam's own WhatsApp number (change `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` in Vercel; templates must exist on the new account).

### Client / office
- [ ] Set the office **UPI ID** in Admin → Settings (until then the apps offer cash only).
- [ ] Enter real drivers (with photos), vehicles, routes and trips.
- [ ] Keep the Play test accounts and test trip until both apps are approved.

### Optional (not started)
- Firebase push notifications (today's alerts come from a background check and can be late).
- Automatic WhatsApp trip reminders (needs a template and a cron job).
- GitHub → Vercel auto-deploy (deploys are run by hand with `vercel --prod`).
- "Get it on Google Play" badge on the website once the customer app is live.
- Switch on Razorpay when keys are available.
- R8/minify for a smaller app, in a later update with full testing.
- Three minor leftovers from the last code review.

---

## 3. How things are built and deployed

**Website:** `cd web && npx vercel --prod`. The build runs `prisma db push` and `prisma/prod-init.ts` (creates the admin account if missing).

**Android apps:** built from copies in `D:\ry\mobile` and `D:\ry\driver` (C: had no disk space).
1. Copy `src/` and `app.json` from the repo folder to the copy.
2. Raise `versionCode` in both `app.json` and `android/app/build.gradle` for every Play upload.
3. Build:
   ```
   cd D:\ry\<app>\android
   set ANDROID_HOME=C:\Users\James Bond\AppData\Local\Android\Sdk
   set GRADLE_USER_HOME=D:\ry\gradle-home
   gradlew bundleRelease
   ```
4. Output: `android\app\build\outputs\bundle\release\app-release.aab`.

Signing uses the upload key `D:\ry\keys\jss-upload.jks` (password in `D:\ry\keys\upload-key-info.txt`, read by Gradle from `D:\ry\gradle-home\gradle.properties`). **Back up the `D:\ry\keys` folder** — a lost upload key means asking Google support to reset it.

| File | Version |
|---|---|
| `D:\JSS-Travels-Customer-1.0.1.aab` | customer 1.0.1, versionCode 2 |
| `D:\JSS-Travels-Driver.aab` | driver 1.0.0, versionCode 1 |
| `D:\JSS-Travels-*.apk` | old debug test builds — do not share |

Secrets (WhatsApp token, database URL, JWT secret) live only in Vercel environment variables and `web/.env.local`, never in git.
