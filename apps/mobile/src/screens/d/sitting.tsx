import { router, useLocalSearchParams } from '@/lib/nav';
import { useState } from 'react';
import { dayList, type HoursRange } from '@okidoc/shared';
import { Alert, View } from 'react-native';
import { SittingForm, type SittingValues } from '@/components/SittingForm';
import { Chip, Empty, Loading, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { confirm, useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import type { SittingRow } from '@/lib/types';

interface Schedule {
  links: { id: string; status: string; clinic: { name: string; weeklyHours?: HoursRange[] | null }; sittings: SittingRow[] }[];
}

/** DOC-03 add / edit a sitting at one of the doctor's chambers. */
export default function DoctorSitting() {
  const t = useT();
  const { id, linkId: linkParam } = useLocalSearchParams<{ id?: string; linkId?: string }>();
  const q = useApi<Schedule>(['doctor-schedule'], '/doctor/schedule');
  const approved = q.data?.links.filter((l) => l.status === 'APPROVED') ?? [];
  const pending = q.data?.links.some((l) => l.status === 'PENDING') ?? false;
  const existing = id ? approved.flatMap((l) => l.sittings).find((s) => s.id === id) : undefined;
  const [linkId, setLinkId] = useState<string | null>(linkParam ?? null);
  const effLink = existing?.linkId ?? linkId ?? approved[0]?.id ?? null;

  const save = useAction(
    // Day-by-day editor: one sitting per time range; editing keeps this sitting for its matching range.
    (sittings: SittingValues[]) => api('/doctor/sittings/set', { body: { id, linkId: effLink, sittings } }),
    {
      invalidate: [['doctor-schedule'], ['doctor-queue']],
      onSuccess: (r: { outsideHours?: number[] }) => {
        // CLN-01a: saved; the clinic is told too.
        if (r?.outsideHours?.length) Alert.alert('Outside clinic hours', `Saved. On ${dayList(r.outsideHours)} the clinic is closed at this time — please check with the clinic.`);
        router.back();
      },
    },
  );
  const remove = useAction(() => api(`/doctor/sittings/${id}`, { method: 'DELETE' }), { invalidate: [['doctor-schedule']], onSuccess: () => router.back() });

  return (
    <Screen back tabs={false} title={id ? 'Edit sitting' : t('schedule.addSitting')}>
      {q.isLoading ? (
        <Loading />
      ) : !id && !approved.length ? (
        // A sitting belongs to a chamber; without one there is nothing to save it to (the API would reject it).
        <Empty
          icon="business-outline"
          title="Where do you sit?"
          body={
            pending
              ? 'Your clinic request is waiting for approval. Meanwhile you can set up your own chamber and add sittings there.'
              : 'Set up your own chamber in one step, or join a clinic with its clinic code from My schedule.'
          }
          action="Set up my own chamber"
          onAction={() => router.replace('/d/chamber')}
        />
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
              key={existing?.id ?? effLink ?? 'new'}
              initial={existing}
              defaultHours={approved.find((l) => l.id === effLink)?.clinic.weeklyHours}
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
