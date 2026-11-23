'use client';

import { useState } from 'react';
import { Button, Card, Field, Input, PageHeader, Table, Tabs, Toggle } from '@/components/ui';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';
import { Areas } from './areas';

/** ADM-10 specialties (with patient-friendly / Bengali / Hindi names and symptom keywords) and areas. */
export default function TaxonomyPage() {
  const [tab, setTab] = useState('specialties');
  return (
    <>
      <PageHeader title="Specialties & areas" subtitle="Keywords power symptom search and the Assistant's offline matcher." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'specialties', label: 'Specialties' }, { id: 'areas', label: 'Areas & PIN codes' }]} />
      {tab === 'specialties' ? <Specialties /> : <Areas />}
    </>
  );
}

function Specialties() {
  const { data } = useApi<any[]>(['specialties'], '/specialties');
  const [f, setF] = useState({ name: '', patientName: '', nameBn: '', nameHi: '', keywords: '' });
  const add = useAction(() => api('/admin/specialties', { body: { ...f, keywords: f.keywords.split(',').map((k) => k.trim()).filter(Boolean) } }), { invalidate: [['specialties']], success: 'Specialty added' });
  const edit = useAction((v: { id: string; body: any }) => api(`/admin/specialties/${v.id}`, { method: 'PATCH', body: v.body }), { invalidate: [['specialties']] });
  return (
    <Card>
      <div className="mb-4 grid gap-3 md:grid-cols-6">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Patient-friendly"><Input value={f.patientName} onChange={(e) => setF({ ...f, patientName: e.target.value })} /></Field>
        <Field label="বাংলা"><Input value={f.nameBn} onChange={(e) => setF({ ...f, nameBn: e.target.value })} /></Field>
        <Field label="हिन्दी"><Input value={f.nameHi} onChange={(e) => setF({ ...f, nameHi: e.target.value })} /></Field>
        <Field label="Keywords (comma separated)"><Input value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} /></Field>
        <div className="flex items-end"><Button disabled={!f.name} onClick={() => add.mutate(undefined)}>Add</Button></div>
      </div>
      <Table
        rows={data}
        cols={[
          { h: 'Name', c: (s: any) => (<div><div className="font-semibold">{s.name}</div><div className="text-xs text-slate-500">{s.patientName}</div></div>) },
          { h: 'বাংলা / हिन्दी', c: (s: any) => `${s.nameBn ?? '—'} / ${s.nameHi ?? '—'}` },
          {
            h: 'Keywords',
            c: (s: any) => (
              <Input
                defaultValue={s.keywords.join(', ')}
                onBlur={(e) => {
                  const keywords = e.target.value.split(',').map((k) => k.trim()).filter(Boolean);
                  if (keywords.join(',') !== s.keywords.join(',')) edit.mutate({ id: s.id, body: { keywords } });
                }}
              />
            ),
            className: 'w-1/2',
          },
          { h: 'Active', c: (s: any) => <Toggle checked={s.active} onChange={(active) => edit.mutate({ id: s.id, body: { active } })} /> },
        ]}
      />
    </Card>
  );
}
