'use client';

import { useState } from 'react';
import { Button, Card, Field, Input, PageHeader, StatusBadge, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { dt, inr, todayIST } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86400_000).toISOString().slice(0, 10);

/** ADM-07 / PAY-10 settlements: consultation fees Okidoc collected online (full prepayment) owed to clinics. Payouts are manual in v1. */
export default function SettlementsPage() {
  const [from, setFrom] = useState(addDays(todayIST(), -6));
  const [to, setTo] = useState(todayIST());
  const { data: due } = useApi<any>(['admin', 'settlements', 'due', from, to], `/admin/settlements/due?from=${from}&to=${to}`);
  const { data: list } = useApi<any[]>(['admin', 'settlements', 'list'], '/admin/settlements');
  const gen = useAction(() => api('/admin/settlements/generate', { body: { from, to } }), {
    invalidate: [['admin', 'settlements']],
    success: (r: any) => `${r.length} settlements created`,
  });
  const [ref, setRef] = useState<Record<string, string>>({});
  const paid = useAction((id: string) => api(`/admin/settlements/${id}/paid`, { body: { reference: ref[id] } }), { invalidate: [['admin', 'settlements']], success: 'Marked as paid' });
  return (
    <>
      <PageHeader title="Settlements" subtitle="Automated split payouts (Razorpay Route) arrive in Phase 2. For now, pay clinics manually and record the reference here." />
      <Card
        title="Due for period"
        actions={
          <>
            <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            <Button className="self-end" onClick={() => gen.mutate(undefined)}>Generate settlements</Button>
          </>
        }
      >
        <Table
          rows={due?.items}
          empty="Nothing collected online in this period."
          cols={[
            { h: 'Clinic', c: (i: any) => i.clinicName },
            { h: 'Paid bookings', c: (i: any) => i.bookings },
            { h: 'Amount due', c: (i: any) => inr(i.amountDue) },
            { h: 'Payout to', c: (i: any) => i.payout.payoutUpi ?? (i.payout.payoutAccount ? `${i.payout.payoutAccount} / ${i.payout.payoutIfsc}` : <span className="text-red-600">not set</span>) },
            { h: 'Settlement', c: (i: any) => (i.settlement ? <StatusBadge status={i.settlement.status} /> : '—') },
          ]}
        />
      </Card>
      <Card title="All settlements" className="mt-4">
        <Table
          rows={list}
          cols={[
            { h: 'Period', c: (s: any) => `${s.periodFrom} → ${s.periodTo}` },
            { h: 'Clinic', c: (s: any) => s.clinicId },
            { h: 'Due', c: (s: any) => inr(s.amountDue) },
            { h: 'Status', c: (s: any) => <StatusBadge status={s.status} /> },
            {
              h: 'Reference',
              c: (s: any) =>
                s.status === 'PAID' ? (
                  `${s.reference} · ${dt(s.paidAt)}`
                ) : (
                  <div className="flex gap-2">
                    <Input placeholder="UTR / reference" value={ref[s.id] ?? ''} onChange={(e) => setRef({ ...ref, [s.id]: e.target.value })} className="!w-44" />
                    <Button disabled={!ref[s.id]} onClick={() => paid.mutate(s.id)}>Mark paid</Button>
                  </div>
                ),
            },
          ]}
        />
      </Card>
    </>
  );
}
