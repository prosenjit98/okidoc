import { router } from '@/lib/nav';
import { useState } from 'react';
import { sittingsFromHours, type HoursRange } from '@okidoc/shared';
import { Alert } from 'react-native';
import { ClinicForm, type ClinicFormValues } from '@/components/ClinicForm';
import { cleanHours, DEFAULT_HOURS, HoursEditor, hoursErrors } from '@/components/HoursEditor';
import { Input, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAction } from '@/lib/hooks';

/**
 * A doctor sets up their own chamber in one step: the chamber is registered with them as owner and as its doctor,
 * and their sitting times are saved with it. The sitting times start as a copy of the opening hours and follow them
 * until the doctor edits them; they use the same day-by-day editor (several ranges a day, copy to next day).
 */
export default function OwnChamber() {
  const { refreshMe } = useAuth();
  const [fee, setFee] = useState('');
  const [openHours, setOpenHours] = useState<HoursRange[]>(DEFAULT_HOURS);
  const [sitHours, setSitHours] = useState<HoursRange[]>(DEFAULT_HOURS);
  const [custom, setCustom] = useState(false); // false = sitting times mirror the opening hours
  const sitting = custom ? sitHours : openHours;
  const sittingOk = !hoursErrors(sitting).length;

  const create = useAction(
    (v: ClinicFormValues) =>
      api<{ linkId: string; sittings: number; sittingsSkipped: number }>('/clinics/own-chamber', {
        body: {
          ...v,
          consultationFee: Math.round(Number(fee || 0) * 100),
          sittings: sittingsFromHours(cleanHours(sitting)).map((s) => ({ ...s, recurrence: 'WEEKLY' })),
        },
      }),
    {
      invalidate: [['doctor-schedule'], ['doctor-queue']],
      onSuccess: async (r) => {
        await refreshMe(); // the account can now also open this chamber's clinic console
        if (r.sittingsSkipped) Alert.alert('Some sittings not saved', `Your plan allows ${r.sittings} sittings at this chamber; ${r.sittingsSkipped} were left out.`);
        router.replace('/dr/schedule');
      },
    },
  );

  return (
    <Screen back tabs={false} title="Set up my chamber" subtitle="Your own chamber, with you as its doctor. Okidoc verifies it before patients can book.">
      <Input label="Your consultation fee (₹)" value={fee} onChangeText={(v) => setFee(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="e.g. 300" />
      <ClinicForm
        submitLabel="Save chamber and sittings"
        saving={create.isPending}
        canSubmit={sittingOk}
        onChange={(v) => v.weeklyHours && setOpenHours(v.weeklyHours)}
        onSubmit={(v) => create.mutate(v)}
      >
        <HoursEditor
          label="My sitting times"
          value={sitting}
          onChange={(h) => {
            setSitHours(h);
            setCustom(true);
          }}
          action={custom ? { title: 'Same as opening hours', onPress: () => setCustom(false) } : undefined}
          note={
            custom
              ? 'When you see patients here. Edit any day, add a second time, or turn a day off.'
              : 'Copied from the opening hours. Edit any day if you sit for less time.'
          }
        />
      </ClinicForm>
    </Screen>
  );
}
