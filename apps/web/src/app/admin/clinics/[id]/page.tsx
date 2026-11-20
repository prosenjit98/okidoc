'use client';

import { ALL_PAYMENT_MODES, CLINIC_TYPE_LABELS, FEATURE_LABELS, FEATURE_KEYS, LIMIT_KEYS, type ClinicType } from '@okidoc/shared';
import { use, useEffect, useState } from 'react';
import { Badge, Button, Card, Confirm, ErrorBox, Field, Input, PageHeader, Select, Spinner, StatusBadge, Table, Toggle } from '@/components/ui';
import { api } from '@/lib/api';
import { inr, rupeesToPaise } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

const MODE_LABEL: Record<string, string> = { PAY_AT_CLINIC: 'Pay at clinic', ONLINE_BOOKING_FEE: 'Online booking fee', ONLINE_FULL: 'Full online prepayment' };

export default function ClinicDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const key = ['admin', 'clinic', id];
  const { data: c, error } = useApi<any>(key, `/admin/clinics/${id}`);
  const { data: plans } = useApi<any[]>(['admin', 'plans'], '/admin/plans');

  const verify = useAction((v: { decision: string; reason?: string }) => api(`/admin/clinics/${id}/verification`, { body: v }), { invalidate: [key], success: 'Decision saved and owner notified' });
  const active = useAction((v: boolean) => api(`/admin/clinics/${id}/active`, { method: 'PATCH', body: { active: v } }), { invalidate: [key] });

  if (error) return <ErrorBox error={error} />;
  if (!c) return <Spinner />;
  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={`${c.code} · ${CLINIC_TYPE_LABELS[c.type as ClinicType] ?? c.type} · ${c.area.name}, ${c.area.region.district}`}
        actions={
          <>
            <StatusBadge status={c.verification} />
            {c.verification !== 'APPROVED' && <Button onClick={() => verify.mutate({ decision: 'APPROVED' })}>Approve</Button>}
            <Confirm label="Request info" tone="outline" prompt="What is missing?" onConfirm={(reason) => verify.mutate({ decision: 'INFO_REQUESTED', reason })} />
            <Confirm label="Reject" prompt="Reason (sent to the owner)" onConfirm={(reason) => verify.mutate({ decision: 'REJECTED', reason })} />
            <span className="flex items-center gap-2 text-sm">
              Active <Toggle checked={c.active} onChange={(v) => active.mutate(v)} />
            </span>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Clinic details">
          <dl className="space-y-2 text-sm">
            <Row k="Owner" v={`${c.owner.name} · ${c.owner.phone}`} />
            <Row k="Address" v={`${c.addressLine}, ${c.pin}`} />
            <Row k="Phone" v={c.phone ?? '—'} />
            <Row k="Drug licence" v={c.drugLicenceNo ?? '—'} />
            <Row k="Hours" v={c.openingHours ?? '—'} />
            <Row k="Payout" v={c.payoutUpi ?? (c.payoutAccount ? `${c.payoutAccount} / ${c.payoutIfsc}` : 'Not set')} />
            <Row k="Queue managers" v={String(c.staff.filter((s: any) => s.role === 'QUEUE_MANAGER').length)} />
          </dl>
          {c.photos?.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {c.photos.map((p: string) => (
                <img key={p} src={p} alt="" className="aspect-square rounded-lg object-cover" />
              ))}
            </div>
          )}
        </Card>
        <div className="xl:col-span-2">
          <Entitlements clinic={c} plans={plans ?? []} />
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ClinicPayment clinic={c} />
        <Card title="Doctors">
          <Table
            rows={c.links}
            cols={[
              { h: 'Doctor', c: (l: any) => `Dr. ${l.doctor.user.name}` },
              { h: 'Fee', c: (l: any) => inr(l.consultationFee) },
              { h: 'Clinic split', c: (l: any) => `${l.clinicSplitPercent}%` },
              { h: 'Status', c: (l: any) => <StatusBadge status={l.status} /> },
            ]}
          />
        </Card>
      </div>
      <Card title="Subscriptions" className="mt-4">
        <Table
          rows={c.subscriptions}
          empty="No subscriptions — the clinic uses the default plan."
          cols={[
            { h: 'Plan', c: (s: any) => s.plan.name },
            { h: 'Status', c: (s: any) => <StatusBadge status={s.status} /> },
            { h: 'Period end', c: (s: any) => (s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString('en-IN') : '—') },
          ]}
        />
      </Card>
    </>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-slate-500">{k}</dt>
    <dd className="text-right font-medium">{v}</dd>
  </div>
);

