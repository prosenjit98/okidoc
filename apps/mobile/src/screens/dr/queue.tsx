import { router } from '@/lib/nav';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Bell, StatusPill } from '@/components/common';
import { Badge, Button, Callout, Card, Chip, Empty, ErrorView, Loading, Row, Screen, Sheet, statusTone, T } from '@/components/ui';
import { api } from '@/lib/api';
import { startsIn, t12, todayIST } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { useRoom } from '@/lib/socket';
import { C } from '@/lib/theme';
import type { StaffView } from '@/lib/types';

function SittingCard({ v, canRunQueue, onChange }: { v: StaffView; canRunQueue: boolean; onChange: () => void }) {
  const t = useT();
  const [delayOpen, setDelayOpen] = useState(false);
  const s = v.snapshot;
  useRoom(`instance:${s.instanceId}`, ['queue:update'], onChange);
  const presence = useAction((body: { status: string; delayMinutes?: number }) => api(`/doctor/instances/${s.instanceId}/presence`, { body }), { onSuccess: onChange });
  const action = useAction((a: string) => api(`/doctor/instances/${s.instanceId}/action`, { body: { action: a } }), { onSuccess: onChange });
  const closed = s.status === 'ENDED' || s.status === 'CANCELLED';
  const soon = startsIn(s.date, s.startTime);
  const next = v.bookings.filter((b) => ['PRESENT', 'BOOKED', 'IN_CONSULTATION'].includes(b.status)).slice(0, 6);

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T variant="h3">{v.clinic.name}</T>
          <T variant="muted">
            {t12(s.startTime)} – {t12(s.endTime)}
            {soon && s.status === 'SCHEDULED' ? ` · ${t('console.startsIn', { t: soon })}` : ''}
          </T>
        </View>
        <StatusPill status={s.presence === 'DELAYED' ? 'DELAYED' : s.status} label={s.presence === 'DELAYED' ? `late ${s.delayMinutes}m` : undefined} />
      </Row>
      <View style={{ flexDirection: 'row', marginVertical: 12 }}>
        {[
          [t('console.nowServing'), s.nowServing ? `#${s.nowServing}` : '#—'],
          [t('console.waiting'), s.waiting],
          [t('console.completed'), s.completed],
        ].map(([k, val]) => (
          <View key={String(k)} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.navy900 }}>{val}</Text>
            <T variant="muted">{k}</T>
          </View>
        ))}
      </View>
      {!closed && (
        <View style={{ gap: 8 }}>
          {s.status !== 'ONLINE' ? (
            <Button title={s.status === 'PAUSED' ? t('console.resume') : t('doctorq.goOnline')} icon="radio-button-on" loading={presence.isPending} onPress={() => presence.mutate({ status: 'ONLINE' })} />
          ) : (
            <Row>
              {canRunQueue && <Button style={{ flex: 1 }} title={t('doctorq.callNext')} icon="megaphone-outline" loading={action.isPending} onPress={() => action.mutate('CALL_NEXT')} />}
              <Button style={{ flex: 1 }} tone="outline" title={t('doctorq.break')} icon="cafe-outline" onPress={() => presence.mutate({ status: 'ON_BREAK' })} />
            </Row>
          )}
          <Row>
            <Button small tone="soft" title={t('doctorq.delay')} icon="time-outline" onPress={() => setDelayOpen(true)} />
            {canRunQueue && s.status === 'ONLINE' && <Button small tone="soft" title={t('console.endSitting')} icon="stop-circle-outline" onPress={() => action.mutate('END')} />}
          </Row>
        </View>
      )}
      {!!next.length && (
        <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {next.map((b) => (
            <Badge key={b.id} text={`#${b.tokenNo} ${b.patientName.split(' ')[0]}`} tone={statusTone(b.status)} />
          ))}
        </View>
      )}
      <Sheet visible={delayOpen} onClose={() => setDelayOpen(false)} title={t('doctorq.delay')}>
        <T variant="muted" style={{ marginBottom: 10 }}>
          Booked patients are notified and their ETA is updated.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[10, 15, 30, 45, 60, 90].map((m) => (
            <Chip
              key={m}
              label={`${m} min`}
              onPress={() => {
                presence.mutate({ status: 'DELAYED', delayMinutes: m });
                setDelayOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>
    </Card>
  );
}

/** DOC-08 doctor's queue for today. */
export default function DoctorQueue() {
  const t = useT();
  const profile = useApi<{ verification: string; canRunQueue: boolean }>(['doctor-profile'], '/doctor/profile');
  const q = useApi<StaffView[]>(['doctor-queue'], `/doctor/queue?date=${todayIST()}`, { refetchInterval: 30_000 });
  return (
    <Screen title={t('tab.queue')} subtitle={t('common.today')} right={<Bell />} onRefresh={q.refetch} refreshing={q.isRefetching}>
      {profile.data && profile.data.verification !== 'APPROVED' && (
        <Callout
          tone={profile.data.verification === 'PENDING' ? 'info' : 'warn'}
          icon={profile.data.verification === 'PENDING' ? 'hourglass-outline' : 'shield-checkmark-outline'}
          title={profile.data.verification === 'PENDING' ? t('verify.pending') : t('verify.title')}
          body={t('verify.body')}
          action={profile.data.verification === 'PENDING' ? undefined : t('verify.title')}
          onPress={() => router.push('/d/verify')}
        />
      )}
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <Empty icon="calendar-clear-outline" title="No sittings today" body="Your sittings across all chambers appear here." action={t('schedule.addSitting')} onAction={() => router.push('/d/sitting')} />
      ) : (
        q.data.map((v) => <SittingCard key={v.snapshot.instanceId} v={v} canRunQueue={profile.data?.canRunQueue ?? true} onChange={() => q.refetch()} />)
      )}
    </Screen>
  );
}
