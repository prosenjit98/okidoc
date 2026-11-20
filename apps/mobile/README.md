# Okidoc mobile — bare React Native

One app for **Patient**, **Doctor** and **Clinic / Pharmacy** (phone + tablet).
React Native **0.88.1** (New Architecture, Hermes), React Native CLI — **no Expo**.

## Prerequisites

| | |
|---|---|
| Node | ≥ 22.11 (repo uses npm workspaces) |
| Android | **JDK 17**, Android Studio with SDK Platform 36/37, Build-Tools 37, NDK 27.1.12297006, an emulator or a device with USB debugging |
| iOS (macOS only) | Xcode 16+, CocoaPods (`bundle install` uses the Gemfile), iOS 15.5+ target |

Set `JAVA_HOME` to JDK 17 and `ANDROID_HOME` to your SDK (e.g. `%LOCALAPPDATA%\Android\Sdk`). JDK 21 also works
(verified on Windows with Gradle 9.4.1).

**Windows: use CMake 3.31.6 or newer.** The native build creates object-file paths longer than 260 characters
(the repository path is repeated inside `.cxx`). The ninja bundled with the default CMake 3.22.1 cannot handle them
(`Filename longer than 260 characters`), even with Windows long paths enabled. Install a newer CMake and point Gradle
at it in `android/local.properties` (machine-specific, not committed):

```properties
sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk
cmake.dir=C:/Users/<you>/AppData/Local/Android/Sdk/cmake/3.31.6
```

`sdkmanager "cmake/3.31.6"` installs it. Use forward slashes in `local.properties` — backslashes are escape characters
there. The first build downloads NDK 27.1 and CMake and takes 30–50 minutes; later builds are much faster.

## 1. Install & build shared code (repo root)

```bash
npm install
npm run build:shared        # @okidoc/shared → packages/shared/dist (Metro resolves it from there)
npm run db:start            # separate terminal: local Postgres
npm run dev:api             # separate terminal: API on http://localhost:4000
```

## 2. API URL

Debug builds use the API on the computer that serves the JS bundle — nothing to edit:

| Device | Bundle loaded from | API used |
|---|---|---|
| Android emulator | `10.0.2.2:8088` | `http://10.0.2.2:4000` |
| USB phone (recommended) | `localhost:8088` via `adb reverse` | `http://localhost:4000` via `adb reverse` |
| Phone on the same Wi-Fi | `<PC LAN IP>:8088` | `http://<PC LAN IP>:4000` (allow port 4000 in the firewall) |

USB phone setup, once per connection:

```bash
adb reverse tcp:8088 tcp:8088   # Metro
adb reverse tcp:4000 tcp:4000   # API
```

Release builds have no dev server: set `API_URL_OVERRIDE` in `src/env.ts` to the production API URL.
iOS blocks plain-HTTP LAN addresses (ATS); use the simulator or an HTTPS tunnel for iPhone testing.

## 3. Run

