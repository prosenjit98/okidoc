'use client';

import type { AuthTokens, MeUser } from '@okidoc/shared';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const KEY = 'okidoc.web.session';

export interface Session {
  tokens: AuthTokens;
  user: MeUser;
}

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

export function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('okidoc:session'));
}

let refreshing: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  const s = loadSession();
  if (!s) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: s.tokens.refreshToken }),
      });
      if (!res.ok) {
        saveSession(null);
        return false;
      }
      const tokens = (await res.json()) as AuthTokens;
      saveSession({ ...s, tokens });
      return true;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

/** JSON API call with bearer auth, automatic refresh on 401 and typed errors. */
export async function api<T = any>(path: string, init: { method?: string; body?: unknown; form?: FormData; raw?: boolean } = {}, retry = true): Promise<T> {
  const s = loadSession();
  const headers: Record<string, string> = { 'x-okidoc-client': 'web' };
  if (s) headers.authorization = `Bearer ${s.tokens.accessToken}`;
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: init.method ?? (init.body !== undefined || init.form ? 'POST' : 'GET'),
    headers,
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
  if (res.status === 401 && retry && s && (await refresh())) return api<T>(path, init, false);
  if (init.raw) return res as unknown as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.code ?? `HTTP_${res.status}`, data?.message ?? 'Request failed', data?.details);
  return data as T;
}

export async function download(path: string, filename: string) {
  const res = await api<Response>(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST', body: {} });
  } catch {
    /* ignore */
  }
  saveSession(null);
  // Full reload: drops every cached query of the signed-out account, and lands on a clean /login (no ?next=).
  if (typeof window !== 'undefined') window.location.replace('/login');
}
