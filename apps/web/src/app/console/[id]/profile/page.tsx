'use client';

import { CLINIC_TYPES, CLINIC_TYPE_LABELS } from '@okidoc/shared';
import { use, useEffect, useState } from 'react';
import { Button, Card, Field, Input, PageHeader, Select, Spinner, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';

/** CLN-18 clinic profile & photos (+ CLN-20 booking window / cut-off). */
export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const key = ['clinic', id];
  const { data: c } = useApi<any>(key, `/clinic/${id}`);
  const { data: areas } = useApi<any[]>(['areas', 'all'], '/areas');
  const [f, setF] = useState<any>(null);
  useEffect(() => c && setF({ name: c.name, type: c.type, addressLine: c.addressLine, areaId: c.areaId, pin: c.pin, phone: c.phone ?? '', openingHours: c.openingHours ?? '', about: c.about ?? '', drugLicenceNo: c.drugLicenceNo ?? '', bookingWindowHours: c.bookingWindowHours ?? '', cutoffMinutes: c.cutoffMinutes ?? '', lateRejoinAfter: String(c.lateRejoinAfter ?? 2) }), [c]);
  const save = useAction(
    () =>
      api(`/clinic/${id}`, {
        method: 'PATCH',
        body: {
          ...f,
          phone: f.phone || undefined,
          drugLicenceNo: f.drugLicenceNo || null,
          bookingWindowHours: f.bookingWindowHours === '' ? null : Number(f.bookingWindowHours),
          cutoffMinutes: f.cutoffMinutes === '' ? undefined : Number(f.cutoffMinutes),
          lateRejoinAfter: Number(f.lateRejoinAfter),
        },
      }),
    { invalidate: [key], success: 'Profile saved' },
  );
  const upload = useAction((file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api(`/clinic/${id}/photos`, { form });
  }, { invalidate: [key], success: 'Photo added' });
  const removePhoto = useAction((url: string) => api(`/clinic/${id}/photos?url=${encodeURIComponent(url)}`, { method: 'DELETE' }), { invalidate: [key] });
  if (!c || !f || !areas) return <Spinner />;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <PageHeader title="Clinic profile & photos" subtitle="What patients see on Okidoc." actions={<Button loading={save.isPending} onClick={() => save.mutate(undefined)}>Save</Button>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name"><Input value={f.name} onChange={set('name')} /></Field>
            <Field label="Type"><Select value={f.type} onChange={set('type')}>{CLINIC_TYPES.map((t) => <option key={t} value={t}>{CLINIC_TYPE_LABELS[t]}</option>)}</Select></Field>
            <div className="md:col-span-2"><Field label="Address"><Input value={f.addressLine} onChange={set('addressLine')} /></Field></div>
            <Field label="Area"><Select value={f.areaId} onChange={set('areaId')}>{areas.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.region.district}</option>)}</Select></Field>
            <Field label="PIN"><Input value={f.pin} maxLength={6} onChange={set('pin')} /></Field>
            <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
            <Field label="Opening hours"><Input value={f.openingHours} onChange={set('openingHours')} /></Field>
            <Field label="Drug licence no."><Input value={f.drugLicenceNo} onChange={set('drugLicenceNo')} /></Field>
            <div className="md:col-span-2"><Field label="About"><Textarea rows={4} value={f.about} onChange={set('about')} /></Field></div>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Online booking window">
            <Field label="Patients can book up to" hint="Overrides each doctor's own limit (BR-03). Empty = doctor's setting.">
              <Select value={String(f.bookingWindowHours)} onChange={set('bookingWindowHours')}>
                <option value="">Doctor&apos;s setting</option>
                <option value="24">24 hours ahead</option>
                <option value="72">3 days ahead</option>
                <option value="168">7 days ahead</option>
                <option value="360">15 days ahead</option>
              </Select>
            </Field>
            <div className="mt-3">
              <Field label="Close online booking (minutes before sitting ends)"><Input type="number" min={0} value={f.cutoffMinutes} onChange={set('cutoffMinutes')} placeholder="30" /></Field>
            </div>
          </Card>
          <div id="late" className="scroll-mt-24">
            <Card title="Late arrivals">
              <Field label="A patient who missed their turn and then arrives is seen" hint="Reception taps Arrived. Recall now still calls them straight away. Patients can also move to the doctor's next sitting from the app.">
                <Select value={f.lateRejoinAfter} onChange={set('lateRejoinAfter')}>
                  <option value="0">Right after the current patient</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={String(n)}>After {n} more patient{n > 1 ? 's' : ''}</option>
                  ))}
                </Select>
              </Field>
            </Card>
          </div>
          <Card title={`Photos · ${c.photos.length}/8`}>
            <div className="grid grid-cols-2 gap-2">
              {c.photos.map((p: string) => (
                <div key={p} className="group relative">
                  <img src={p} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  <button onClick={() => removePhoto.mutate(p)} className="absolute right-1 top-1 hidden rounded-full bg-white/90 px-2 text-xs text-red-600 group-hover:block">✕</button>
                </div>
              ))}
            </div>
            <label className="mt-3 block cursor-pointer rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-teal-600">
              {upload.isPending ? 'Uploading…' : '+ Add photo (JPG/PNG, under 5 MB)'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
            </label>
          </Card>
        </div>
      </div>
    </>
  );
}
