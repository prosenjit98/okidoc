'use client';

import { use, useState } from 'react';
import { Button, Card, Field, Input, PageHeader, Select, StatusBadge, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

/** CLN-21 Contact & support. */
export default function SupportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: contact } = useApi<any>(['support', 'contact'], '/support/contact');
  const { data: tickets } = useApi<any[]>(['support', 'tickets'], '/support/tickets');
  const [f, setF] = useState({ subject: '', body: '', category: 'CLINIC' });
  const create = useAction(() => api('/support/tickets', { body: { ...f, clinicId: id } }), { invalidate: [['support', 'tickets']], success: 'Request sent — Okidoc will reply here' });
  return (
    <>
      <PageHeader title="Contact & support" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Reach Okidoc">
          {contact && (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-slate-500">Email</dt><dd><a className="text-teal-600" href={`mailto:${contact.email}`}>{contact.email}</a></dd></div>
              <div><dt className="text-slate-500">Phone</dt><dd><a className="text-teal-600" href={`tel:${contact.phone}`}>{contact.phone}</a></dd></div>
              <div><dt className="text-slate-500">Hours</dt><dd>{contact.hours}</dd></div>
              <div><dt className="text-slate-500">Grievance officer</dt><dd>{contact.grievanceOfficer.name} · {contact.grievanceOfficer.email}</dd></div>
            </dl>
          )}
        </Card>
        <Card title="New request" className="lg:col-span-2">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Topic">
              <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                <option value="CLINIC">This clinic</option>
                <option value="BOOKING">Bookings</option>
                <option value="PAYMENT">Payments</option>
                <option value="ACCOUNT">My account</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field>
            <div className="md:col-span-2"><Field label="Subject"><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field></div>
          </div>
          <Field label="Message"><Textarea rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          <Button className="mt-3" disabled={f.subject.length < 3 || f.body.length < 3} loading={create.isPending} onClick={() => create.mutate(undefined, { onSuccess: () => setF({ ...f, subject: '', body: '' }) })}>Send</Button>
        </Card>
      </div>
      <Card title="Your requests" className="mt-4">
        {tickets?.length ? tickets.map((t) => (
          <details key={t.id} className="border-b py-3 last:border-0">
            <summary className="flex cursor-pointer items-center justify-between">
              <span className="font-semibold">{t.subject}</span>
              <span className="flex items-center gap-2 text-xs text-slate-500">{dt(t.updatedAt)} <StatusBadge status={t.status} /></span>
            </summary>
            <div className="mt-2 space-y-2">
              {t.messages.map((m: any) => (
                <p key={m.id} className={`rounded-xl p-3 text-sm ${m.fromStaff ? 'bg-teal-50' : 'bg-slate-100'}`}>{m.body}</p>
              ))}
            </div>
          </details>
        )) : <p className="text-sm text-slate-500">No requests yet.</p>}
      </Card>
    </>
  );
}
