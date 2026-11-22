import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';
import { prefs } from './storage';

export interface AreaRow {
  id: string;
  name: string;
  nameBn?: string | null;
  pin: string;
  region: { id: string; district: string; state: string };
}

/** Patient's chosen area (PAT-01): device preference, falling back to the profile's area. */
export function useArea() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['area', user?.areaId ?? ''],
    queryFn: async () => {
      const id = (await prefs.get<string | null>('areaId', null)) ?? user?.areaId ?? null;
      if (!id) return null;
      const found = await api<AreaRow[]>(/areas?id=${encodeURIComponent(id)}, { auth: false });
      return found[0] ?? null;
    },
    staleTime: Infinity,
  });
  const setArea = async (a: AreaRow) => {
    await prefs.set('areaId', a.id);
    qc.setQueryData(['area', user?.areaId ?? ''], a);
    api('/me', { method: 'PATCH', body: { areaId: a.id } }).catch(() => undefined);
  };
  return { area: q.data ?? null, areaId: q.data?.id ?? null, setArea, loading: q.isLoading };
}
