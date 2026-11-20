import { router } from '@/lib/nav';
import { AccountMenu } from '@/components/AccountMenu';
import { Badge, Button, Card, Empty, Loading, Row, Screen, Section, statusTone, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';

interface Mine {
  id: string;
  code: string;
  name: string;
  verification: string;
  myRole: string;
  area: { name: string };
}

/** Pick the clinic to run (owners can have several) or register a new one (CLN-01). */
export default function SelectClinic() {
  const t = useT();
  const { setClinicId, user, clinicId } = useAuth();
  const q = useApi<Mine[]>(['clinics-mine', user?.clinicIds.join(',')], '/clinic/mine');
  const isOwner = user?.roles.includes('CLINIC_OWNER');
  return (
    <Screen back={!!clinicId} tabs={false} title={t('console.title')} subtitle="Choose a clinic">
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <Empty icon="storefront-outline" title="Start your clinic on Okidoc" body="Register your clinic or pharmacy chamber to run your OPD queue." action={isOwner ? 'Register clinic' : undefined} onAction={() => router.push('/k/register')} />
      ) : (
        q.data.map((c) => (
          <Card
            key={c.id}
            onPress={() => {
              setClinicId(c.id);
              router.replace('/console/queue');
            }}
          >
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="h3">{c.name}</T>
              <Badge text={c.verification.toLowerCase()} tone={statusTone(c.verification)} />
            </Row>
            <T variant="muted">
              {c.code} · {c.area.name} · {c.myRole === 'CLINIC_OWNER' ? 'Owner' : 'Queue Manager'}
            </T>
          </Card>
        ))
      )}
      {isOwner && !!q.data?.length && <Button title="Register another clinic" tone="outline" icon="add" onPress={() => router.push('/k/register')} />}
      {!clinicId && (
        <Section title={t('tab.account')}>
          <AccountMenu />
        </Section>
      )}
    </Screen>
  );
}
