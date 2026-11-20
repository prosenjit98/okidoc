import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { api } from './api';
import { getDeviceId } from './storage';

/**
 * Push via Firebase Cloud Messaging (PRD §8). Tokens are sent to the API prefixed with `fcm:` so the server routes
 * them through FCM HTTP v1 (Expo tokens are still accepted server-side for compatibility).
 *
 * Requires android/app/google-services.json and ios/Okidoc/GoogleService-Info.plist from the Firebase console.
 * Without them Firebase is not initialised and these functions quietly do nothing — in-app notifications still work.
 */
function messaging() {
  try {
    return getMessaging(getApp());
  } catch {
    return null;
  }
}

async function sendToken(token: string) {
  await api('/me/push-token', { body: { deviceId: await getDeviceId(), pushToken: `fcm:${token}` } });
}

let tokenSub: (() => void) | null = null;

export async function registerForPush() {
  try {
    const m = messaging();
    if (!m) return;
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (r !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    if (Platform.OS === 'ios') {
      const status = await requestPermission(m);
      if (status !== AuthorizationStatus.AUTHORIZED && status !== AuthorizationStatus.PROVISIONAL) return;
      await registerDeviceForRemoteMessages(m);
    }
    await sendToken(await getToken(m));
    tokenSub?.();
    tokenSub = onTokenRefresh(m, (t) => {
      sendToken(t).catch(() => undefined);
    });
  } catch {
    /* push is best-effort */
  }
}

/** Notification taps (background → foreground, and cold start). Returns an unsubscribe function. */
export function onNotificationOpened(handler: (data: Record<string, unknown> | undefined) => void) {
  const m = messaging();
  if (!m) return () => undefined;
  getInitialNotification(m)
    .then((msg) => {
      if (msg) handler(msg.data as Record<string, unknown> | undefined);
    })
    .catch(() => undefined);
  return onNotificationOpenedApp(m, (msg) => handler(msg.data as Record<string, unknown> | undefined));
}

/** Registered in index.js, outside React. Notification messages are displayed by the OS; nothing else to do. */
export function registerBackgroundPushHandler() {
  const m = messaging();
  if (!m) return;
  setBackgroundMessageHandler(m, async () => undefined);
}

/** Route to open for a tapped notification. */
export function routeForNotification(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (typeof data.bookingId === 'string') return `/booking/${data.bookingId}`;
  if (typeof data.ticketId === 'string') return '/support';
  return '/notifications';
}
