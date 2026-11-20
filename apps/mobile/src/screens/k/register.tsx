import { router } from '@/lib/nav';
import { ClinicForm, type ClinicFormValues } from '@/components/ClinicForm';
import { Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAction } from '@/lib/hooks';

/** CLN-01 clinic registration → clinic code issued → "Add your first doctor". */
export default function RegisterClinic() {
  const { refreshMe, setClinicId, setAppRole } = useAuth();
  const create = useAction((v: ClinicFormValues) => api<{ id: string }>('/clinics/register', { body: v }), {
    onSuccess: async (c) => {
      await refreshMe();
      setAppRole('clinic');
      setClinicId(c.id);
      router.replace('/console/queue');
    },
  });
  return (
    <Screen back tabs={false} title="Start your clinic on Okidoc" subtitle="Okidoc verifies new clinics before they appear in search">
      <ClinicForm submitLabel="Register clinic" saving={create.isPending} onSubmit={(v) => create.mutate(v)} />
    </Screen>
  );
}
