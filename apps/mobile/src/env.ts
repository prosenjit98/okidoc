/**
 * Local overrides (edit, don't commit secrets). Leave `null` in development: debug builds use the computer that
 * serves the JS bundle (emulator, USB phone with `adb reverse`, or phone on the same Wi-Fi) — see src/lib/config.ts.
 * Set this for release builds, e.g. 'https://api.okidoc.in', or to force a specific API such as 'http://192.168.1.20:4000'.
 */
export const API_URL_OVERRIDE: string | null = null;
