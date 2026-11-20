'use client';

import { use, useEffect, useState } from 'react';
import { Badge, Button, Card, ErrorBox, Field, Input, PageHeader, Select, Spinner, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { days, inr, t12 } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

const MODE: Record<string, string> = { PAY_AT_CLINIC: 'Pay at clinic', ONLINE_BOOKING_FEE: 'Booking fee online, consultation at clinic', ONLINE_FULL: 'Full payment online' };

/** CLN-19 / PAY-03 fees & payment settings (choose within what Okidoc allows). */
export default function FeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const key = ['clinic', id, 'fees'];
  const { data, error } = useApi<any>(key, `/clinic/${id}/payment-settings`);
  const save = useAction((body: any) => api(`/clinic/${id}/payment-settings`, { method: 'PUT', body }), { invalidate: [key], success: 'Payment settings saved' });
  const savePayout = useAction((body: any) => api(`/clinic/${id}`, { method: 'PATCH', body }), { invalidate: [key], success: 'Payout details saved' });
  const [payout, setPayout] = useState({ payoutUpi: '', payoutAccount: '', payoutIfsc: '' });
  useEffect(() => data && setPayout({ payoutUpi: data.payout.upi ?? '', payoutAccount: data.payout.account ?? '', payoutIfsc: data.payout.ifsc ?? '' }), [data]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Spinner />;
  const locked = !!data.lockedBy;
  const modeSelect = (value: string | null, onChange: (v: string | null) => void, inherit: string) => (
    <Select value={value ?? ''} disabled={locked} onChange={(e) => onChange(e.target.value || null)} className="!w-72">
      <option value="">{inherit}</option>
      {data.allowedModes.map((m: string) => (
        <option key={m} value={m}>
          {MODE[m]}
        </option>
      ))}
    </Select>
  );
  return (
    <>
      <PageHeader title="Fees & payment settings" subtitle="Choose how patients pay. Okidoc decides which options are available to your clinic." />
      <Card title="How patients pay" className="mb-4" actions={locked && <Badge tone="warn">Set by Okidoc</Badge>}>
        <div className="mb-4 rounded-xl bg-teal-50 p-3 text-sm">
          Currently: <b>{MODE[data.effectiveMode]}</b>.{' '}
          {data.fees.bookingFeeEnabled ? `Booking fee ${inr(data.fees.bookingFeePaise)} applies to online modes.` : 'No booking fee is charged.'}{' '}
          {data.fees.commissionEnabled ? `Okidoc commission ${data.fees.commissionPercent}%.` : 'Okidoc takes no commission.'} Patients who cancel at least {Math.round(data.fees.refundFullMinutes / 60)} h before get a refund of anything paid online (minus booking fee).
        </div>
        {locked && <p className="mb-3 text-sm text-amber-700">Okidoc has locked the payment mode for your clinic. Contact Okidoc to change it.</p>}
        <Field label="Default for all doctors">{modeSelect(data.clinicSelectedMode, (v) => save.mutate({ defaultMode: v }), 'Okidoc default')}</Field>
        {data.allowedModes.length === 1 && <p className="mt-2 text-xs text-slate-500">Online payment options are not enabled for your clinic. Contact Okidoc to enable them.</p>}
      </Card>
      <Card title="Per doctor and per sitting" className="mb-4">
        <Table
          rows={data.doctors}
          cols={[
            { h: 'Doctor', c: (d: any) => (<div><div className="font-semibold">Dr. {d.doctorName}</div><div className="text-xs text-slate-500">Fee {inr(d.consultationFee)} · clinic share {d.clinicSplitPercent}%</div></div>) },
            { h: 'Doctor mode', c: (d: any) => modeSelect(d.mode, (v) => save.mutate({ doctorOverrides: [{ linkId: d.linkId, mode: v }] }), 'Same as clinic') },
            {
              h: 'Sittings',
              c: (d: any) => (
                <div className="space-y-1">
                  {d.sittings.map((s: any) => (
                    <div key={s.sittingId} className="flex items-center gap-2 text-xs">
                      <span className="w-40">{days(s.weekdays)} {t12(s.startTime)}</span>
                      {modeSelect(s.mode, (v) => save.mutate({ sittingOverrides: [{ sittingId: s.sittingId, mode: v }] }), 'Same as doctor')}
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
        />
        <p className="mt-3 text-xs text-slate-500">Change consultation fees and the clinic/doctor split on the Doctors page.</p>
      </Card>
      <Card title="Payout details" actions={<Button onClick={() => savePayout.mutate({ payoutUpi: payout.payoutUpi || null, payoutAccount: payout.payoutAccount || null, payoutIfsc: payout.payoutIfsc || null })}>Save payout</Button>}>
        <p className="mb-3 text-xs text-slate-500">Where Okidoc sends consultation fees collected online.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="UPI ID"><Input value={payout.payoutUpi} onChange={(e) => setPayout({ ...payout, payoutUpi: e.target.value })} placeholder="clinic@upi" /></Field>
          <Field label="Bank account no."><Input value={payout.payoutAccount} onChange={(e) => setPayout({ ...payout, payoutAccount: e.target.value })} /></Field>
          <Field label="IFSC"><Input value={payout.payoutIfsc} onChange={(e) => setPayout({ ...payout, payoutIfsc: e.target.value.toUpperCase() })} /></Field>
        </div>
      </Card>
    </>
  );
}
