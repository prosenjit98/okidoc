import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api, ApiError } from './api';

export function useApi<T = any>(key: QueryKey, path: string | null, opts: { refetchInterval?: number; enabled?: boolean } = {}) {
  return useQuery<T, ApiError>({
    queryKey: key,
    queryFn: () => api<T>(path!),
    enabled: !!path && opts.enabled !== false,
    refetchInterval: opts.refetchInterval,
  });
}

/** Mutation with error alert and cache invalidation. */
export function useAction<V = void, R = any>(
  fn: (v: V) => Promise<R>,
  opts: { invalidate?: QueryKey[]; onSuccess?: (r: R, v: V) => void; silent?: boolean } = {},
) {
  const qc = useQueryClient();
  return useMutation<R, ApiError, V>({
    mutationFn: fn,
    onSuccess: (r, v) => {
      for (const k of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: k });
      opts.onSuccess?.(r, v);
    },
    onError: (e) => {
      if (!opts.silent) Alert.alert('Okidoc', e.message);
    },
  });
}

export const confirm = (title: string, message: string, ok = 'OK', destructive = false) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
