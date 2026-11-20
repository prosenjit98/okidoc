import NetInfo from '@react-native-community/netinfo';
import { api } from './api';
import { prefs, randomId } from './storage';

/** CLN-13 offline walk-ins: queued on the device, synced idempotently (clientRef) when the network returns. */
export interface PendingWalkIn {
  clinicId: string;
  instanceId: string;
  name: string;
  phone?: string;
  clientRef: string;
  createdAt: string;
  doctorName?: string;
}

const key = (clinicId: string) => `walkins.${clinicId}`;

export const offlineWalkIns = {
  list: (clinicId: string) => prefs.get<PendingWalkIn[]>(key(clinicId), []),
  async add(w: Omit<PendingWalkIn, 'clientRef' | 'createdAt'>) {
    const list = await this.list(w.clinicId);
    const item: PendingWalkIn = { ...w, clientRef: randomId(), createdAt: new Date().toISOString() };
    await prefs.set(key(w.clinicId), [...list, item]);
    return item;
  },
  /** Push queued walk-ins. Returns tokens assigned; failed items stay queued. */
  async sync(clinicId: string): Promise<{ synced: { clientRef: string; tokenNo: number; name: string }[]; failed: number }> {
    const list = await this.list(clinicId);
    if (!list.length) return { synced: [], failed: 0 };
    const res = await api<{ results: { clientRef: string; ok: boolean; tokenNo?: number; error?: string }[] }>(`/clinic/${clinicId}/walk-ins/sync`, {
      body: { items: list.map(({ instanceId, name, phone, clientRef }) => ({ instanceId, name, phone: phone || undefined, clientRef })) },
    });
    const okRefs = new Set(res.results.filter((r) => r.ok).map((r) => r.clientRef));
    // Items rejected for good (e.g. sitting ended) are dropped too, so they don't block the queue forever.
    const permanent = new Set(res.results.filter((r) => !r.ok && /ended|closed|not found/i.test(r.error ?? '')).map((r) => r.clientRef));
    await prefs.set(key(clinicId), list.filter((i) => !okRefs.has(i.clientRef) && !permanent.has(i.clientRef)));
    return {
      synced: res.results.filter((r) => r.ok).map((r) => ({ clientRef: r.clientRef, tokenNo: r.tokenNo!, name: list.find((l) => l.clientRef === r.clientRef)?.name ?? '' })),
      failed: res.results.filter((r) => !r.ok && !permanent.has(r.clientRef)).length,
    };
  },
};

export async function isOnline() {
  try {
    const s = await NetInfo.fetch();
    return !!s.isConnected && s.isInternetReachable !== false;
  } catch {
    return true;
  }
}

/** Returns an object with remove() (same shape the screens already use). */
export const onNetworkChange = (fn: (online: boolean) => void) => {
  const unsubscribe = NetInfo.addEventListener((s) => fn(!!s.isConnected && s.isInternetReachable !== false));
  return { remove: unsubscribe };
};
