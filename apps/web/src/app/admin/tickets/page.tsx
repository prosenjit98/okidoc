'use client';

import { useState } from 'react';
import { Badge, Button, Card, PageHeader, Select, StatusBadge, Table, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

/** ADM-12 support inbox (including block appeals). */
export default function TicketsPage() {
  const [status, setStatus] = useState('');
  const key = ['admin', 'tickets', status];
  const { data } = useApi<any[]>(key, `/admin/tickets${status ? `?status=${status}` : ''}`);
  const [sel, setSel] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const ticket = data?.find((t) => t.id === sel);
  const send = useAction(() => api(`/admin/tickets/${sel}/reply`, { body: { body: reply } }), { invalidate: [['admin', 'tickets']], success: 'Reply sent' });
  const update = useAction((s: string) => api(`/admin/tickets/${sel}`, { method: 'PATCH', body: { status: s } }), { invalidate: [['admin', 'tickets']] });
  return (
    <>
      <PageHeader title="Support tickets" />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="mb-3">
            <option value="">Open & pending</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </Select>
          <Table
            rows={data}
            onRow={(t: any) => setSel(t.id)}
            empty="Inbox zero."
            cols={[
              { h: 'Subject', c: (t: any) => (<div><div className="font-semibold">{t.subject}</div><div className="text-xs text-slate-500">{t.user.name} · {dt(t.updatedAt)}</div></div>) },
              { h: '', c: (t: any) => (<div className="flex flex-col items-end gap-1"><StatusBadge status={t.status} />{t.category === 'BLOCK_APPEAL' && <Badge tone="warn">appeal</Badge>}</div>) },
            ]}
          />
        </Card>
        <Card className="lg:col-span-3" title={ticket?.subject ?? 'Select a ticket'} actions={ticket && (
          <Select value={ticket.status} onChange={(e) => update.mutate(e.target.value)} className="!w-40">
            {['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
          </Select>
        )}>
          {ticket ? (
            <>
              <p className="mb-3 text-xs text-slate-500">
                {ticket.user.name} · {ticket.user.phone} · {ticket.category.toLowerCase().replace('_', ' ')}
              </p>
              <div className="space-y-2">
                {ticket.messages.map((m: any) => (
                  <div key={m.id} className={`rounded-xl p-3 text-sm ${m.fromStaff ? 'ml-10 bg-teal-50' : 'mr-10 bg-slate-100'}`}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-1 text-xs text-slate-400">{m.fromStaff ? 'Okidoc' : ticket.user.name} · {dt(m.createdAt)}</p>
                  </div>
                ))}
              </div>
              <Textarea rows={3} className="mt-4" placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <Button className="mt-2" disabled={!reply} loading={send.isPending} onClick={() => send.mutate(undefined, { onSuccess: () => setReply('') })}>Send reply</Button>
            </>
          ) : (
            <p className="text-sm text-slate-500">Block appeals: lift the block from No-show blocks, then reply here.</p>
          )}
        </Card>
      </div>
    </>
  );
}
