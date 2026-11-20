import { Text } from 'react-native';
import { inr, t12, dateShort } from '@/lib/format';
import { C } from '@/lib/theme';
import type { Earnings } from '@/lib/types';
import { Card, KV, Row, Section, Stats, T } from './ui';

/** Earnings & history (DOC-09 / CLN-17). Okidoc takes no commission. */
export function EarningsView({ e, mine }: { e: Earnings; mine: 'doctor' | 'clinic' }) {
  return (
    <>
      <Stats
        items={[
          { label: 'Visits', value: e.totals.visits },
          { label: 'Fees', value: inr(e.totals.gross) },
          { label: mine === 'doctor' ? 'Your share' : 'Clinic share', value: inr(mine === 'doctor' ? e.totals.doctorShare : e.totals.clinicShare), tone: 'ok' },
        ]}
      />
      <Card>
        <KV k="Collected online" v={inr(e.totals.collectedOnline)} />
        <KV k="Paid at clinic (marked)" v={inr(e.totals.collectedAtClinic)} />
        <KV k="Not marked as paid" v={inr(e.totals.uncollected)} />
        <KV k={mine === 'doctor' ? 'Clinic share' : 'Doctor share'} v={inr(mine === 'doctor' ? e.totals.clinicShare : e.totals.doctorShare)} />
        <KV k="Okidoc commission" v={inr(e.totals.commission)} />
      </Card>
      <Section title="By chamber">
        {e.chambers.map((c) => (
          <Card key={c.linkId}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="h3">{mine === 'doctor' ? c.clinicName : `Dr. ${c.doctorName}`}</T>
              <Text style={{ fontWeight: '800', color: C.tealDark }}>{inr(mine === 'doctor' ? c.doctorShare : c.clinicShare)}</Text>
            </Row>
            <T variant="muted">
              {c.visits} visits · fee {inr(c.fee)} · clinic split {c.clinicSplitPercent}%
            </T>
          </Card>
        ))}
        {!e.chambers.length && <T variant="muted">No completed visits in this period.</T>}
      </Section>
      <Section title="By sitting">
        {e.sittings.slice(0, 40).map((s) => (
          <Card key={s.instanceId}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="h3">
                {dateShort(s.date)} · {t12(s.startTime)}
              </T>
              <Text style={{ fontWeight: '800', color: C.navy900 }}>{inr(s.gross)}</Text>
            </Row>
            <T variant="muted">
              {mine === 'doctor' ? s.clinicName : `Dr. ${s.doctorName}`} · {s.visits} visits
            </T>
          </Card>
        ))}
      </Section>
    </>
  );
}
