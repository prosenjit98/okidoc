'use client';

import { useState } from 'react';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, StatusBadge, Table, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { inr, rupeesToPaise, todayIST } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

const METRIC: Record<string, string> = { PATIENTS_SERVED: 'Patients served', DOCTORS_ADDED: 'Doctors added', ONLINE_BOOKINGS: 'Online bookings' };

/** ADM-09 Bonuses & Prizes campaigns. */
export default function BonusesPage() {
  const { data } = useApi<any[]>(['admin', 'bonuses'], '/admin/bonuses');
  const [sel, setSel] = useState<string | null>(null);
  const { data: progress } = useApi<any>(['admin', 'bonus', sel], sel ? `/admin/bonuses/${sel}/progress` : null);
  const [form, setForm] = useState<any | null>(null);
  const save = useAction(
    (f: any) =>
      api('/admin/bonuses', {
        body: { name: f.name, description: f.description, metric: f.metric, target: Number(f.target), rewardPaise: rupeesToPaise(f.reward), startsAt: f.startsAt, endsAt: f.endsAt, clinicIds: [], active: true },
      }),
    { invalidate: [['admin', 'bonuses']], success: 'Campaign created' },
  );
  const payout = useAction((v: { clinicId: string; status: string }) => api(`/admin/bonuses/${sel}/payouts`, { body: v }), { invalidate: [['admin', 'bonus', sel]], success: 'Payout updated' });
  return (
    <>
      <PageHeader
        title="Bonuses & prizes"
        subtitle="Incentive campaigns for clinics. Rewards are payable only after you verify and approve."
        actions={<Button onClick={() => setForm({ name: '', description: '', metric: 'PATIENTS_SERVED', target: '100', reward: '1000', startsAt: todayIST(), endsAt: todayIST() })}>New campaign</Button>}
      />
      <Card>
        <Table
          rows={data}
          onRow={(c: any) => setSel(c.id)}
          cols={[
            { h: 'Campaign', c: (c: any) => (<div><div className="font-semibold">{c.name}</div><div className="text-xs text-slate-500">{c.description}</div></div>) },
            { h: 'Target', c: (c: any) => `${c.target} ${METRIC[c.metric].toLowerCase()}` },
            { h: 'Reward', c: (c: any) => inr(c.rewardPaise) },
            { h: 'Dates', c: (c: any) => `${c.startsAt} → ${c.endsAt}` },
            { h: 'Clinics', c: (c: any) => (c.clinicIds.length ? c.clinicIds.length : 'All') },
            { h: '', c: (c: any) => <Badge tone={c.active ? 'ok' : 'muted'}>{c.active ? 'active' : 'ended'}</Badge> },
          ]}
        />
      </Card>
      {progress && (
        <Card title={`Progress — ${progress.campaign.name}`} className="mt-4">
          <Table
            rows={progress.rows}
            cols={[
              { h: 'Clinic', c: (r: any) => `${r.clinic.name} (${r.clinic.code})` },
              { h: 'Achieved', c: (r: any) => `${r.achieved} / ${r.target}` },
              { h: 'Payable', c: (r: any) => inr(r.payablePaise) },
              { h: 'Payout', c: (r: any) => (r.payout ? <StatusBadge status={r.payout.status} /> : '—') },
              {
                h: '',
                c: (r: any) =>
                  r.completed ? (
                    <div className="flex gap-2">
                      {r.payout?.status !== 'APPROVED' && r.payout?.status !== 'PAID' && <Button tone="outline" onClick={() => payout.mutate({ clinicId: r.clinic.id, status: 'APPROVED' })}>Approve</Button>}
                      {r.payout?.status === 'APPROVED' && <Button onClick={() => payout.mutate({ clinicId: r.clinic.id, status: 'PAID' })}>Mark paid</Button>}
                    </div>
                  ) : null,
              },
            ]}
          />
        </Card>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title="New bonus campaign">
        {form && (
          <div className="space-y-3">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Metric">
                <Select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
                  {Object.entries(METRIC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="Target"><Input type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></Field>
              <Field label="Reward ₹"><Input type="number" value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} /></Field>
              <div />
              <Field label="Starts"><Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></Field>
              <Field label="Ends"><Input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end">
              <Button disabled={!form.name} loading={save.isPending} onClick={() => save.mutate(form, { onSuccess: () => setForm(null) })}>Create</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
