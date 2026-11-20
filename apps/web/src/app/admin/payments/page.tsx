'use client';

import { ALL_PAYMENT_MODES } from '@okidoc/shared';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Confirm, Field, Input, PageHeader, Select, Spinner, Table, Toggle } from '@/components/ui';
import { api } from '@/lib/api';
import { inr, rupeesToPaise } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

const MODE: Record<string, string> = { PAY_AT_CLINIC: 'Pay at clinic', ONLINE_BOOKING_FEE: 'Online booking fee', ONLINE_FULL: 'Full online' };

interface Form {
  allowedModes: string[];
  selectedMode: string;
  locked: boolean;
  bookingFee: string;
  commissionPercent: string;
  commissionFlat: string;
  taxPercent: string;
  refundHours: string;
}

const toForm = (r: any): Form => ({
  allowedModes: r?.allowedModes ?? [],
  selectedMode: r?.selectedMode ?? '',
  locked: !!r?.locked,
  bookingFee: r?.bookingFeePaise != null ? String(r.bookingFeePaise / 100) : '',
  commissionPercent: r?.commissionPercent != null ? String(r.commissionPercent) : '',
  commissionFlat: r?.commissionFlatPaise != null ? String(r.commissionFlatPaise / 100) : '',
  taxPercent: r?.taxPercent != null ? String(r.taxPercent) : '',
  refundHours: r?.patientFullRefundMinutes != null ? String(r.patientFullRefundMinutes / 60) : '',
});
const toBody = (scope: string, scopeId: string | null, f: Form) => ({
  scope,
  scopeId,
  allowedModes: f.allowedModes.length ? f.allowedModes : null,
  selectedMode: f.selectedMode || null,
  locked: f.locked,
  bookingFeePaise: f.bookingFee === '' ? null : rupeesToPaise(f.bookingFee),
  commissionPercent: f.commissionPercent === '' ? null : Number(f.commissionPercent),
  commissionFlatPaise: f.commissionFlat === '' ? null : rupeesToPaise(f.commissionFlat),
  taxPercent: f.taxPercent === '' ? null : Number(f.taxPercent),
  patientFullRefundMinutes: f.refundHours === '' ? null : Math.round(Number(f.refundHours) * 60),
});

function ConfigForm({ value, onChange, platform }: { value: Form; onChange: (f: Form) => void; platform?: boolean }) {
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="space-y-3">
      <Field label={platform ? 'Modes enabled on the platform' : 'Allowed modes (empty = inherit)'}>
        <div className="flex flex-wrap gap-4 text-sm">
          {ALL_PAYMENT_MODES.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="checkbox" checked={value.allowedModes.includes(m)} onChange={(e) => onChange({ ...value, allowedModes: e.target.checked ? [...value.allowedModes, m] : value.allowedModes.filter((x) => x !== m) })} />
              {MODE[m]}
            </label>
          ))}
        </div>
      </Field>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Default mode">
          <Select value={value.selectedMode} onChange={set('selectedMode')}>
            <option value="">{platform ? 'Pay at clinic' : 'Inherit'}</option>
            {ALL_PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {MODE[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Booking fee ₹" hint="Charged only when the Booking fee stream is on">
          <Input type="number" min={0} value={value.bookingFee} onChange={set('bookingFee')} />
        </Field>
        <Field label="GST % on booking fee">
          <Input type="number" min={0} value={value.taxPercent} onChange={set('taxPercent')} />
        </Field>
        <Field label="Full refund if cancelled ≥ hours before">
          <Input type="number" min={0} value={value.refundHours} onChange={set('refundHours')} />
        </Field>
        <Field label="Commission %" hint="Charged only when the Commission stream is on">
          <Input type="number" min={0} max={100} value={value.commissionPercent} onChange={set('commissionPercent')} />
        </Field>
        <Field label="Commission flat ₹">
          <Input type="number" min={0} value={value.commissionFlat} onChange={set('commissionFlat')} />
        </Field>
        <Field label="Lock (narrower scopes can't change the mode)">
          <div className="pt-2">
            <Toggle checked={value.locked} onChange={(locked) => onChange({ ...value, locked })} />
          </div>
        </Field>
      </div>
    </div>
  );
}

/** ADM-05 / PAY-01 / PAY-02 platform and region payment configuration. */
export default function PaymentsConfigPage() {
  const key = ['admin', 'payment-configs'];
  const { data } = useApi<any[]>(key, '/admin/payment-configs');
  const { data: regions } = useApi<any[]>(['regions'], '/regions');
  const platform = data?.find((r) => r.scope === 'PLATFORM');
  const [pf, setPf] = useState<Form>(toForm(null));
  useEffect(() => setPf(toForm(platform)), [platform]);
  const [regionId, setRegionId] = useState('');
  const [rf, setRf] = useState<Form>(toForm(null));
  const save = useAction((b: any) => api('/admin/payment-configs', { method: 'PUT', body: b }), { invalidate: [key], success: 'Payment configuration saved' });
  const del = useAction((id: string) => api(`/admin/payment-configs/${id}`, { method: 'DELETE' }), { invalidate: [key] });
  if (!data) return <Spinner />;
  return (
    <>
      <PageHeader title="Payment configuration" subtitle="Resolution order: sitting › doctor › clinic › region › platform. Admin locks stop narrower scopes. Clinics choose within these limits." />
      <Card title="Platform default" actions={<Button onClick={() => save.mutate(toBody('PLATFORM', null, pf))}>Save platform</Button>}>
        <ConfigForm value={pf} onChange={setPf} platform />
      </Card>
      <Card title="Region overrides" className="mt-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Field label="District">
            <Select value={regionId} onChange={(e) => { setRegionId(e.target.value); setRf(toForm(data.find((r) => r.scope === 'REGION' && r.scopeId === e.target.value))); }} className="!w-64">
              <option value="">Choose a district…</option>
              {regions?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.district}, {r.state}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {regionId && (
          <>
            <ConfigForm value={rf} onChange={setRf} />
            <Button className="mt-3" onClick={() => save.mutate(toBody('REGION', regionId, rf))}>
              Save region override
            </Button>
          </>
        )}
      </Card>
      <Card title="All admin overrides" className="mt-4">
        <Table
          rows={data.filter((r) => r.scope !== 'PLATFORM')}
          empty="No region or clinic overrides."
          cols={[
            { h: 'Scope', c: (r: any) => (r.scope === 'REGION' ? `Region · ${regions?.find((g) => g.id === r.scopeId)?.district ?? r.scopeId}` : `Clinic · ${r.scopeId}`) },
            { h: 'Allowed', c: (r: any) => (r.allowedModes.length ? r.allowedModes.map((m: string) => MODE[m]).join(', ') : 'inherit') },
            { h: 'Mode', c: (r: any) => (r.selectedMode ? MODE[r.selectedMode] : 'inherit') },
            { h: 'Booking fee', c: (r: any) => (r.bookingFeePaise != null ? inr(r.bookingFeePaise) : 'inherit') },
            { h: 'Lock', c: (r: any) => (r.locked ? <Badge tone="warn">locked</Badge> : '—') },
            { h: '', c: (r: any) => <Confirm label="Remove" onConfirm={() => del.mutate(r.id)} /> },
          ]}
        />
      </Card>
    </>
  );
}
