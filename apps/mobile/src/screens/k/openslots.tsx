import { router } from '@/lib/nav';
import { useState } from 'react';
import { isHm, TimeField, WeekdayPicker } from '@/components/forms';
import { Button, Card, Empty, ErrorView, Input, Loading, Row, Screen, Section, Sheet, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useClinic } from '@/lib/clinic';
import { days, t12 } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';

interface Slot {
  id: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  note?: string | null;
}
interface Free {
  id: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  note?: string | null;
  doctor: { id: string; name: string; degrees?: string | null; specialties: string[] };
}

/** CLN-25 post an empty chair; see doctors' free hours (DOC-12) and invite them. */
export default function ClinicOpenSlots() {
  const t = useT();
  const { clinicId } = useClinic();
  const slots = useApi<Slot[]>(['clinic-open-slots', clinicId], clinicId ? `/clinic/${clinicId}/open-slots` : null);
  const free = useApi<Free[]>(['clinic-free-hours', clinicId], clinicId ? `/clinic/${clinicId}/free-hours` : null);
  const [open, setOpen] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const add = useAction(() => api(`/clinic/${clinicId}/open-slots`, { body: { weekdays, startTime: start, endTime: end, note: note || undefined } }), {
    invalidate: [['clinic-open-slots', clinicId]],
    onSuccess: () => setOpen(false),
  });
  const remove = useAction((id: string) => api(`/clinic/${clinicId}/open-slots/${id}`, { method: 'DELETE' }), { invalidate: [['clinic-open-slots', clinicId]] });

  if (slots.error) return <Screen back tabs={false} title={t('more.openSlots')}><ErrorView error={slots.error} /></Screen>;
  return (
    <Screen back tabs={false} title={t('more.openSlots')} subtitle={t('more.openSlots.desc')} right={<Button small icon="add" title="Post" onPress={() => setOpen(true)} />}>
      <Section title="Your empty chairs">
        {slots.isLoading ? (
          <Loading />
        ) : !slots.data?.length ? (
          <Empty icon="easel-outline" title="No empty chairs posted" body="Doctors looking for a chamber will see these." action="Post an empty chair" onAction={() => setOpen(true)} />
        ) : (
          slots.data.map((s) => (
            <Card key={s.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="h3">
                  {days(s.weekdays)} · {t12(s.startTime)}–{t12(s.endTime)}
                </T>
                <Button small tone="ghost" title="Remove" onPress={() => remove.mutate(s.id)} />
              </Row>
              {!!s.note && <T variant="muted">{s.note}</T>}
            </Card>
          ))
        )}
      </Section>
      <Section title="Doctors with free hours near you">
        {free.data?.length ? (
          free.data.map((f) => (
            <Card key={f.id}>
              <T variant="h3">Dr. {f.doctor.name}</T>
              <T variant="muted">
                {[f.doctor.specialties.join(', '), f.doctor.degrees].filter(Boolean).join(' · ')}
              </T>
              <T variant="small">
                Free {days(f.weekdays)} · {t12(f.startTime)}–{t12(f.endTime)}
              </T>
              <Button small title="Invite to sit here" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => router.push(`/k/add-doctor?doctorId=${f.doctor.id}&name=${encodeURIComponent(f.doctor.name)}`)} />
            </Card>
          ))
        ) : (
          <T variant="muted">No doctors have posted free hours in your district yet.</T>
        )}
      </Section>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Post an empty chair">
        <WeekdayPicker value={weekdays} onChange={setWeekdays} />
        <TimeField label="From" value={start} onChange={setStart} />
        <TimeField label="To" value={end} onChange={setEnd} />
        <Input label="Note (specialty wanted, fee, etc.)" value={note} onChangeText={setNote} />
        <Button title="Post" disabled={!weekdays.length || !isHm(start) || !isHm(end) || end <= start} loading={add.isPending} onPress={() => add.mutate()} />
      </Sheet>
    </Screen>
  );
}
