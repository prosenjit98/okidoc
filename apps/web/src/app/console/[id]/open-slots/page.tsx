'use client';

import { use, useState } from 'react';
import { Button, Card, cx, ErrorBox, Field, Input, PageHeader, Table, WEEKDAYS_FIELD } from './parts';
import { api } from '@/lib/api';
import { days, rupeesToPaise, t12 } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

/** CLN-25 Open slots (post an empty chair) ↔ DOC-12 doctors' free hours. */
export default function OpenSlotsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const key = ['clinic', id, 'open-slots'];
  const { data, error } = useApi<any[]>(key, `/clinic/${id}/open-slots`);
  const { data: free } = useApi<any[]>(['clinic', id, 'free-hours'], `/clinic/${id}/free-hours`);
  const [f, setF] = useState({ weekdays: [1, 3, 5] as number[], startTime: '17:00', endTime: '20:00', note: '' });
  const add = useAction(() => api(`/clinic/${id}/open-slots`, { body: f }), { invalidate: [key], success: 'Open slot posted' });
  const remove = useAction((sid: string) => api(`/clinic/${id}/open-slots/${sid}`, { method: 'DELETE' }), { invalidate: [key] });
  const request = useAction((doctorId: string) => api(`/clinic/${id}/doctors`, { body: { doctorId, consultationFee: rupeesToPaise('300'), clinicSplitPercent: 20 } }), { success: 'Request sent to the doctor' });
  if (error) return <ErrorBox error={error} />;
  return (
    <>
      <PageHeader title="Open slots" subtitle="Post an empty chair. Doctors nearby see it, and you can see doctors who posted free hours." />
      <Card title="Post an empty chair" className="mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <WEEKDAYS_FIELD value={f.weekdays} onChange={(weekdays) => setF({ ...f, weekdays })} />
          <Field label="From"><Input type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></Field>
          <Field label="To"><Input type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} /></Field>
          <Field label="Note"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Looking for a dentist" /></Field>
        </div>
        <Button className="mt-3" disabled={!f.weekdays.length} onClick={() => add.mutate(undefined)}>Post</Button>
        <Table
          rows={data}
          empty="No open slots posted."
          cols={[
            { h: 'Days', c: (s: any) => days(s.weekdays) },
            { h: 'Time', c: (s: any) => `${t12(s.startTime)} – ${t12(s.endTime)}` },
            { h: 'Note', c: (s: any) => s.note ?? '' },
            { h: '', c: (s: any) => <Button tone="ghost" className="text-red-600" onClick={() => remove.mutate(s.id)}>Remove</Button> },
          ]}
        />
      </Card>
      <Card title="Doctors with free hours near you">
        <Table
          rows={free}
          empty="No doctors have posted free hours in your district yet."
          cols={[
            { h: 'Doctor', c: (r: any) => (<div><div className="font-semibold">Dr. {r.doctor.name}</div><div className="text-xs text-slate-500">{r.doctor.specialties.join(', ')} · {r.doctor.degrees}</div></div>) },
            { h: 'Free', c: (r: any) => `${days(r.weekdays)} · ${t12(r.startTime)} – ${t12(r.endTime)}` },
            { h: 'Note', c: (r: any) => r.note ?? '' },
            { h: '', c: (r: any) => <Button className={cx('')} onClick={() => request.mutate(r.doctor.id)}>Invite to sit</Button> },
          ]}
        />
      </Card>
    </>
  );
}
