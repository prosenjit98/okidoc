'use client';

import { useState } from 'react';
import { Badge, Button, Card, Confirm, Field, Input, PageHeader, Select, Spinner, Table, Toggle } from '@/components/ui';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

const STREAMS: Record<string, { label: string; desc: string }> = {
  ADS: { label: 'In-app ads', desc: 'House sponsored campaigns + AdMob in the patient app. Main income at launch.' },
  CLINIC_SUBSCRIPTION: { label: 'Clinic subscriptions', desc: 'Paid plans for clinics. Turn on once there are enough active clinics.' },
  DOCTOR_SUBSCRIPTION: { label: 'Doctor subscriptions', desc: 'Optional premium for doctors (future).' },
  BOOKING_FEE: { label: 'Patient booking fee', desc: 'Fee per online booking in online payment modes.' },
  COMMISSION: { label: 'Commission', desc: 'Share of the consultation fee. Off — Okidoc is non-commission.' },
  SPONSORED_LISTINGS: { label: 'Sponsored listings', desc: 'Boosted search/rail placement for clinics and doctors (future).' },
};

/** ADM-15 / MON-01 revenue stream switches. */
export default function RevenuePage() {
  const key = ['admin', 'revenue'];
  const { data } = useApi<any>(key, '/admin/revenue-settings');
  const { data: regions } = useApi<any[]>(['regions'], '/regions');
  const set = useAction((v: { stream: string; scope: string; scopeId?: string; enabled: boolean; effectiveFrom?: string | null }) => api('/admin/revenue-settings', { method: 'PUT', body: v }), {
    invalidate: [key],
    success: 'Saved — applies to new bookings and billing periods',
  });
  const del = useAction((id: string) => api(`/admin/revenue-settings/${id}`, { method: 'DELETE' }), { invalidate: [key] });
  const [ov, setOv] = useState({ stream: 'CLINIC_SUBSCRIPTION', scope: 'REGION', scopeId: '', enabled: true, effectiveFrom: '' });
  if (!data) return <Spinner />;
  return (
    <>
      <PageHeader title="Revenue switches" subtitle="Turn each earning method on or off without an app release. Most specific scope wins: clinic › region › platform." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.platform.map((p: any) => (
          <Card key={p.stream}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-navy-900">{STREAMS[p.stream].label}</h3>
                <p className="mt-1 text-xs text-slate-500">{STREAMS[p.stream].desc}</p>
              </div>
              <Toggle checked={p.enabled} label={STREAMS[p.stream].label} onChange={(enabled) => set.mutate({ stream: p.stream, scope: 'PLATFORM', enabled })} />
            </div>
            <div className="mt-3">
              <Badge tone={p.enabled ? 'ok' : 'muted'}>{p.enabled ? 'On platform-wide' : 'Off platform-wide'}</Badge>
            </div>
          </Card>
        ))}
      </div>
      <Card title="Region / clinic overrides" className="mt-4">
        <div className="mb-4 grid gap-3 md:grid-cols-6">
          <Field label="Stream">
            <Select value={ov.stream} onChange={(e) => setOv({ ...ov, stream: e.target.value })}>
              {Object.entries(STREAMS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Scope">
            <Select value={ov.scope} onChange={(e) => setOv({ ...ov, scope: e.target.value, scopeId: '' })}>
              <option value="REGION">Region (district)</option>
              <option value="CLINIC">Clinic</option>
            </Select>
          </Field>
          <Field label={ov.scope === 'REGION' ? 'District' : 'Clinic ID'}>
            {ov.scope === 'REGION' ? (
              <Select value={ov.scopeId} onChange={(e) => setOv({ ...ov, scopeId: e.target.value })}>
                <option value="">Choose…</option>
                {regions?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.district}
                  </option>
                ))}
              </Select>
            ) : (
              <Input value={ov.scopeId} onChange={(e) => setOv({ ...ov, scopeId: e.target.value })} placeholder="from clinic page URL" />
            )}
          </Field>
          <Field label="Enabled">
            <div className="pt-2">
              <Toggle checked={ov.enabled} onChange={(enabled) => setOv({ ...ov, enabled })} />
            </div>
          </Field>
          <Field label="Effective from (optional)">
            <Input type="datetime-local" value={ov.effectiveFrom} onChange={(e) => setOv({ ...ov, effectiveFrom: e.target.value })} />
          </Field>
          <div className="flex items-end">
            <Button
              disabled={!ov.scopeId}
              onClick={() => set.mutate({ ...ov, effectiveFrom: ov.effectiveFrom ? new Date(ov.effectiveFrom).toISOString() : null })}
            >
              Add override
            </Button>
          </div>
        </div>
        <Table
          rows={data.rows.filter((r: any) => r.scope !== 'PLATFORM')}
          empty="No overrides — platform settings apply everywhere."
          cols={[
            { h: 'Stream', c: (r: any) => STREAMS[r.stream]?.label ?? r.stream },
            { h: 'Scope', c: (r: any) => `${r.scope.toLowerCase()} · ${regions?.find((g) => g.id === r.scopeId)?.district ?? r.scopeId}` },
            { h: 'Enabled', c: (r: any) => <Badge tone={r.enabled ? 'ok' : 'muted'}>{r.enabled ? 'on' : 'off'}</Badge> },
            { h: 'From', c: (r: any) => (r.effectiveFrom ? dt(r.effectiveFrom) : 'now') },
            { h: '', c: (r: any) => <Confirm label="Remove" onConfirm={() => del.mutate(r.id)} /> },
          ]}
        />
      </Card>
    </>
  );
}
