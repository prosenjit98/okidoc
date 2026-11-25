/**
 * Path-style navigation on top of React Navigation.
 *
 * Screens navigate with URLs such as `/doctor/abc?clinicId=x` or `/p/bookings?booked=1`. This module maps those
 * paths to React Navigation routes (route names are the path patterns, e.g. `doctor/:id`) so screen code stays
 * independent of the navigator tree.
 */
import { CommonActions, createNavigationContainerRef, StackActions, useRoute } from '@react-navigation/native';
import { useEffect } from 'react';

export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

/** Bottom-tab groups: `/p/home`, `/dr/queue`, `/console/queue` … */
export const TAB_GROUPS: Record<string, string[]> = {
  p: ['home', 'bookings', 'assistant', 'records', 'account'],
  dr: ['queue', 'schedule', 'earnings', 'patients', 'profile'],
  console: ['queue', 'walkin', 'doctors', 'records', 'more'],
};

/** Stack route patterns (names of the root stack screens). */
export const STACK_PATTERNS = [
  'index',
  'intro', 'welcome', 'language', 'role', 'signup', 'otp', 'backup', 'quick-setup', 'login', 'unlock', 'forgot',
  'area', 'search', 'scan', 'clinic/:id', 'doctor/:id', 'book', 'booking/:id', 'notifications', 'support',
  'account/profile', 'account/family', 'account/standing', 'account/security', 'account/notification-settings', 'account/roles', 'account/privacy',
  'd/verify', 'd/sitting', 'd/chamber', 'd/dayoff', 'd/freehours', 'd/openslots',
  'k/select', 'k/register', 'k/add-doctor', 'k/link/:linkId', 'k/staff', 'k/earnings', 'k/profile', 'k/fees', 'k/poster',
  'k/openslots', 'k/bonuses', 'k/subscription', 'k/blocks', 'k/reviews', 'k/account',
] as const;

export type Href = string;
interface Target {
  name: string;
  params?: Record<string, unknown>;
}

function parseQuery(q: string | undefined) {
  const out: Record<string, string> = {};
  if (!q) return out;
  for (const part of q.split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return out;
}

/** Resolve an app path to a route name + params. Unknown paths fall back to `index`. */
export function resolveHref(href: Href): Target {
  const [rawPath, query] = href.split('?');
  const path = rawPath.replace(/^\/+|\/+$/g, '');
  const params = parseQuery(query);
  if (!path) return { name: 'index', params };
  const segs = path.split('/');
  if (TAB_GROUPS[segs[0]]) {
    const screen = segs[1] && TAB_GROUPS[segs[0]].includes(segs[1]) ? segs[1] : TAB_GROUPS[segs[0]][0];
    return { name: segs[0], params: { screen, params } };
  }
  for (const pattern of STACK_PATTERNS) {
    const ps = pattern.split('/');
    if (ps.length !== segs.length) continue;
    const found: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < ps.length; i++) {
      if (ps[i].startsWith(':')) found[ps[i].slice(1)] = decodeURIComponent(segs[i]);
      else if (ps[i] !== segs[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { name: pattern, params: { ...params, ...found } };
  }
  return { name: 'index', params };
}

let pending: { href: Href; mode: 'push' | 'replace' } | null = null;

function run(href: Href, mode: 'push' | 'replace') {
  if (!navigationRef.isReady()) {
    pending = { href, mode };
    return;
  }
  const t = resolveHref(href);
  const isTab = !!TAB_GROUPS[t.name];
  if (mode === 'replace') navigationRef.dispatch(StackActions.replace(t.name, t.params));
  else if (isTab) navigationRef.dispatch(CommonActions.navigate({ name: t.name, params: t.params }));
  else navigationRef.dispatch(StackActions.push(t.name, t.params));
}

/** Call from NavigationContainer `onReady` to flush navigation requested before mount (e.g. a notification tap). */
export function flushPendingNavigation() {
  if (pending && navigationRef.isReady()) {
    const p = pending;
    pending = null;
    run(p.href, p.mode);
  }
}

export const router = {
  push: (href: Href) => run(href, 'push'),
  replace: (href: Href) => run(href, 'replace'),
  back: () => {
    if (navigationRef.isReady() && navigationRef.canGoBack()) navigationRef.goBack();
  },
  canGoBack: () => navigationRef.isReady() && navigationRef.canGoBack(),
};

/** Route params as strings (query string + path params). */
export function useLocalSearchParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  const route = useRoute();
  return ((route.params ?? {}) as T);
}

/** Declarative redirect (replaces the current route). */
export function Redirect({ href }: { href: Href }) {
  useEffect(() => {
    // Wait a frame: on a just-mounted navigator this effect runs before the navigator can handle actions.
    const id = requestAnimationFrame(() => router.replace(href));
    return () => cancelAnimationFrame(id);
  }, [href]);
  return null;
}
