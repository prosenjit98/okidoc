'use client';

import { CLINIC_TYPE_LABELS, type ClinicType } from '@okidoc/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Card, Input, PageHeader, Select, StatusBadge, Table } from '@/components/ui';
import { dOnly } from '@/lib/format';
import { useApi } from '@/lib/hooks';

export default function ClinicsPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [verification, setVerification] = useState('');
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(verification ? { verification } : {}) });
  const { data } = useApi<any>(['admin', 'clinics', q, verification], `/admin/clinics?${params}`);
  return (
    <>
      <PageHeader title="Clinics" subtitle="Verify clinics, set plans and feature entitlements (ADM-02/03)" />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input placeholder="Search name, code or owner phone" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={verification} onChange={(e) => setVerification(e.target.value)} className="max-w-[200px]">
            <option value="">All statuses</option>
            <option value="PENDING">Awaiting review</option>
            <option value="APPROVED">Approved</option>
            <option value="INFO_REQUESTED">Info requested</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>
        <Table
          rows={data?.items}
          onRow={(c: any) => router.push(`/admin/clinics/${c.id}`)}
          cols={[
            { h: 'Clinic', c: (c: any) => (<div><div className="font-semibold">{c.name}</div><div className="text-xs text-slate-500">{c.code} · {CLINIC_TYPE_LABELS[c.type as ClinicType] ?? c.type}</div></div>) },
            { h: 'Area', c: (c: any) => `${c.area.name}, ${c.area.region.district}` },
            { h: 'Owner', c: (c: any) => (<div>{c.owner.name}<div className="text-xs text-slate-500">{c.owner.phone}</div></div>) },
            { h: 'Doctors', c: (c: any) => c._count.links },
            { h: 'Rating', c: (c: any) => (c.ratingCount ? <span title={`${c.ratingCount} ratings`}>★ {c.ratingAvg?.toFixed(1)} <span className="text-xs text-slate-500">({c.ratingCount})</span></span> : <span className="text-xs text-slate-400">not rated</span>) },
            { h: 'Plan', c: (c: any) => <Badge tone="info">{c.plan?.name ?? 'Default'}</Badge> },
            { h: 'Status', c: (c: any) => (<div className="flex gap-1"><StatusBadge status={c.verification} />{!c.active && <Badge tone="bad">inactive</Badge>}</div>) },
            { h: 'Registered', c: (c: any) => dOnly(c.createdAt) },
          ]}
        />
        {data && <p className="mt-3 text-xs text-slate-500">{data.total} clinics</p>}
      </Card>
    </>
  );
}
