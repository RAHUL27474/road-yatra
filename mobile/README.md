# Road Yatra – customer mobile app

Expo (SDK 57) + TypeScript + expo-router app for Android and iOS. It talks to the Next.js API in `../web`
(the contract is in `../API.md`).

## Run in development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the web app/API (`cd ../web && npm run dev`). It listens on port 3000.
3. Tell the app where the API is. Copy `.env.example` to `.env` and set:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.20:3000
   ```
   - Real phone with Expo Go: use your computer's LAN IP (`ipconfig` on Windows). The phone must be on the same Wi-Fi.
   - Android emulator: you can skip this. The default is `http://10.0.2.2:3000`.
   - iOS simulator: `http://localhost:3000`.
   - Also set `APP_URL` in the web app's env to the same address so payment links open on the phone.
     (The app rewrites `localhost` payment links to `EXPO_PUBLIC_API_URL` as a fallback.)
4. Start Expo:
   ```bash
   npx expo start
   ```
   Scan the QR code with **Expo Go** (Android) or the Camera app (iOS). Restart with `npx expo start -c` after changing `.env`.

Demo login: mobile `9999999999`. The app logs in by OTP when the server has `otpLogin` on; in test mode
(`OTP_DEV_MODE=true`, the default in development) the OTP is shown in a yellow hint on the login screen.
"Use password instead" logs in with `9999999999` (or `demo@roadyatra.in`) / `demo123`.

In demo payment mode the payment page shows a "Pay (demo)" button. After paying, close the browser and the app
will show the booking status. If the server allows cash (`allowCash`), you can pick "Cash to driver" instead: the
booking is confirmed straight away and the boarding pass (QR + OTP) appears on the booking screen.

The QR code uses `react-native-svg`, which is included in Expo Go, so no development build is needed.

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

## Production build (EAS)

```bash
npm install -g eas-cli        # or use: npx eas-cli@latest <command>
eas login
eas build:configure           # creates eas.json, links the project
```

Set the production API URL for the build, either in `eas.json` under `build.production.env`:
```json
{ "build": { "production": { "env": { "EXPO_PUBLIC_API_URL": "https://api.roadyatra.in" } } } }
```
or as an EAS environment variable. Then build:
```bash
eas build --platform android --profile production   # .aab for Play Store
eas build --platform ios --profile production       # needs an Apple Developer account
eas submit --platform android                       # optional: upload to the stores
```
Use an `https://` API URL for production. Android release builds block plain `http://` traffic.
Use `--profile preview` with `"distribution": "internal"` to get an installable `.apk` for testing.

Bundle id / package: `in.roadyatra.app` (change it in `app.json` before the first store upload if you need another).

## Structure

```
src/
  api.ts            typed fetch wrapper (adds Bearer token), API types, config cache
  auth.tsx          auth context, token in expo-secure-store
  format.ts         INR and IST formatting helpers
  rental.ts         rental request/quote hooks shared by rental screens
  store.ts          in-memory cache (last quote) + browser helpers (payment, tracking, invoice)
  ui.tsx            shared UI components and colours
  DateTimeField.tsx date/time picker (native dialogs on Android, compact picker on iOS)
  app/
    _layout.tsx         root stack + AuthProvider
    (tabs)/             Home, My Bookings, Account tabs
    results.tsx         seat trip search results
    seats/[tripId].tsx  seat map selection
    rentals.tsx         vehicle hire quotes
    passenger.tsx       pickup/drop stops, passenger details, fare summary, pay online or cash
    booking/[id].tsx    boarding pass (QR + OTP), driver, tracking, invoice, SOS, cancel / refund, payment pending
    login.tsx           mobile OTP login (password login as fallback)
    register.tsx        password sign-up (email optional)
```
