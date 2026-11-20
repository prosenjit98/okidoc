'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, Confirm, Input, PageHeader, Select, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

/** ADM-17 no-show blocks (BR-07): 3 at one clinic → clinic block; 7 overall → platform block. */
export default function BlocksPage() {
  const [active, setActive] = useState('true');
  const [scope, setScope] = useState('');
  const [q, setQ] = useState('');
  const params = new URLSearchParams({ active, ...(scope ? { scope } : {}), ...(q ? { q } : {}) });
  const { data } = useApi<any[]>(['admin', 'blocks', active, scope, q], `/admin/blocks?${params}`);
  const lift = useAction((v: { id: string; reason: string }) => api(`/admin/blocks/${v.id}/lift`, { body: { reason: v.reason } }), { invalidate: [['admin', 'blocks']], success: 'Block lifted — patient notified' });
  const reinstate = useAction((v: { id: string; reason: string }) => api(`/admin/blocks/${v.id}/reinstate`, { body: { reason: v.reason } }), { invalidate: [['admin', 'blocks']], success: 'Block reinstated' });
  return (
    <>
      <PageHeader title="No-show blocks" subtitle="Blocks are linked to the verified phone number. Lifting a block keeps the no-show count on record. Change thresholds in Business rules." />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input placeholder="Phone or name" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={active} onChange={(e) => setActive(e.target.value)} className="max-w-[160px]">
            <option value="true">Active</option>
            <option value="false">Lifted</option>
            <option value="all">All</option>
          </Select>
          <Select value={scope} onChange={(e) => setScope(e.target.value)} className="max-w-[160px]">
            <option value="">Any scope</option>
            <option value="CLINIC">Clinic</option>
            <option value="PLATFORM">Platform</option>
          </Select>
        </div>
        <Table
          rows={data}
          empty="No blocks."
          cols={[
            { h: 'Patient', c: (b: any) => (b.user ? <Link className="text-teal-600" href={`/admin/users/${b.user.id}`}>{b.user.name}</Link> : 'Deleted account') },
            { h: 'Phone', c: (b: any) => b.phone },
            { h: 'Scope', c: (b: any) => (b.scope === 'PLATFORM' ? <Badge tone="bad">platform-wide</Badge> : <Badge tone="warn">{b.clinic?.name}</Badge>) },
            { h: 'Reason', c: (b: any) => b.reason },
            { h: 'Since', c: (b: any) => dt(b.createdAt) },
            { h: 'Lifted', c: (b: any) => (b.liftedAt ? `${dt(b.liftedAt)} — ${b.liftReason}` : '—') },
            {
              h: '',
              c: (b: any) =>
                b.active ? (
                  <Confirm label="Lift block" tone="primary" prompt="Reason (e.g. appeal accepted)" onConfirm={(reason) => lift.mutate({ id: b.id, reason })} />
                ) : (
                  <Confirm label="Reinstate" prompt="Reason" onConfirm={(reason) => reinstate.mutate({ id: b.id, reason })} />
                ),
            },
          ]}
        />
      </Card>
    </>
  );
}
