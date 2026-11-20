import type { SignupRole } from '@okidoc/shared';
import { router } from '@/lib/nav';
import { useState } from 'react';
import { AuthShell, GlassOption } from '@/components/AuthShell';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';

/** AUTH-03 "Are you a…" */
export default function RoleSelect() {
  const t = useT();
  const { setFlow } = useAuth();
  const [role, setRole] = useState<SignupRole | null>(null);
  return (
    <AuthShell
      back
      title={t('role.title')}
      subtitle={t('role.subtitle')}
      footer={
        <Button
          title={t('common.continue')}
          disabled={!role}
          onPress={() => {
            setFlow({ role: role! });
            router.push('/signup');
          }}
        />
      }
    >
      <GlassOption icon="person-outline" title={t('role.patient')} desc={t('role.patient.desc')} selected={role === 'PATIENT'} onPress={() => setRole('PATIENT')} />
      <GlassOption icon="storefront-outline" title={t('role.clinic')} desc={t('role.clinic.desc')} selected={role === 'CLINIC_OWNER'} onPress={() => setRole('CLINIC_OWNER')} />
      <GlassOption icon="medkit-outline" title={t('role.doctor')} desc={t('role.doctor.desc')} selected={role === 'DOCTOR'} onPress={() => setRole('DOCTOR')} />
    </AuthShell>
  );
}
