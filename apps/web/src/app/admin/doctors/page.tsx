'use client';

import { useState } from 'react';
import { Button, Card, Confirm, Input, PageHeader, Select, StatusBadge, Table } from '@/components/ui';
import { api, download } from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';

/** ADM-03 doctor verification queue (NMC / state council registration). */
export default function DoctorsPage() {
  const [q, setQ] = useState('');
  const [verification, setVerification] = useState('PENDING');
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(verification ? { verification } : {}) });
  const key = ['admin', 'doctors', q, verification];
  const { data } = useApi<any>(key, `/admin/doctors?${params}`);
  const decide = useAction((v: { id: string; decision: string; reason?: string }) => api(`/admin/doctors/${v.id}/verification`, { body: { decision: v.decision, reason: v.reason } }), {
    invalidate: [['admin', 'doctors']],
    success: 'Decision saved and doctor notified',
  });
  return (
    <>
      <PageHeader title="Doctors" subtitle="Check registration number and council against the NMC / West Bengal Medical Council register before approving." />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input placeholder="Name, registration no. or phone" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={verification} onChange={(e) => setVerification(e.target.value)} className="max-w-[200px]">
            <option value="">All</option>
            <option value="PENDING">Awaiting review</option>
            <option value="APPROVED">Approved</option>
            <option value="INFO_REQUESTED">Info requested</option>
            <option value="REJECTED">Rejected</option>
            <option value="DRAFT">Not submitted</option>
          </Select>
        </div>
        <Table
          rows={data?.items}
          empty="No doctors in this state."
          cols={[
            { h: 'Doctor', c: (d: any) => (<div><div className="font-semibold">Dr. {d.user.name}</div><div className="text-xs text-slate-500">{d.user.phone} · {d.degrees ?? '—'}</div></div>) },
            { h: 'Registration', c: (d: any) => (<div>{d.registrationNo ?? '—'}<div className="text-xs text-slate-500">{d.council ?? ''}</div></div>) },
            { h: 'Specialties', c: (d: any) => d.specialties.map((s: any) => s.name).join(', ') || '—' },
            { h: 'Documents', c: (d: any) => d.documents.length ? d.documents.map((doc: any) => (
              <button key={doc.id} className="mr-2 text-teal-600 underline" onClick={() => download(`/admin/doctor-documents/${doc.id}/file`, `${d.registrationNo ?? 'doc'}-${doc.kind}`)}>{doc.kind.toLowerCase()}</button>
            )) : '—' },
            { h: 'Chambers', c: (d: any) => d._count.links },
            { h: 'Status', c: (d: any) => <StatusBadge status={d.verification} /> },
            {
              h: '',
              c: (d: any) => (
                <div className="flex flex-wrap gap-2">
                  {d.verification !== 'APPROVED' && <Button onClick={() => decide.mutate({ id: d.id, decision: 'APPROVED' })}>Approve</Button>}
                  <Confirm label="Ask info" tone="outline" prompt="What is missing?" onConfirm={(reason) => decide.mutate({ id: d.id, decision: 'INFO_REQUESTED', reason })} />
                  <Confirm label="Reject" prompt="Reason (sent to the doctor)" onConfirm={(reason) => decide.mutate({ id: d.id, decision: 'REJECTED', reason })} />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
