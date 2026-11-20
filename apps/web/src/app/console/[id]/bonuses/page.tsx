'use client';

import { use } from 'react';
import { Card, ErrorBox, PageHeader, Spinner, Stats, StatusBadge } from '@/components/ui';
import { inr } from '@/lib/format';
import { useApi } from '@/lib/hooks';

/** CLN-23 Bonuses & Prizes. */
export default function BonusesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error } = useApi<any>(['clinic', id, 'bonuses'], `/clinic/${id}/bonuses`);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Spinner />;
  return (
    <>
      <PageHeader title="Bonuses & prizes" subtitle="Rewards from Okidoc for growing your clinic on the app. Payouts are approved after verification." />
      <Stats items={[{ label: 'Patients served', value: data.summary.patients }, { label: 'Doctors added', value: data.summary.doctorsCompleted }, { label: 'Payable', value: inr(data.summary.payablePaise), tone: data.summary.payablePaise ? 'ok' : undefined }]} />
      <div className="grid gap-4 md:grid-cols-2">
        {data.campaigns.length ? data.campaigns.map((c: any) => (
          <Card key={c.id} title={c.name} actions={c.payoutStatus ? <StatusBadge status={c.payoutStatus} /> : null}>
            <p className="text-sm text-slate-600">{c.description}</p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, (c.achieved / c.target) * 100)}%` }} />
            </div>
            <p className="mt-2 text-sm">
              <b>{c.achieved}</b> / {c.target} · reward {inr(c.rewardPaise)} · until {c.endsAt}
            </p>
          </Card>
        )) : <p className="text-sm text-slate-500">No campaigns running right now.</p>}
      </div>
    </>
  );
}
