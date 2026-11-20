'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Field, Input, PageHeader, Spinner, Toggle } from '@/components/ui';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';

const NUMERIC: { key: string; label: string; hint?: string }[] = [
  { key: 'noShowPerClinicLimit', label: 'No-shows at one clinic before clinic block', hint: 'BR-07 · pay-at-clinic bookings only' },
  { key: 'noShowTotalLimit', label: 'No-shows overall before platform block', hint: 'BR-07 · lifetime count' },
  { key: 'maxActiveBookings', label: 'Max active bookings per patient', hint: 'BR-05' },
  { key: 'defaultConsultMinutes', label: 'Default consult minutes (ETA)', hint: 'BR-08 · used until enough history' },
  { key: 'turnNearThreshold', label: '"Turn is near" alert when N ahead', hint: 'PAT-12' },
  { key: 'paymentHoldMinutes', label: 'Unpaid booking hold (minutes)', hint: 'PAY-05' },
  { key: 'patientFullRefundMinutes', label: 'Full refund if patient cancels ≥ minutes before', hint: 'BR-12 default' },
  { key: 'defaultBookingWindowHours', label: 'Default advance booking window (hours)', hint: 'BR-03' },
  { key: 'defaultCutoffMinutes', label: 'Online booking closes minutes before sitting ends', hint: 'BR-04' },
  { key: 'passcodeMaxAttempts', label: 'Wrong passcode attempts before full login', hint: 'AUTH-08' },
];

/** ADM-17 business rule settings. */
export default function RulesPage() {
  const { data } = useApi<any>(['admin', 'rules'], '/admin/rules');
  const [form, setForm] = useState<any>(null);
  useEffect(() => data && setForm({ ...data, blockedAdCategories: data.blockedAdCategories.join(', ') }), [data]);
  const save = useAction(
    () =>
      api('/admin/rules', {
        method: 'PUT',
        body: {
          ...Object.fromEntries(NUMERIC.map((n) => [n.key, Number(form[n.key])])),
          clinicCanLiftBlocks: form.clinicCanLiftBlocks,
          blockedAdCategories: String(form.blockedAdCategories).split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean),
        },
      }),
    { invalidate: [['admin', 'rules']], success: 'Rules saved' },
  );
  if (!form) return <Spinner />;
  return (
    <>
      <PageHeader title="Business rules" subtitle="Platform-wide thresholds. Changes apply immediately and are recorded in the audit log." actions={<Button loading={save.isPending} onClick={() => save.mutate(undefined)}>Save rules</Button>} />
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          {NUMERIC.map((n) => (
            <Field key={n.key} label={n.label} hint={n.hint}>
              <Input type="number" min={0} value={form[n.key]} onChange={(e) => setForm({ ...form, [n.key]: e.target.value })} />
            </Field>
          ))}
          <Field label="Clinics may lift blocks at their own clinic" hint="BR-07c — off at launch (admin only)">
            <div className="pt-2">
              <Toggle checked={!!form.clinicCanLiftBlocks} onChange={(v) => setForm({ ...form, clinicCanLiftBlocks: v })} />
            </div>
          </Field>
          <Field label="Blocked ad categories" hint="Comma separated (MON-03)">
            <Input value={form.blockedAdCategories} onChange={(e) => setForm({ ...form, blockedAdCategories: e.target.value })} />
          </Field>
        </div>
      </Card>
    </>
  );
}
