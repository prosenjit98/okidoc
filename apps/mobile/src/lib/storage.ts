import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

/** Non-secret preferences (language, area, active role, offline queue). */
export const prefs = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const v = await AsyncStorage.getItem(`okidoc.${key}`);
      return v == null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  async set(key: string, value: unknown) {
    await AsyncStorage.setItem(`okidoc.${key}`, JSON.stringify(value));
  },
  async remove(key: string) {
    await AsyncStorage.removeItem(`okidoc.${key}`);
  },
};

const SERVICE = 'in.okidoc.app';

/** Secret-ish values (device identity, tokens) in the Keychain / Android Keystore, without user-presence checks. */
export const secure = {
  async get(key: string): Promise<string | null> {
    try {
      const r = await Keychain.getGenericPassword({ service: `${SERVICE}.${key}` });
      return r ? r.password : null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: string) {
    await Keychain.setGenericPassword(key, value, {
      service: `${SERVICE}.${key}`,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });
  },
  async remove(key: string) {
    await Keychain.resetGenericPassword({ service: `${SERVICE}.${key}` });
  },
};

const BIO_SERVICE = `${SERVICE}.device_secret`;

/**
 * Biometric device secret (AUTH-06/07). Stored with access control BIOMETRY_ANY_OR_DEVICE_PASSCODE, so reading it
 * requires the OS prompt (fingerprint / face / device PIN or pattern). Biometric data never leaves the device; the
 * server only ever sees the random secret it issued.
 */
export const biometricSecret = {
  bound: true,
  async available(): Promise<boolean> {
    try {
      const type = await Keychain.getSupportedBiometryType();
      if (type) return true;
      return await Keychain.isPasscodeAuthAvailable();
    } catch {
      return false;
    }
  },
  async save(secret: string) {
    await Keychain.setGenericPassword('okidoc', secret, {
      service: BIO_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      storage: Platform.OS === 'android' ? Keychain.STORAGE_TYPE.AES_GCM : undefined,
      authenticationPrompt: { title: 'Okidoc', subtitle: 'Confirm to enable quick login', cancel: 'Cancel' },
    });
  },
  /** Shows the OS prompt. Returns null if cancelled / unavailable. */
  async read(): Promise<string | null> {
    try {
      const r = await Keychain.getGenericPassword({
        service: BIO_SERVICE,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
        authenticationPrompt: { title: 'Unlock Okidoc', subtitle: 'Use your fingerprint, face or screen lock', cancel: 'Use passcode' },
      });
      return r ? r.password : null;
    } catch {
      return null;
    }
  },
  async clear() {
    try {
      await Keychain.resetGenericPassword({ service: BIO_SERVICE });
    } catch {
      /* ignore */
    }
  },
};

/** RFC 4122 v4 id (react-native-get-random-values polyfills crypto.getRandomValues; imported in index.js). */
export const randomId = () => uuidv4();

/** Stable per-install device id (sent to the API for device-bound sessions). */
export async function getDeviceId(): Promise<string> {
  let id = await secure.get('device_id');
  if (!id) {
    id = `${Platform.OS}-${randomId()}`;
    await secure.set('device_id', id);
  }
  return id;
}

/** What this device remembers between launches for quick login. */
export interface QuickLoginState {
  userId: string;
  name: string;
  method: 'PASSCODE' | 'BIOMETRIC';
  hasPasscode: boolean;
}

export const quickState = {
  get: () => prefs.get<QuickLoginState | null>('quick', null),
  set: (s: QuickLoginState) => prefs.set('quick', s),
  clear: async () => {
    await prefs.remove('quick');
    await biometricSecret.clear();
  },
};
