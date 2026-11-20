'use client';

import { use, useState } from 'react';
import { Card, ErrorBox, Field, Input, PageHeader, Spinner, Stats, Table } from '@/components/ui';
import { inr, t12, todayIST } from '@/lib/format';
import { useApi } from '@/lib/hooks';

const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86400_000).toISOString().slice(0, 10);

/** CLN-17 earnings & history: per-chamber fees, the split, and what each sitting made. */
export default function EarningsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [from, setFrom] = useState(addDays(todayIST(), -29));
  const [to, setTo] = useState(todayIST());
  const { data, error } = useApi<any>(['clinic', id, 'earnings', from, to], `/clinic/${id}/earnings?from=${from}&to=${to}`);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Spinner />;
  const t = data.totals;
  return (
    <>
      <PageHeader
        title="Earnings & history"
        subtitle="From completed visits. Okidoc takes no commission."
        actions={<><Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></>}
      />
      <Stats items={[{ label: 'Visits', value: t.visits }, { label: 'Gross fees', value: inr(t.gross) }, { label: 'Clinic share', value: inr(t.clinicShare) }, { label: 'Doctor share', value: inr(t.doctorShare) }, { label: 'Not marked paid', value: inr(t.uncollected), tone: t.uncollected ? 'warn' : undefined }]} />
      <Card title="By doctor" className="mb-4">
        <Table
          rows={data.chambers}
          cols={[
            { h: 'Doctor', c: (c: any) => `Dr. ${c.doctorName}` },
            { h: 'Fee', c: (c: any) => inr(c.fee) },
            { h: 'Split', c: (c: any) => `${c.clinicSplitPercent}% clinic` },
            { h: 'Visits', c: (c: any) => c.visits },
            { h: 'Gross', c: (c: any) => inr(c.gross) },
            { h: 'Clinic', c: (c: any) => inr(c.clinicShare) },
            { h: 'Doctor', c: (c: any) => inr(c.doctorShare) },
            { h: 'Collected online', c: (c: any) => inr(c.collectedOnline) },
          ]}
        />
      </Card>
      <Card title="By sitting">
        <Table
          rows={data.sittings}
          cols={[
            { h: 'Date', c: (s: any) => s.date },
            { h: 'Sitting', c: (s: any) => `${t12(s.startTime)} – ${t12(s.endTime)}` },
            { h: 'Doctor', c: (s: any) => `Dr. ${s.doctorName}` },
            { h: 'Visits', c: (s: any) => s.visits },
            { h: 'Gross', c: (s: any) => inr(s.gross) },
            { h: 'Clinic', c: (s: any) => inr(s.clinicShare) },
            { h: 'Doctor', c: (s: any) => inr(s.doctorShare) },
          ]}
        />
      </Card>
    </>
  );
}
