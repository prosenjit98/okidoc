import { useQueryClient } from '@tanstack/react-query';
import { router } from '@/lib/nav';
import { View } from 'react-native';
import { Button, Card, Empty, Loading, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { routeForNotification } from '@/lib/push';
import { C } from '@/lib/theme';

interface N {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
}

/** PAT-17 notification centre. */
export default function Notifications() {
  const qc = useQueryClient();
  const q = useApi<{ items: N[]; unread: number }>(['notifications'], '/notifications');
  const readAll = useAction(() => api('/notifications/read-all', { body: {} }), { invalidate: [['notifications']] });
  return (
    <Screen back tabs={false} title="Notifications" right={q.data?.unread ? <Button small tone="soft" title="Mark all read" onPress={() => readAll.mutate()} /> : undefined} onRefresh={q.refetch} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.items.length ? (
        <Empty icon="notifications-off-outline" title="No notifications yet" />
      ) : (
        q.data.items.map((n) => (
          <Card
            key={n.id}
            style={!n.readAt ? { borderLeftWidth: 4, borderLeftColor: C.teal } : undefined}
            onPress={async () => {
              if (!n.readAt) {
                await api(`/notifications/${n.id}/read`, { body: {} }).catch(() => undefined);
                qc.invalidateQueries({ queryKey: ['notifications'] });
              }
              const r = routeForNotification(n.data);
              if (r && r !== '/notifications') router.push(r as never);
            }}
          >
            <View>
              <T variant="h3">{n.title}</T>
              <T style={{ marginTop: 2 }}>{n.body}</T>
              <T variant="muted" style={{ marginTop: 4 }}>
                {dateTime(n.createdAt)}
              </T>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
