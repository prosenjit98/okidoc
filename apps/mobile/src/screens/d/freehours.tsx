import { useState } from 'react';
import { isHm, TimeField, WeekdayPicker } from '@/components/forms';
import { Button, Card, Empty, Input, Row, Screen, Sheet, T } from '@/components/ui';
import { api } from '@/lib/api';
import { days, t12 } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

interface FreeHour {
  id: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  note?: string | null;
}

/** DOC-12 post free hours so clinics with an empty chamber can find you. */
export default function FreeHours() {
  const q = useApi<FreeHour[]>(['free-hours'], '/doctor/free-hours');
  const [open, setOpen] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const add = useAction(() => api('/doctor/free-hours', { body: { weekdays, startTime: start, endTime: end, note: note || undefined } }), {
    invalidate: [['free-hours']],
    onSuccess: () => setOpen(false),
  });
  const remove = useAction((id: string) => api(`/doctor/free-hours/${id}`, { method: 'DELETE' }), { invalidate: [['free-hours']] });
  return (
    <Screen back tabs={false} title="My free hours" right={<Button small icon="add" title="Add" onPress={() => setOpen(true)} />}>
      {!q.data?.length ? (
        <Empty icon="time-outline" title="No free hours posted" body="Clinics in your district see these and can invite you to sit." action="Add free hours" onAction={() => setOpen(true)} />
      ) : (
        q.data.map((h) => (
          <Card key={h.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="h3">
                {days(h.weekdays)} · {t12(h.startTime)}–{t12(h.endTime)}
              </T>
              <Button small tone="ghost" title="Remove" onPress={() => remove.mutate(h.id)} />
            </Row>
            {!!h.note && <T variant="muted">{h.note}</T>}
          </Card>
        ))
      )}
      <Sheet visible={open} onClose={() => setOpen(false)} title="Add free hours">
        <WeekdayPicker value={weekdays} onChange={setWeekdays} />
        <TimeField label="From" value={start} onChange={setStart} />
        <TimeField label="To" value={end} onChange={setEnd} />
        <Input label="Note (optional)" value={note} onChangeText={setNote} />
        <Button title="Post" disabled={!weekdays.length || !isHm(start) || !isHm(end) || end <= start} loading={add.isPending} onPress={() => add.mutate()} />
      </Sheet>
    </Screen>
  );
}
