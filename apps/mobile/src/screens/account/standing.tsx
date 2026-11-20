import { router } from '@/lib/nav';
import { Button, Card, Empty, ErrorView, Loading, Row, Screen, Section, Stats, T, Badge } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface Standing {
  total: number;
  limits: { perClinic: number; total: number };
  clinics: { clinicId: string; clinicName: string; count: number }[];
  blocks: { id: string; scope: 'CLINIC' | 'PLATFORM'; clinicName: string | null; reason: string; since: string }[];
}

/** PAT-19 no-show standing (BR-07). */
export default function StandingScreen() {
  const t = useT();
  const q = useApi<Standing>(['standing'], '/me/standing');
  const s = q.data;
  return (
    <Screen back tabs={false} title={t('account.standing')} onRefresh={q.refetch} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} />
      ) : s ? (
        <>
          <Stats
            items={[
              { label: 'Missed (total)', value: `${s.total}/${s.limits.total}`, tone: s.total >= s.limits.total - 1 ? 'bad' : s.total ? 'warn' : 'ok' },
              { label: 'Per-clinic limit', value: s.limits.perClinic },
              { label: 'Active blocks', value: s.blocks.length, tone: s.blocks.length ? 'bad' : 'ok' },
            ]}
          />
          <Card style={{ backgroundColor: C.tealSoft }}>
            <T>
              Booking a pay-at-clinic visit and not coming counts as a missed visit. {s.limits.perClinic} missed visits at one clinic block online booking there; {s.limits.total} in total block online
              booking everywhere. Cancelling in time never counts.
            </T>
          </Card>
          {!!s.blocks.length && (
            <Section title="Blocks">
              {s.blocks.map((b) => (
                <Card key={b.id} style={{ backgroundColor: C.badSoft }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T variant="h3" color={C.bad}>
                      {b.scope === 'PLATFORM' ? 'All clinics' : b.clinicName}
                    </T>
                    <Badge text={b.scope.toLowerCase()} tone="bad" />
                  </Row>
                  <T variant="muted">{b.reason}</T>
                </Card>
              ))}
              <Button title="Appeal a block" tone="outline" onPress={() => router.push('/support?category=BLOCK_APPEAL')} />
            </Section>
          )}
          <Section title="By clinic">
            {s.clinics.length ? (
              s.clinics.map((c) => (
                <Card key={c.clinicId}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T variant="h3">{c.clinicName}</T>
                    <Badge text={`${c.count}/${s.limits.perClinic}`} tone={c.count >= s.limits.perClinic ? 'bad' : c.count === s.limits.perClinic - 1 ? 'warn' : 'muted'} />
                  </Row>
                </Card>
              ))
            ) : (
              <Empty icon="checkmark-done-outline" title="No missed visits" body="Thank you for keeping your appointments." />
            )}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
