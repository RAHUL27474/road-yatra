# Road Yatra Driver

The Android-first (iOS-compatible) app for Road Yatra's drivers: self-registration for new drivers, duties,
passenger manifest, QR/OTP boarding, cash collection, full-cab start/end with OTP and odometer, and live location sharing.
Expo SDK 57 + expo-router + TypeScript. It talks to the Next.js API in `../web` (see `../API.md`).

## Run it (Expo Go)

```bash
cd driver
npm install
cp .env.example .env        # then edit EXPO_PUBLIC_API_URL
npx expo start              # scan the QR code with Expo Go on your phone
```

The API base URL comes from `EXPO_PUBLIC_API_URL`:

- Phone on the same Wi-Fi as your computer: `EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:3000`
- Android emulator: leave it unset, and the app falls back to `http://10.0.2.2:3000` (the host machine).
- Production: `EXPO_PUBLIC_API_URL=https://your-domain`

`EXPO_PUBLIC_*` values are baked in at bundle time, so restart `npx expo start` (or rebuild) after you change one.

Sample login from the seed: `9000000001` (OTP, which is shown in a yellow hint in test mode) or the password `driver123`.
Any mobile number can log in with OTP; only approved drivers (role `DRIVER`) reach the Duties screens. Admin accounts are refused.

## Driver registration

New drivers sign up in the app, and the office approves them in the website's Admin → Drivers.

1. **Verify the number.** On the login screen, tap **"New driver? Apply to drive with Road Yatra"** (or just log in with OTP).
   For a number with no account, `/api/auth/otp/verify` answers `{ needsName: true }`; the app asks for the full name and
   resubmits the same OTP with it. The new account has role `CUSTOMER`. A wrong OTP at the name step goes back to the OTP step.
2. **Route by status.** After every login and app start, the app loads `GET /api/driver/application` (and `/api/auth/me`) and
   picks the screen in one state update (`Stack.Protected` guards in `app/_layout.tsx`, so nothing flashes):

   | Account | Screen |
   |---|---|
   | role `DRIVER` and application `APPROVED` (self-registered or admin-created) | Duties tabs |
   | no application | **Apply** (`app/apply.tsx`) |
   | `PENDING` (or `APPROVED` while the role is still `CUSTOMER`) | **Application under review** (`app/status.tsx`) |
   | `REJECTED` | Status screen with the office's reason and **Fix and re-apply** |
   | status couldn't load (offline, non-driver) | Status screen with **Try again** |

   If any duty endpoint answers 403 with "under review" / "not approved", `api.ts` tells the auth context, which reloads
   the status and re-routes. The under-review screen also re-checks when the app comes back to the foreground, on
   pull-to-refresh, and with the **Check status** button; on approval it moves to the Duties tabs by itself.
3. **Apply** is a 4-step form with a progress stepper: Personal (name, address, emergency contact, experience) →
   Licence (number, expiry date picker, licence photo) → Identity & photo (Aadhaar last 4 and photo, both optional; a selfie,
   required) → Review & submit (summary cards with Edit links, consent checkbox). Validation mirrors the server
   (`web/src/app/api/driver/apply/route.ts`); server errors are shown, and the form jumps to the step they belong to.
4. **Photos** use `expo-image-picker` (Take photo / Choose from gallery, `quality: 0.6`, front camera for the selfie where the
   camera app supports it), then `expo-image-manipulator` resizes to at most 1600 px and re-encodes to JPEG when needed.
5. **Submit** sends `multipart/form-data` to `POST /api/driver/apply` with the Bearer token, using `FormData` file objects
   `{ uri, name, type }` (no manual Content-Type), through `XMLHttpRequest` so the upload shows a progress bar.
   Field names: `name, address, experienceYears, emergencyContact, licenceNo, licenceExpiry, aadhaarLast4` and files
   `photo, licencePhoto, aadhaarPhoto`.
6. **Re-applying** after a rejection prefills the form from the earlier application. Photos already uploaded show as
   thumbnails ("Uploaded earlier"; private documents are loaded with the Bearer token). Only re-picked photos are sent;
   the server keeps the old files for the rest.

## Build an installable APK (EAS)

```bash
npm install -g eas-cli        # or prefix each command with: npx eas-cli@latest
eas login
eas build:configure           # creates eas.json and links the project
eas build -p android --profile preview    # an installable .apk you can share with drivers
```

Make sure the `preview` profile in `eas.json` builds an APK and sets the server URL, for example:

```json
"preview": { "distribution": "internal", "android": { "buildType": "apk" }, "env": { "EXPO_PUBLIC_API_URL": "https://your-domain" } }
```

Use `eas build -p android --profile production` for a Play Store bundle (.aab), and `eas build -p ios` for iOS.

## Location sharing

While any duty is **STARTED**, the app posts the GPS position (lat, lng, speed in km/h, heading) to
`POST /api/driver/location` about every 20 s:

- **Foreground:** `Location.watchPositionAsync` while the app is open.
- **Background:** an `expo-task-manager` task fed by `Location.startLocationUpdatesAsync`. On Android this runs
  as a foreground service with a "Sharing trip location" notification. The task reads the login token from SecureStore.

Sharing stops when no duty is in progress, on logout, or when the server answers 409 (no trip in progress).
Trip screens keep the screen awake.

> **Background location only works in a development or production build** (`eas build` or `npx expo run:android`),
> **not in Expo Go**. Expo Go doesn't include the background-location capability, so sharing there works only
> while the app is open. On Android, the driver must choose **"Allow all the time"** for location (the app asks
> once). Some phone brands, such as Xiaomi, Oppo, Vivo and Realme, also need battery optimisation turned off for the app.

## Project layout

```
src/
  api.ts         fetch wrapper (Bearer token), API types, config cache
  auth.tsx       OTP / password login (name for new numbers), status routing (Access), token in expo-secure-store
  applyForm.ts   application form state, prefill and validation (mirrors the server)
  photos.ts      take / choose a photo, compress and resize for upload
  duties.tsx     shared duties state, starts/stops location sharing
  location.ts    foreground watcher + background task (expo-location / expo-task-manager)
  format.ts      ₹ en-IN money, IST times
  ui.tsx         large-touch-target UI kit (Button, Card, Sheet, Badge, ...)
  Scanner.tsx    expo-camera QR scanner
  app/
    _layout.tsx          stack + auth guard
    login.tsx            OTP / password login, name step, "New driver? Apply" entry
    apply.tsx            4-step driver application form
    status.tsx           application under review / not approved
    (tabs)/index.tsx     Duties: On trip / Today / Upcoming / Recent
    (tabs)/profile.tsx   photo, licence, office support, logout
    trip/[id].tsx        shared trip: manifest, scan / OTP boarding, no-show, cash, start / end
    rental/[id].tsx      full cab: customer, navigate, start / end with OTP + odometer, cash
```

Checks: `npx tsc --noEmit`, `npx expo-doctor`.
