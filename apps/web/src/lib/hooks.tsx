'use client';

import { ADMIN_ROLES, type MeUser } from '@okidoc/shared';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, API_URL, ApiError, loadSession, type Session } from './api';

// ---------------------------------------------------------------- providers

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2, refetchOnWindowFocus: true },
        },
      }),
  );
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------- session

export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const read = () => setSession(loadSession());
    read();
    window.addEventListener('okidoc:session', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('okidoc:session', read);
      window.removeEventListener('storage', read);
    };
  }, []);
  return session;
}

export const isAdminUser = (u?: MeUser | null) => !!u?.roles.some((r) => ADMIN_ROLES.includes(r));

/** Redirect to /login when there is no session; optional admin-only gate. */
export function useRequireAuth(opts: { admin?: boolean } = {}) {
  const session = useSession();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (session === null) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (session && opts.admin && !isAdminUser(session.user)) router.replace('/console');
  }, [session, opts.admin, router, path]);
  return session;
}

// ---------------------------------------------------------------- data

export function useApi<T = any>(key: unknown[], path: string | null, opts: { refetchInterval?: number } = {}) {
  return useQuery<T>({ queryKey: key, queryFn: () => api<T>(path!), enabled: !!path, refetchInterval: opts.refetchInterval });
}

/** Mutation that toasts errors and invalidates the given query keys. */
export function useAction<V = any, R = any>(fn: (v: V) => Promise<R>, opts: { invalidate?: unknown[][]; success?: string | ((r: R) => string) } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<R, ApiError, V>({
    mutationFn: fn,
    onSuccess: (r) => {
      for (const k of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: k });
      if (opts.success) toast(typeof opts.success === 'function' ? opts.success(r) : opts.success, 'ok');
    },
    onError: (e) => toast(e.message, 'bad'),
  });
}

// ---------------------------------------------------------------- realtime

let socket: Socket | null = null;
function getSocket() {
  if (!socket) {
    socket = io(API_URL, { transports: ['websocket'], auth: { token: loadSession()?.tokens.accessToken }, reconnection: true });
  }
  return socket;
}

/** Subscribe to a socket room and run `onEvent` for the given events (NFR-01 live queue). */
export function useRoom(room: string | null, events: string[], onEvent: (event: string, payload: any) => void) {
  const evKey = events.join(',');
  useEffect(() => {
    if (!room) return;
    const s = getSocket();
    const subscribe = () => s.emit('subscribe', { room });
    subscribe();
    s.on('connect', subscribe);
    const handlers = events.map((e) => {
      const h = (p: unknown) => onEvent(e, p);
      s.on(e, h);
      return [e, h] as const;
    });
    return () => {
      s.emit('unsubscribe', { room });
      s.off('connect', subscribe);
      for (const [e, h] of handlers) s.off(e, h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, evKey]);
}

// ---------------------------------------------------------------- toasts

type Toast = { id: number; text: string; tone: 'ok' | 'bad' | 'info' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useMemo(
    () => (text: string, tone: Toast['tone'] = 'info') => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, text, tone }]);
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
    },
    [],
  );
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl px-4 py-3 text-sm text-white shadow-lg ${t.tone === 'bad' ? 'bg-red-600' : t.tone === 'ok' ? 'bg-teal-600' : 'bg-navy-800'}`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
