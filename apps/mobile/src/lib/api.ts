import type { AuthTokens } from '@okidoc/shared';
import { API_BASE } from './config';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** In-memory session tokens. Not persisted: every app launch unlocks with passcode / biometric (AUTH-07). */
let tokens: AuthTokens | null = null;
let onSessionLost: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export const session = {
  get: () => tokens,
  set: (t: AuthTokens | null) => {
    tokens = t;
  },
  onLost: (fn: () => void) => {
    onSessionLost = fn;
  },
};

async function refresh(): Promise<boolean> {
  if (!tokens) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens!.refreshToken }),
      });
      if (!res.ok) return false;
      tokens = (await res.json()) as AuthTokens;
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export interface ApiInit {
  method?: string;
  body?: unknown;
  form?: FormData;
  auth?: boolean;
}

/** JSON API call with bearer auth and one automatic refresh on 401. */
export async function api<T = any>(path: string, init: ApiInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (tokens && init.auth !== false) headers.authorization = `Bearer ${tokens.accessToken}`;
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? (init.body !== undefined || init.form ? 'POST' : 'GET'),
      headers,
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach Okidoc. Check your internet connection.');
  }
  if (res.status === 401 && retry && tokens && init.auth !== false) {
    if (await refresh()) return api<T>(path, init, false);
    tokens = null;
    onSessionLost?.();
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new ApiError(res.status, data?.code ?? `HTTP_${res.status}`, data?.message ?? 'Something went wrong', data?.details);
  return data as T;
}

/** multipart upload helper for React Native file URIs. */
export function fileForm(file: { uri: string; name: string; type: string }, fields: Record<string, string | undefined | null> = {}) {
  const fd = new FormData();
  fd.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  for (const [k, v] of Object.entries(fields)) if (v != null && v !== '') fd.append(k, v);
  return fd;
}

export const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
export const errCode = (e: unknown) => (e instanceof ApiError ? e.code : undefined);
