This is a **bare React Native** app (React Native CLI, RN 0.88). There is no Expo: no `expo`, `expo-*`, `expo-router`, Expo Go or EAS.

- Navigation: React Navigation (`src/navigation`). Screens are plain components in `src/screens`; use `router` / `useLocalSearchParams` / `Redirect` from `@/lib/nav` (thin layer over React Navigation with path-style routes).
- Native projects live in `android/` and `ios/` and are committed — edit them directly (permissions, deep links, Firebase files).
- Install native libraries with `npm install -w @okidoc/mobile <pkg>` from the repo root, then rebuild (`npx react-native run-android --port 8088`, `cd ios && pod install`).
- Metro runs on port **8088** (8081 belongs to another project). Config: `metro.config.js` (monorepo watchFolders, `@okidoc/shared` → packages/shared/dist).
- Verify without native toolchains: `npx tsc --noEmit` and `npx react-native bundle --platform android|ios --dev false --entry-file index.js --bundle-output <file>`.
