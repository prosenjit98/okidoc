'use client';

import { use, useState } from 'react';
import { Button, Card, Confirm, ErrorBox, Field, Input, PageHeader, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

/** CLN-16 Queue Manager accounts (restricted: queue, walk-ins, register). */
export default function StaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const key = ['clinic', id, 'staff'];
  const { data, error } = useApi<any[]>(key, `/clinic/${id}/staff`);
  const [f, setF] = useState({ name: '', phone: '', password: '' });
  const add = useAction(() => api(`/clinic/${id}/staff`, { body: f }), { invalidate: [key], success: 'Queue Manager added — they can log in with this phone and password' });
  const remove = useAction((aid: string) => api(`/clinic/${id}/staff/${aid}`, { method: 'DELETE' }), { invalidate: [key], success: 'Access removed' });
  return (
    <>
      <PageHeader title="Queue Manager accounts" subtitle="Front-desk logins that can run the queue and add walk-ins, but cannot see earnings, fees or settings." />
      <Card title="Add a Queue Manager" className="mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Mobile number"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Temporary password" hint="8+ characters, letters and numbers"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <div className="flex items-end"><Button disabled={!f.name || !f.phone || f.password.length < 8} loading={add.isPending} onClick={() => add.mutate(undefined, { onSuccess: () => setF({ name: '', phone: '', password: '' }) })}>Add</Button></div>
        </div>
      </Card>
      <Card>
        {error ? <ErrorBox error={error} /> : (
          <Table
            rows={data}
            empty="No Queue Managers yet."
            cols={[
              { h: 'Name', c: (s: any) => s.name },
              { h: 'Phone', c: (s: any) => s.phone },
              { h: 'Since', c: (s: any) => dt(s.since) },
              { h: '', c: (s: any) => <Confirm label="Remove access" onConfirm={() => remove.mutate(s.assignmentId)} /> },
            ]}
          />
        )}
      </Card>
    </>
  );
}
