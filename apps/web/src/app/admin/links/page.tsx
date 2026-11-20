'use client';

import { useState } from 'react';
import { Button, Card, Confirm, PageHeader, StatusBadge, Table, Tabs } from '@/components/ui';
import { api } from '@/lib/api';
import { dOnly } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

/** ADM-04 clinic–doctor connections. */
export default function LinksPage() {
  const [status, setStatus] = useState('PENDING');
  const { data } = useApi<any[]>(['admin', 'links', status], `/admin/links?status=${status}`);
  const act = useAction((v: { id: string; status: string; reason?: string }) => api(`/admin/links/${v.id}/status`, { body: { status: v.status, reason: v.reason } }), {
    invalidate: [['admin', 'links']],
    success: 'Connection updated',
  });
  return (
    <>
      <PageHeader title="Clinic–doctor links" subtitle="Approve, decline or force-unlink connections and resolve disputes." />
      <Tabs value={status} onChange={setStatus} tabs={[{ id: 'PENDING', label: 'Pending' }, { id: 'APPROVED', label: 'Approved' }, { id: 'DECLINED', label: 'Declined' }, { id: 'REMOVED', label: 'Removed' }]} />
      <Card>
        <Table
          rows={data}
          cols={[
            { h: 'Clinic', c: (l: any) => `${l.clinic.name} (${l.clinic.code})` },
            { h: 'Doctor', c: (l: any) => `Dr. ${l.doctor.user.name}` },
            { h: 'Requested by', c: (l: any) => l.initiatedBy.toLowerCase() },
            { h: 'Since', c: (l: any) => dOnly(l.createdAt) },
            { h: 'Status', c: (l: any) => <StatusBadge status={l.status} /> },
            {
              h: '',
              c: (l: any) => (
                <div className="flex gap-2">
                  {l.status !== 'APPROVED' && l.status !== 'REMOVED' && <Button onClick={() => act.mutate({ id: l.id, status: 'APPROVED' })}>Approve</Button>}
                  {l.status === 'PENDING' && <Confirm label="Decline" prompt="Reason" onConfirm={(reason) => act.mutate({ id: l.id, status: 'DECLINED', reason })} />}
                  {l.status === 'APPROVED' && <Confirm label="Force unlink" prompt="Reason (future sittings are cancelled and patients refunded)" onConfirm={(reason) => act.mutate({ id: l.id, status: 'REMOVED', reason })} />}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
