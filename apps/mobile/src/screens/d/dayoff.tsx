import { router } from '@/lib/nav';
import { useState } from 'react';
import { View } from 'react-native';
import { DateField, isDate, isHm, TimeField } from '@/components/forms';
import { Button, Card, Chip, Input, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { days, t12, todayIST } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';
import type { SittingRow } from '@/lib/types';

interface Schedule {
  links: { id: string; status: string; clinic: { name: string }; sittings: SittingRow[] }[];
}

/** DOC-04 day off / changed time. Booked patients are notified (and refunded for cancelled sittings). */
export default function DayOff() {
  const t = useT();
  const q = useApi<Schedule>(['doctor-schedule'], '/doctor/schedule');
  const [sittingId, setSittingId] = useState<string | null>(null);
  const [from, setFrom] = useState(todayIST());
  const [to, setTo] = useState(todayIST());
  const [type, setType] = useState<'OFF' | 'CHANGED_TIME'>('OFF');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const save = useAction(
    () => api('/doctor/exceptions', { body: { sittingId, fromDate: from, toDate: to, type, startTime: type === 'CHANGED_TIME' ? start : undefined, endTime: type === 'CHANGED_TIME' ? end : undefined, reason: reason || undefined } }),
    { invalidate: [['doctor-schedule'], ['doctor-queue']], onSuccess: () => router.back() },
  );
  const sittings = q.data?.links.filter((l) => l.status === 'APPROVED').flatMap((l) => l.sittings.map((s) => ({ ...s, clinic: l.clinic.name }))) ?? [];
  const valid = isDate(from) && isDate(to) && to >= from && (type === 'OFF' || (isHm(start) && isHm(end) && end > start));

  return (
    <Screen back tabs={false} title={t('schedule.addDayOff')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Day off" active={type === 'OFF'} onPress={() => setType('OFF')} />
        <Chip label="Changed time" active={type === 'CHANGED_TIME'} onPress={() => setType('CHANGED_TIME')} />
      </View>
      <T variant="label" style={{ marginVertical: 6 }}>
        Applies to
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="All sittings" active={!sittingId} onPress={() => setSittingId(null)} />
        {sittings.map((s) => (
          <Chip key={s.id} label={`${s.clinic} · ${days(s.weekdays)} ${t12(s.startTime)}`} active={sittingId === s.id} onPress={() => setSittingId(s.id)} />
        ))}
      </View>
      <DateField label="From" value={from} onChange={setFrom} />
      <DateField label="To" value={to} onChange={setTo} />
      {type === 'CHANGED_TIME' && (
        <>
          <TimeField label="New start" value={start} onChange={setStart} />
          <TimeField label="New end" value={end} onChange={setEnd} />
        </>
      )}
      <Input label="Reason (shown to patients)" value={reason} onChangeText={setReason} />
      {type === 'OFF' && (
        <Card style={{ backgroundColor: C.warnSoft }}>
          <T variant="small">Sittings in this range are cancelled. Booked patients are notified and any online payment is refunded in full.</T>
        </Card>
      )}
      <Button title={t('common.save')} disabled={!valid} loading={save.isPending} onPress={() => save.mutate()} />
    </Screen>
  );
}
