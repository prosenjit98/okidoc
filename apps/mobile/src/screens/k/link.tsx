import { router, useLocalSearchParams } from '@/lib/nav';
import { useEffect, useState } from 'react';
import { dayList } from '@okidoc/shared';
import { Alert, View } from 'react-native';
import { SittingForm, type SittingValues } from '@/components/SittingForm';
import { Avatar, Button, Card, Chip, Input, Loading, Row, Screen, Section, Sheet, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useClinic } from '@/lib/clinic';
import { days, t12 } from '@/lib/format';
import { confirm, useAction, useApi } from '@/lib/hooks';
import type { SittingRow } from '@/lib/types';
import type { Roster } from '@/screens/console/doctors';

/** CLN-06 a doctor's weekly chamber plan at this clinic, fee/split and walk-in reservation (BR-01). */
export default function LinkDetail() {
  const { linkId } = useLocalSearchParams<{ linkId: string }>();
  const { clinicId } = useClinic();
  const roster = useApi<Roster>(['roster', clinicId, ''], clinicId ? `/clinic/${clinicId}/doctors` : null);
  const link = roster.data?.doctors.find((l) => l.linkId === linkId);
  const [fee, setFee] = useState('');
  const [split, setSplit] = useState('');
  const [walkInEvery, setWalkInEvery] = useState<number | null>(null);
  const [edit, setEdit] = useState<Partial<SittingRow> | null>(null);
  useEffect(() => {
    if (!link) return;
    setFee(String(link.consultationFee / 100));
    setSplit(String(link.clinicSplitPercent));
    setWalkInEvery(link.walkInEvery ?? null);
  }, [link]);

  const inv = { invalidate: [['roster'], ['clinic-queue']] };
  const saveLink = useAction(() => api(`/clinic/${clinicId}/links/${linkId}`, { method: 'PATCH', body: { consultationFee: Math.round(Number(fee) * 100), clinicSplitPercent: Number(split), walkInEvery } }), inv);
  const saveSitting = useAction(
    (v: SittingValues) => (edit?.id ? api(`/clinic/${clinicId}/sittings/${edit.id}`, { method: 'PATCH', body: v }) : api(`/clinic/${clinicId}/links/${linkId}/sittings`, { body: v })),
    {
      ...inv,
      onSuccess: (r: { outsideHours?: number[] }) => {
        setEdit(null);
        // CLN-01a: saved, but flag days outside the clinic's opening hours.
        if (r?.outsideHours?.length) Alert.alert('Outside your opening hours', `Saved. On ${dayList(r.outsideHours)} this sitting is outside your clinic's opening hours — update the hours in Clinic profile if the clinic opens for it.`);
      },
    },
  );
  const removeSitting = useAction((id: string) => api(`/clinic/${clinicId}/sittings/${id}`, { method: 'DELETE' }), { ...inv, onSuccess: () => setEdit(null) });
  const removeDoctor = useAction(() => api(`/clinic/${clinicId}/links/${linkId}`, { method: 'DELETE' }), { ...inv, onSuccess: () => router.back() });

  if (!link) return <Screen back tabs={false} title="Doctor"><Loading /></Screen>;
  return (
    <Screen back tabs={false} title={`Dr. ${link.doctor.name}`} subtitle={[link.doctor.specialties.join(', '), link.doctor.degrees].filter(Boolean).join(' · ')} right={<Avatar name={link.doctor.name} uri={link.doctor.photoUrl} />}>
      <Section title="Weekly sittings" action="Add sitting" onAction={() => setEdit({})}>
        {link.sittings.length ? (
          link.sittings.map((s) => (
            <Card key={s.id} onPress={() => setEdit(s)}>
              <T variant="h3">
                {days(s.weekdays)} · {t12(s.startTime)} – {t12(s.endTime)}
              </T>
              <T variant="muted">
                {s.recurrence === 'ALTERNATE_WEEKS' ? 'Alternate weeks' : 'Every week'}
                {s.maxPatients ? ` · max ${s.maxPatients}` : ''} · tap to edit
              </T>
            </Card>
          ))
        ) : (
          <Card>
            <T variant="muted">No sittings yet — add the days and hours this doctor sits here.</T>
          </Card>
        )}
      </Section>
      <Section title="Fee & split">
        <Input label="Consultation fee (₹)" value={fee} onChangeText={(v) => setFee(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
        <Input label="Clinic share (%)" value={split} onChangeText={(v) => setSplit(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
        <T variant="label" style={{ marginBottom: 6 }}>
          Reserve tokens for walk-ins
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[null, 2, 3, 4, 5].map((n) => (
            <Chip key={String(n)} label={n ? `Every ${n}${n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}` : 'None'} active={walkInEvery === n} onPress={() => setWalkInEvery(n)} />
          ))}
        </View>
        {link.avgConsultMinutes != null && <T variant="muted">Average consultation: {link.avgConsultMinutes} min (used for patient ETAs)</T>}
        <Button title="Save" tone="dark" style={{ marginTop: 10 }} loading={saveLink.isPending} onPress={() => saveLink.mutate()} />
      </Section>
      <Row style={{ marginTop: 20 }}>
        <Button
          title="Remove from roster"
          tone="outline"
          style={{ flex: 1 }}
          onPress={async () => {
            if (await confirm('Remove doctor', 'Future sittings are cancelled and booked patients are notified.', 'Remove', true)) removeDoctor.mutate();
          }}
        />
      </Row>
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit sitting' : 'Add sitting'}>
        {edit && (
          <SittingForm
            initial={edit}
            saving={saveSitting.isPending}
            onSave={(v) => saveSitting.mutate(v)}
            onDelete={
              edit.id
                ? async () => {
                  if (await confirm('Remove sitting', 'No new bookings will be taken for it.', 'Remove', true)) removeSitting.mutate(edit.id!);
                }
                : undefined
            }
          />
        )}
      </Sheet>
    </Screen>
  );
}