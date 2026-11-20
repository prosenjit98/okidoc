import type { SignupRole } from '@okidoc/shared';
import { router } from '@/lib/nav';
import { Card, ListItem, Screen, Section } from '@/components/ui';
import { api } from '@/lib/api';
import { appRolesOf, useAuth, type AppRole } from '@/lib/auth';
import { confirm, useAction } from '@/lib/hooks';
import { useT } from '@/lib/i18n';

const ROLE_INFO: Record<AppRole, { role: SignupRole; icon: 'person-outline' | 'storefront-outline' | 'medkit-outline'; key: 'role.patient' | 'role.clinic' | 'role.doctor' }> = {
  patient: { role: 'PATIENT', icon: 'person-outline', key: 'role.patient' },
  clinic: { role: 'CLINIC_OWNER', icon: 'storefront-outline', key: 'role.clinic' },
  doctor: { role: 'DOCTOR', icon: 'medkit-outline', key: 'role.doctor' },
};

/** AUTH-13: switch between roles held by the same phone number, or add another. */
export default function Roles() {
  const t = useT();
  const { user, appRole, setAppRole, refreshMe } = useAuth();
  const have = appRolesOf(user);
  const add = useAction(
    (r: AppRole) => api('/me/roles', { body: { role: ROLE_INFO[r].role } }),
    {
      onSuccess: async (_, r) => {
        await refreshMe();
        setAppRole(r);
        router.replace('/');
      },
    },
  );
  return (
    <Screen back tabs={false} title={t('account.switchRole')}>
      <Card style={{ paddingVertical: 4 }}>
        {have.map((r) => (
          <ListItem
            key={r}
            icon={ROLE_INFO[r].icon}
            title={t(ROLE_INFO[r].key)}
            subtitle={r === appRole ? 'Current' : undefined}
            onPress={() => {
              setAppRole(r);
              router.replace('/');
            }}
          />
        ))}
      </Card>
      {have.length < 3 && (
        <Section title={t('account.addRole')}>
          <Card style={{ paddingVertical: 4 }}>
            {(Object.keys(ROLE_INFO) as AppRole[])
              .filter((r) => !have.includes(r))
              .map((r) => (
                <ListItem
                  key={r}
                  icon={ROLE_INFO[r].icon}
                  title={t(ROLE_INFO[r].key)}
                  onPress={async () => {
                    if (await confirm(t('account.addRole'), t(ROLE_INFO[r].key), t('common.add'))) add.mutate(r);
                  }}
                />
              ))}
          </Card>
        </Section>
      )}
    </Screen>
  );
}
