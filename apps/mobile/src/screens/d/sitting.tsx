import { router, useLocalSearchParams } from '@/lib/nav';
import { useState } from 'react';
import { View } from 'react-native';
import { SittingForm } from '@/components/SittingForm';
import { Chip, Loading, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { confirm, useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import type { SittingRow } from '@/lib/types';

interface Schedule {
  links: { id: string; status: string; clinic: { name: string }; sittings: SittingRow[] }[];
}

/** DOC-03 add / edit a sitting at one of the doctor's chambers. */
export default function DoctorSitting() {
  const t = useT();
  const { id, linkId: linkParam } = useLocalSearchParams<{ id?: string; linkId?: string }>();
  const q = useApi<Schedule>(['doctor-schedule'], '/doctor/schedule');
  const approved = q.data?.links.filter((l) => l.status === 'APPROVED') ?? [];
  const existing = id ? approved.flatMap((l) => l.sittings).find((s) => s.id === id) : undefined;
  const [linkId, setLinkId] = useState<string | null>(linkParam ?? null);
  const effLink = existing?.linkId ?? linkId ?? approved[0]?.id ?? null;

  const save = useAction(
    (v: object) => (id ? api(`/doctor/sittings/${id}`, { method: 'PATCH', body: v }) : api('/doctor/sittings', { body: { ...v, linkId: effLink } })),
    { invalidate: [['doctor-schedule'], ['doctor-queue']], onSuccess: () => router.back() },
  );
  const remove = useAction(() => api(`/doctor/sittings/${id}`, { method: 'DELETE' }), { invalidate: [['doctor-schedule']], onSuccess: () => router.back() });

  return (
    <Screen back tabs={false} title={id ? 'Edit sitting' : t('schedule.addSitting')}>
      {q.isLoading ? (
        <Loading />
      ) : (
        <>
          {!id && (
            <>
              <T variant="label" style={{ marginBottom: 6 }}>
                Chamber
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
                {approved.map((l) => (
                  <Chip key={l.id} label={l.clinic.name} active={effLink === l.id} onPress={() => setLinkId(l.id)} />
                ))}
              </View>
            </>
          )}
          {(id ? !!existing : true) && (
            <SittingForm
              initial={existing}
              saving={save.isPending}
              onSave={(v) => save.mutate(v)}
              onDelete={
                id
                  ? async () => {
                      if (await confirm('Remove sitting', 'Future bookings stay valid; no new bookings will be taken.', 'Remove', true)) remove.mutate();
                    }
                  : undefined
              }
            />
          )}
          <T variant="muted" style={{ marginTop: 12 }}>
            The clinic is notified of every change.
          </T>
        </>
      )}
    </Screen>
  );
}
