'use client';

import { use, useState } from 'react';
import { Button, Card, ErrorBox, Field, Input, PageHeader, StatusBadge, Table } from '@/components/ui';
import { download } from '@/lib/api';
import { inr, todayIST } from '@/lib/format';
import { useApi } from '@/lib/hooks';

const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86400_000).toISOString().slice(0, 10);

/** CLN-15 visit register with CSV export. */
export default function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [from, setFrom] = useState(addDays(todayIST(), -6));
  const [to, setTo] = useState(todayIST());
  const [q, setQ] = useState('');
  const qs = `from=${from}&to=${to}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const { data, error } = useApi<any>(['clinic', id, 'register', qs], `/clinic/${id}/register?${qs}`);
  return (
    <>
      <PageHeader title="Visit register" subtitle="Every token by doctor and sitting." actions={<Button tone="outline" onClick={() => download(`/clinic/${id}/register?${qs}&format=csv`, `okidoc-register-${from}-${to}.csv`)}>Export CSV</Button>} />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Patient name or phone"><Input value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        </div>
        {error ? <ErrorBox error={error} /> : (
          <Table
            rows={data?.items}
            empty="No visits in this period."
            cols={[
              { h: 'Date', c: (r: any) => r.date },
              { h: 'Sitting', c: (r: any) => r.sitting },
              { h: 'Doctor', c: (r: any) => `Dr. ${r.doctor}` },
              { h: 'Token', c: (r: any) => `#${r.token}` },
              { h: 'Patient', c: (r: any) => (<div>{r.patient}<div className="text-xs text-slate-500">{r.phone}</div></div>) },
              { h: 'Source', c: (r: any) => r.source.toLowerCase().replace('_', '-') },
              { h: 'Status', c: (r: any) => <StatusBadge status={r.status} /> },
              { h: 'Fee', c: (r: any) => inr(r.fee) },
              { h: 'Paid', c: (r: any) => r.paid.toLowerCase().replace('_', ' ') || '—' },
            ]}
          />
        )}
      </Card>
    </>
  );
}