/** ADM-02: plan + per-clinic overrides. */
function Entitlements({ clinic, plans }: { clinic: any; plans: any[] }) {
  const [planId, setPlanId] = useState<string>(clinic.planId ?? '');
  const [over, setOver] = useState<Record<string, { enabled?: boolean | null; limit?: number | null }>>({});
  useEffect(() => {
    setPlanId(clinic.planId ?? '');
    setOver(Object.fromEntries(clinic.featureOverrides.map((o: any) => [o.key, { enabled: o.enabled, limit: o.limit }])));
  }, [clinic]);
  const plan = plans.find((p) => p.id === planId) ?? plans.find((p) => p.code === clinic.entitlements.planCode);
  const save = useAction(
    () =>
      api(`/admin/clinics/${clinic.id}/entitlements`, {
        method: 'PUT',
        body: { planId: planId || null, overrides: Object.entries(over).map(([key, v]) => ({ key, enabled: v.enabled ?? null, limit: v.limit ?? null })) },
      }),
    { invalidate: [['admin', 'clinic', clinic.id]], success: 'Entitlements saved — the clinic app updates immediately' },
  );
  return (
    <Card
      title="Feature entitlements"
      actions={
        <>
          <Select value={planId} onChange={(e) => setPlanId(e.target.value)} className="!w-48">
            <option value="">Default plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Save
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-500">Plan values are shown in grey. Set an override to turn a feature on or off just for this clinic. The API enforces these on every request.</p>
      <div className="grid gap-2 md:grid-cols-2">
        {FEATURE_KEYS.map((k) => {
          const planVal = !!plan?.features?.[k];
          const o = over[k]?.enabled;
          const effective = o ?? planVal;
          return (
            <div key={k} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
              <div>
                <div className="text-sm font-medium">{FEATURE_LABELS[k]}</div>
                <div className="text-xs text-slate-400">
                  Plan: {planVal ? 'on' : 'off'}
                  {o != null && (
                    <button className="ml-2 text-teal-600" onClick={() => setOver({ ...over, [k]: { ...over[k], enabled: null } })}>
                      reset
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {o != null && <Badge tone="warn">override</Badge>}
                <Toggle checked={effective} onChange={(v) => setOver({ ...over, [k]: { ...over[k], enabled: v } })} />
              </div>
            </div>
          );
        })}
        {LIMIT_KEYS.map((k) => (
          <div key={k} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
            <div>
              <div className="text-sm font-medium">{FEATURE_LABELS[k]}</div>
              <div className="text-xs text-slate-400">Plan: {plan?.limits?.[k] ?? 'unlimited'}</div>
            </div>
            <Input
              type="number"
              min={0}
              placeholder="plan"
              className="!w-24"
              value={over[k]?.limit ?? ''}
              onChange={(e) => setOver({ ...over, [k]: { limit: e.target.value === '' ? null : Number(e.target.value) } })}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** PAY-02: clinic-scoped admin payment configuration with lock. */
function ClinicPayment({ clinic }: { clinic: any }) {
  const row = clinic.paymentRows.find((r: any) => r.scope === 'CLINIC') ?? {};
  const [allowed, setAllowed] = useState<string[]>(row.allowedModes ?? []);
  const [selected, setSelected] = useState<string>(row.selectedMode ?? '');
  const [locked, setLocked] = useState<boolean>(!!row.locked);
  const [fee, setFee] = useState<string>(row.bookingFeePaise != null ? String(row.bookingFeePaise / 100) : '');
  const save = useAction(
    () =>
      api('/admin/payment-configs', {
        method: 'PUT',
        body: { scope: 'CLINIC', scopeId: clinic.id, allowedModes: allowed.length ? allowed : null, selectedMode: selected || null, locked, bookingFeePaise: fee === '' ? null : rupeesToPaise(fee) },
      }),
    { invalidate: [['admin', 'clinic', clinic.id]], success: 'Payment settings saved' },
  );
  const eff = clinic.effectivePayment;
  return (
    <Card title="Payment configuration (this clinic)" actions={<Button loading={save.isPending} onClick={() => save.mutate(undefined)}>Save</Button>}>
      <div className="mb-4 rounded-xl bg-teal-50 p-3 text-sm">
        Effective: <b>{MODE_LABEL[eff.mode]}</b> (decided by {eff.decidedBy.toLowerCase()}
        {eff.lockedBy ? `, locked at ${eff.lockedBy.toLowerCase()}` : ''}). Allowed: {eff.allowedModes.map((m: string) => MODE_LABEL[m]).join(', ')}. Booking fee {eff.fees.bookingFeeEnabled ? inr(eff.fees.bookingFeePaise) : 'off'} · commission {eff.fees.commissionEnabled ? `${eff.fees.commissionPercent}%` : 'off'}.
      </div>
      <Field label="Allowed modes for this clinic (empty = inherit)">
        <div className="flex flex-wrap gap-3 text-sm">
          {ALL_PAYMENT_MODES.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="checkbox" checked={allowed.includes(m)} onChange={(e) => setAllowed(e.target.checked ? [...allowed, m] : allowed.filter((x) => x !== m))} />
              {MODE_LABEL[m]}
            </label>
          ))}
        </div>
      </Field>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Field label="Selected mode">
          <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Clinic chooses</option>
            {ALL_PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Booking fee ₹ (empty = inherit)">
          <Input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} />
        </Field>
        <Field label="Lock (clinic can't change)">
          <div className="pt-2">
            <Toggle checked={locked} onChange={setLocked} />
          </div>
        </Field>
      </div>
      <p className="mt-3 text-xs text-slate-500">Online modes also need the matching feature entitlement (Payment mode: online booking fee / full online prepayment).</p>
    </Card>
  );
}
