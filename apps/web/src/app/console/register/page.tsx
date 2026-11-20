'use client';

import { CLINIC_TYPES, CLINIC_TYPE_LABELS } from '@okidoc/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Field, Input, Logo, Select, Spinner, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { useAction, useApi, useRequireAuth } from '@/lib/hooks';

/** CLN-01 clinic registration. */
export default function RegisterClinic() {
  const session = useRequireAuth();
  const router = useRouter();
  const { data: areas } = useApi<any[]>(['areas', 'all'], '/areas');
  const [f, setF] = useState({ name: '', type: 'PHARMACY_CHAMBER', addressLine: '', areaId: '', pin: '', phone: '', openingHours: 'Mon–Sat 9 AM – 9 PM', about: '', drugLicenceNo: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    if (k === 'areaId') {
      const a = areas?.find((x) => x.id === v);
      setF({ ...f, areaId: v, pin: a?.pin ?? f.pin });
    } else setF({ ...f, [k]: v });
  };
  const reg = useAction(
    () => api<any>('/clinics/register', { body: { ...f, phone: f.phone || undefined, drugLicenceNo: f.drugLicenceNo || null, about: f.about || undefined } }),
    { success: 'Clinic registered — Okidoc will verify it shortly' },
  );
  if (!session || !areas) return <Spinner />;
  return (
    <div className="ok-main min-h-screen">
      <div className="ok-aurora relative overflow-hidden px-6 pb-28 pt-6 text-white">
        <div className="ok-dots pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-2xl">
          <Logo light />
          <p className="mt-10 text-[11px] font-bold uppercase tracking-[0.2em] text-teal-200">Step 3 of 3 · Your clinic</p>
          <h1 className="mt-2 text-[32px] font-extrabold tracking-tight">Start your clinic on Okidoc</h1>
          <p className="mt-2 text-sm text-teal-50/70">Patients find you after Okidoc verifies your clinic. You can add doctors right away.</p>
        </div>
      </div>
      <div className="relative mx-auto -mt-16 max-w-2xl px-6 pb-16">
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Clinic / pharmacy name"><Input value={f.name} onChange={set('name')} /></Field>
          <Field label="Type">
            <Select value={f.type} onChange={set('type')}>
              {CLINIC_TYPES.map((t) => <option key={t} value={t}>{CLINIC_TYPE_LABELS[t]}</option>)}
            </Select>
          </Field>
          <div className="md:col-span-2"><Field label="Address"><Input value={f.addressLine} onChange={set('addressLine')} /></Field></div>
          <Field label="Area">
            <Select value={f.areaId} onChange={set('areaId')}>
              <option value="">Choose…</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.region.district} ({a.pin})</option>)}
            </Select>
          </Field>
          <Field label="PIN code"><Input value={f.pin} maxLength={6} onChange={set('pin')} /></Field>
          <Field label="Clinic phone"><Input value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Opening hours"><Input value={f.openingHours} onChange={set('openingHours')} /></Field>
          {f.type === 'PHARMACY_CHAMBER' && <Field label="Drug licence number"><Input value={f.drugLicenceNo} onChange={set('drugLicenceNo')} /></Field>}
          <div className="md:col-span-2"><Field label="About (shown to patients)"><Textarea rows={3} value={f.about} onChange={set('about')} /></Field></div>
        </div>
        <Button
          className="mt-6 w-full py-3"
          loading={reg.isPending}
          disabled={!f.name || !f.addressLine || !f.areaId || f.pin.length !== 6}
          onClick={() => reg.mutate(undefined, { onSuccess: (c) => router.replace(`/console/${c.id}/queue`) })}
        >
          Register clinic
        </Button>
      </Card>
      </div>
    </div>
  );
}
