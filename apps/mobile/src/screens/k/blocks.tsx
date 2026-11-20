import { useState } from 'react';
import { Alert } from 'react-native';
import { Badge, Button, Card, Empty, ErrorView, Input, Loading, Row, Screen, Sheet, T } from '@/components/ui';
import { api, errCode, errMessage } from '@/lib/api';
import { useClinic } from '@/lib/clinic';
import { dateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';

interface Block {
  id: string;
  patientName: string;
  phone: string;
  reason: string;
  noShowCount: number;
  active: boolean;
  createdAt: string;
  liftReason?: string | null;
}

/** CLN-27 patients blocked at this clinic after repeated missed visits (BR-07). */
export default function Blocks() {
  const t = useT();
  const { clinicId } = useClinic();
  const q = useApi<Block[]>(['clinic-blocks', clinicId], clinicId ? `/clinic/${clinicId}/blocks` : null);
  const [lift, setLift] = useState<Block | null>(null);
  const [reason, setReason] = useState('');
  const doLift = async () => {
    if (!lift) return;
    try {
      await api(`/clinic/${clinicId}/blocks/${lift.id}/lift`, { body: { reason } });
      setLift(null);
      setReason('');
      q.refetch();
    } catch (e) {
      setLift(null);
      Alert.alert(
        errCode(e) === 'CLINIC_LIFT_DISABLED' ? 'Only Okidoc can lift blocks' : 'Okidoc',
        errCode(e) === 'CLINIC_LIFT_DISABLED' ? 'Ask the patient to appeal through Okidoc Contact & support, or contact Okidoc yourself.' : errMessage(e),
      );
    }
  };
  return (
    <Screen back tabs={false} title={t('more.blocks')} subtitle="3 missed pay-at-clinic visits block online booking here">
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} />
      ) : !q.data?.length ? (
        <Empty icon="checkmark-done-outline" title="No blocked patients" />
      ) : (
        q.data.map((b) => (
          <Card key={b.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="h3">{b.patientName}</T>
              <Badge text={b.active ? 'blocked' : 'lifted'} tone={b.active ? 'bad' : 'muted'} />
            </Row>
            <T variant="muted">
              {b.phone} · {b.noShowCount} missed · since {dateTime(b.createdAt)}
            </T>
            {!!b.liftReason && <T variant="small">Lifted: {b.liftReason}</T>}
            {b.active && <Button small tone="outline" title="Lift block" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => setLift(b)} />}
          </Card>
        ))
      )}
      <Sheet visible={!!lift} onClose={() => setLift(null)} title="Lift block">
        <T variant="muted" style={{ marginBottom: 8 }}>
          Missed-visit counts stay on record.
        </T>
        <Input label="Reason" value={reason} onChangeText={setReason} multiline />
        <Button title="Lift block" disabled={reason.trim().length < 3} onPress={doLift} />
      </Sheet>
    </Screen>
  );
}
