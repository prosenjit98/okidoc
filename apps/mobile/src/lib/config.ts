import { Platform, TurboModuleRegistry } from 'react-native';
import { API_URL_OVERRIDE } from '../env';

/**
 * In development the API runs on the same computer as Metro, so take the host the JS bundle was loaded from:
 *   - Android emulator        → bundle from 10.0.2.2:8088         → API http://10.0.2.2:4000
 *   - USB phone (adb reverse) → bundle from localhost:8088        → API http://localhost:4000 (adb reverse tcp:4000 tcp:4000)
 *   - Phone on the same Wi-Fi → bundle from <PC LAN IP>:8088      → API http://<PC LAN IP>:4000
 * Release builds have no dev server; they use API_URL_OVERRIDE (set it to the production URL) or the emulator default.
 */
function devServerHost(): string | null {
  if (!__DEV__) return null;
  try {
    const url = TurboModuleRegistry.get<{ getConstants(): { scriptURL?: string } }>('SourceCode')?.getConstants().scriptURL;
    const m = url?.match(/^https?:\/\/([^/:]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const fallback = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
const devHost = devServerHost();
export const API_URL = (API_URL_OVERRIDE ?? (devHost ? `http://${devHost}:4000` : fallback)).replace(/\/$/, '');
export const API_BASE = `${API_URL}/api/v1`;
export const IS_DEV = __DEV__;
