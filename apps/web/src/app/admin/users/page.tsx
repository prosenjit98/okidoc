'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Card, Input, PageHeader, Select, StatusBadge, Table } from '@/components/ui';
import { dOnly } from '@/lib/format';
import { useApi } from '@/lib/hooks';

/** ADM-08 user management. */
export default function UsersPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}) });
  const { data } = useApi<any>(['admin', 'users', q, role], `/admin/users?${params}`);
  return (
    <>
      <PageHeader title="Users" subtitle="Search any account, block or unblock, force logout, reset quick login." />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input placeholder="Name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={role} onChange={(e) => setRole(e.target.value)} className="max-w-[200px]">
            <option value="">All roles</option>
            {['PATIENT', 'DOCTOR', 'CLINIC_OWNER', 'QUEUE_MANAGER', 'ADMIN_SUPER', 'ADMIN_OPS', 'ADMIN_FINANCE', 'ADMIN_SUPPORT'].map((r) => (
              <option key={r} value={r}>
                {r.replace('_', ' ').toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
        <Table
          rows={data?.items}
          onRow={(u: any) => router.push(`/admin/users/${u.id}`)}
          cols={[
            { h: 'Name', c: (u: any) => u.name },
            { h: 'Phone', c: (u: any) => u.phone },
            { h: 'Roles', c: (u: any) => <div className="flex flex-wrap gap-1">{[...new Set(u.roles.map((r: any) => r.role))].map((r: any) => <Badge key={r}>{r.toLowerCase().replace('_', ' ')}</Badge>)}</div> },
            { h: 'Language', c: (u: any) => u.language },
            { h: 'Status', c: (u: any) => <StatusBadge status={u.status} /> },
            { h: 'Joined', c: (u: any) => dOnly(u.createdAt) },
          ]}
        />
        {data && <p className="mt-3 text-xs text-slate-500">{data.total} users</p>}
      </Card>
    </>
  );
}