Metro uses port **8088** (8081 is used by another local project — don't stop it).

```bash
cd apps/mobile
npx react-native start --port 8088          # terminal 1 (or: npm run start -w @okidoc/mobile)

# Android (terminal 2)
npx react-native run-android --port 8088

# iOS (macOS, terminal 2)
cd ios && bundle install && bundle exec pod install && cd ..
npx react-native run-ios --port 8088
```

`android/gradle.properties` sets `reactNativeDevServerPort=8088` and the Podfile adds `RCT_METRO_PORT=8088`,
so builds started from Android Studio / Xcode also use 8088.

If the app stays on "Reloading…" after a native build, restart Metro with `--reset-cache`: Gradle writes tens of
thousands of files under `android/` and `node_modules/*/android/`, which `metro.config.js` now excludes.

Dev-only behaviour worth knowing when testing on a device: typing "r" twice quickly outside a text box reloads the JS
(React Native dev shortcut), and a reload resets the session to the passcode screen. Release builds do neither.

Demo logins (seed): patient `9000000301 / Patient@123`, doctor `9000000201 / Doctor@1234`,
clinic owner `9000000101 / Clinic@1234`, queue manager `9000000111 / Queue@1234`.
In development the API echoes OTP codes and payments use the mock gateway ("Test payment" sheet).

## App icon, splash and first-launch intro

- **Artwork:** `assets/brand/okidoc-icon.svg` is the master (a magnifier holding a heartbeat line, on the teal gradient).
  `node scripts/render-brand.mjs <repo root>` re-renders every PNG from it (needs `playwright-core` and Chrome):
  iOS `AppIcon-1024.png` + `LaunchLogo`, Android legacy `mipmap-*/ic_launcher(_round).png`, Play Store 512 px
  (`assets/brand/play-store-512.png`) and the in-app mark `src/assets/logo-mark*.png`.
- **Android 8+ launcher icon** is adaptive and vector: `res/drawable/ic_launcher_background.xml` +
  `ic_launcher_foreground.xml` (also the Android 13 themed/monochrome icon), wired in `res/mipmap-anydpi-v26/`.
- **Splash:** Android 12+ uses the system splash (`values-v31/styles.xml`: navy background + `ic_splash_logo`);
  Android 7–11 use the window background `drawable/splash_background.xml`; iOS uses `LaunchScreen.storyboard`.
  All three centre the same 124-pt tile on navy, and `src/components/Brand.tsx` → `BrandSplash` continues the same
  picture while the app restores the session, so there is no jump between native and JS.
- **First-launch intro:** `src/screens/auth/intro.tsx` — four slides shown once per install (flag `okidoc.intro.seen`
  in AsyncStorage), before Welcome. Clear app data to see it again.

## 4. Keys & native files you must add

| What | Where | Notes |
|---|---|---|
| **Firebase (push)** | `android/app/google-services.json`, `ios/Okidoc/GoogleService-Info.plist` (add to the Xcode target) | From the Firebase console, app id `in.okidoc.app`. Without them the app runs, push is skipped. API side: set `FCM_SERVICE_ACCOUNT_JSON` in `apps/api/.env`. For iOS also upload an APNs key in Firebase. |
| **AdMob** | `app.json` → `react-native-google-mobile-ads.android_app_id` / `ios_app_id` (and `GADApplicationIdentifier` in `ios/Okidoc/Info.plist`) | Google's **test** app ids are configured. Ad **unit** ids come from the admin portal (Ads → placements). Debug builds always use Google test units. |
| **Razorpay** | API `.env`: `PAYMENT_GATEWAY=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | The app receives the key id per order and opens the native Razorpay checkout (`react-native-razorpay`). |
| Release signing | `android/app/build.gradle` `signingConfigs.release` + your keystore | Currently release uses the debug keystore. |

## Verify without native toolchains

```bash
npx tsc --noEmit
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output build/index.android.bundle --assets-dest build/android-assets
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output build/main.jsbundle --assets-dest build/ios-assets
```

## Platform libraries

| Concern | Library |
|---|---|
| Navigation | `@react-navigation/native` + `native-stack` + `bottom-tabs` (`src/navigation`; path-style `router` in `src/lib/nav.ts`) |
| Secure storage, biometric/PIN unlock | `react-native-keychain` (device secret with `BIOMETRY_ANY_OR_DEVICE_PASSCODE`) |
| Push | `@react-native-firebase/app` + `messaging` (FCM) |
| QR scan | `react-native-vision-camera` v5 + `react-native-vision-camera-barcode-scanner` (ML Kit) + Nitro |
| Photos / documents | `react-native-image-picker`, `@react-native-documents/picker` |
| Files & sharing | `react-native-blob-util`, `react-native-share`, `react-native-view-shot` |
| UI | `react-native-linear-gradient`, `@react-native-vector-icons/ionicons` (fonts bundled by the package) |
| Device | `react-native-get-random-values` + `uuid`, `@react-native-community/netinfo`, `react-native-localize` |
| Payments | `react-native-razorpay` (mock sheet when the API uses the mock gateway) |
| Ads | `react-native-google-mobile-ads` (UMP consent, non-personalised banner / native / interstitial) |

## Layout

- `index.js` → `src/App.tsx` (providers, NavigationContainer, push/linking)
- `src/navigation` — root stack (auth-gated) and the three tab navigators (floating pill tab bar)
- `src/screens` — `auth/`, `p/` patient tabs, `dr/` doctor tabs, `console/` clinic tabs, `d/` doctor screens, `k/` clinic screens, shared screens
- `src/lib` — API client, auth/quick-login, i18n, sockets, push, offline walk-ins, files, pickers, formatting
- `src/components` — UI kit and shared widgets (`AdSlot`, `admob`, `PaySheet`, …)
- Deep links: `okidoc://clinic/OK-XXXXX`, `okidoc://booking/<id>` (Android intent-filter, iOS `CFBundleURLTypes`)
