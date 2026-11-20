import { View } from 'react-native';
import { Badge, Card, Empty, ErrorView, Loading, Row, Screen, Stats, T } from '@/components/ui';
import { useClinic } from '@/lib/clinic';
import { inr } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface Bonus {
  summary: { patients: number; doctorsCompleted: number; payablePaise: number };
  campaigns: { id: string; name: string; description?: string | null; startsAt: string; endsAt: string; rewardPaise: number; achieved: number; target: number; completed: boolean; payoutStatus: string | null }[];
}

/** CLN-23 Bonuses & Prizes progress (ADM-09 campaigns). */
export default function Bonuses() {
  const t = useT();
  const { clinicId } = useClinic();
  const q = useApi<Bonus>(['bonuses', clinicId], clinicId ? `/clinic/${clinicId}/bonuses` : null);
  return (
    <Screen back tabs={false} title={t('more.bonuses')} onRefresh={q.refetch} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} />
      ) : q.data ? (
        <>
          <Stats
            items={[
              { label: 'Patients', value: q.data.summary.patients },
              { label: 'Doctors completed', value: q.data.summary.doctorsCompleted },
              { label: 'Payable', value: inr(q.data.summary.payablePaise), tone: 'ok' },
            ]}
          />
          {!q.data.campaigns.length ? (
            <Empty icon="gift-outline" title="No active campaigns" body="Okidoc will announce rewards for clinics here." />
          ) : (
            q.data.campaigns.map((c) => (
              <Card key={c.id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T variant="h3" style={{ flex: 1 }}>
                    {c.name}
                  </T>
                  <Badge text={c.payoutStatus ? c.payoutStatus.toLowerCase() : c.completed ? 'completed' : `${inr(c.rewardPaise)}`} tone={c.completed ? 'ok' : 'info'} />
                </Row>
                {!!c.description && <T variant="muted">{c.description}</T>}
                <View style={{ height: 10, backgroundColor: C.tealSoft, borderRadius: 5, marginTop: 10, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.min(100, Math.round((c.achieved / c.target) * 100))}%`, height: '100%', backgroundColor: C.teal }} />
                </View>
                <T variant="muted" style={{ marginTop: 6 }}>
                  {c.achieved}/{c.target} · ends {c.endsAt}
                </T>
              </Card>
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}
