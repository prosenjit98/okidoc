'use client';

import { useState } from 'react';
import { Button, Card, Input, PageHeader, Table } from '@/components/ui';
import { dt } from '@/lib/format';
import { useApi } from '@/lib/hooks';

/** ADM-14 audit log (super-admin). */
export default function AuditPage() {
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const { data } = useApi<any>(['admin', 'audit', entity, page], `/admin/audit?page=${page}${entity ? `&entity=${entity}` : ''}`);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every admin and clinic-settings change: who, what, when, before and after." />
      <Card>
        <Input placeholder="Filter by entity (Clinic, PaymentConfig, PatientBlock…)" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} className="mb-4 max-w-sm" />
        <Table
          rows={data?.items}
          onRow={(a: any) => setOpen(open === a.id ? null : a.id)}
          cols={[
            { h: 'When', c: (a: any) => dt(a.createdAt) },
            { h: 'Who', c: (a: any) => a.actorName },
            { h: 'Action', c: (a: any) => <span className="font-mono text-xs">{a.action}</span> },
            { h: 'Entity', c: (a: any) => `${a.entity}${a.entityId ? ` · ${a.entityId.slice(0, 10)}…` : ''}` },
            {
              h: 'Details',
              c: (a: any) =>
                open === a.id ? (
                  <pre className="max-w-xl overflow-x-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify({ before: a.before, after: a.after }, null, 2)}</pre>
                ) : (
                  <span className="text-xs text-teal-600">show</span>
                ),
            },
          ]}
        />
        {data && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">{data.total} entries</span>
            <div className="flex gap-2">
              <Button tone="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button tone="outline" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
