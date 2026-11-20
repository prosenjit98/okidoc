import { Alert } from 'react-native';
import { Button, Card, Empty, Loading, Row, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { days, t12 } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';

interface OpenSlot {
  id: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  note?: string | null;
  clinic: { id: string; code: string; name: string; addressLine: string; area: { name: string } };
}

/** CLN-25 ↔ DOC-12: clinics with an empty chair; doctor requests to join. */
export default function OpenSlots() {
  const t = useT();
  const q = useApi<OpenSlot[]>(['open-slots'], '/doctor/open-slots');
  const request = useAction((code: string) => api('/doctor/links/request', { body: { clinicCode: code } }), {
    invalidate: [['doctor-schedule']],
    onSuccess: () => Alert.alert('Request sent', 'The clinic will be notified.'),
  });
  return (
    <Screen back tabs={false} title={t('more.openSlots')} subtitle="Clinics looking for a doctor">
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <Empty icon="business-outline" title="No open chairs right now" />
      ) : (
        q.data.map((s) => (
          <Card key={s.id}>
            <T variant="h3">{s.clinic.name}</T>
            <T variant="muted">
              {s.clinic.area.name} · {days(s.weekdays)} · {t12(s.startTime)}–{t12(s.endTime)}
            </T>
            {!!s.note && <T style={{ marginTop: 4 }}>{s.note}</T>}
            <Row style={{ marginTop: 10 }}>
              <Button small title="Request to join" loading={request.isPending} onPress={() => request.mutate(s.clinic.code)} />
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
