'use client';

import { use } from 'react';
import { Badge, Card, Confirm, ErrorBox, PageHeader, Spinner, StatusBadge, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

export default function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const key = ['admin', 'user', id];
  const { data: u, error } = useApi<any>(key, `/admin/users/${id}`);
  const act = useAction((v: { action: string; reason?: string }) => api(`/admin/users/${id}/action`, { body: v }), { invalidate: [key], success: 'Done' });
  if (error) return <ErrorBox error={error} />;
  if (!u) return <Spinner />;
  return (
    <>
      <PageHeader
        title={u.name}
        subtitle={`${u.phone}${u.email ? ` · ${u.email}` : ''} · joined ${dt(u.createdAt)}`}
        actions={
          <>
            <StatusBadge status={u.status} />
            {u.status === 'BLOCKED' ? (
              <Confirm label="Unblock account" tone="primary" onConfirm={() => act.mutate({ action: 'UNBLOCK' })} />
            ) : (
              <Confirm label="Suspend account" prompt="Reason" onConfirm={(reason) => act.mutate({ action: 'BLOCK', reason })} />
            )}
            <Confirm label="Force logout" tone="outline" onConfirm={() => act.mutate({ action: 'FORCE_LOGOUT' })} />
            <Confirm label="Reset quick login" tone="outline" onConfirm={() => act.mutate({ action: 'RESET_QUICK_LOGIN' })} />
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Roles & devices">
          <div className="mb-3 flex flex-wrap gap-1">
            {u.roles.map((r: any) => (
              <Badge key={r.id} tone="info">
                {r.role.toLowerCase().replace('_', ' ')}
                {r.clinicId ? ' · clinic' : ''}
              </Badge>
            ))}
          </div>
          <ul className="space-y-2 text-sm">
            {u.devices.map((d: any) => (
              <li key={d.id} className="flex justify-between">
                <span>
                  {d.name ?? d.platform} <span className="text-xs text-slate-400">{d.quickLoginMethod?.toLowerCase() ?? 'no quick login'}</span>
                </span>
                <span className="text-xs text-slate-500">{dt(d.lastSeenAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Missed visits (BR-07)">
          <p className="text-sm">
            {u.standing.total} of {u.standing.limits.total} overall · limit {u.standing.limits.perClinic} per clinic
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {u.standing.clinics.map((c: any) => (
              <li key={c.clinicId}>
                {c.clinicName}: <b>{c.count}</b>
              </li>
            ))}
          </ul>
          {u.standing.blocks.map((b: any) => (
            <p key={b.id} className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
              Blocked {b.scope === 'PLATFORM' ? 'on Okidoc' : `at ${b.clinicName}`}: {b.reason}
            </p>
          ))}
        </Card>
        <Card title="Family members">
          <ul className="space-y-1 text-sm">
            {u.family.length ? u.family.map((f: any) => <li key={f.id}>{f.name} · {f.relation}</li>) : <li className="text-slate-400">None</li>}
          </ul>
        </Card>
      </div>
      <Card title="Recent bookings" className="mt-4">
        <Table
          rows={u.bookings}
          cols={[
            { h: 'Date', c: (b: any) => `${b.instance.date} ${b.instance.startTime}` },
            { h: 'Doctor', c: (b: any) => `Dr. ${b.instance.sitting.link.doctor.user.name}` },
            { h: 'Clinic', c: (b: any) => b.instance.sitting.link.clinic.name },
            { h: 'Token', c: (b: any) => `#${b.tokenNo}` },
            { h: 'Payment', c: (b: any) => b.paymentMode.toLowerCase().replace(/_/g, ' ') },
            { h: 'Status', c: (b: any) => <StatusBadge status={b.status} /> },
          ]}
        />
      </Card>
      <Card title="Audit trail" className="mt-4">
        <Table rows={u.audit} cols={[{ h: 'When', c: (a: any) => dt(a.createdAt) }, { h: 'Action', c: (a: any) => a.action }, { h: 'Entity', c: (a: any) => a.entity }]} />
      </Card>
    </>
  );
}
