'use client';

import { useState } from 'react';
import { Button, Card, Field, Input, Modal, PageHeader, Select, StatusBadge, Table, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { dt, inr, rupeesToPaise } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

/** ADM-06 transactions & refunds. */
export default function TransactionsPage() {
  const [status, setStatus] = useState('');
  const [purpose, setPurpose] = useState('');
  const [q, setQ] = useState('');
  const params = new URLSearchParams({ ...(status ? { status } : {}), ...(purpose ? { purpose } : {}), ...(q ? { q } : {}) });
  const key = ['admin', 'payments', status, purpose, q];
  const { data } = useApi<any[]>(key, `/admin/payments?${params}`);
  const [refund, setRefund] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const doRefund = useAction(() => api(`/admin/payments/${refund.id}/refund`, { body: { amountPaise: rupeesToPaise(amount), reason } }), {
    invalidate: [['admin', 'payments']],
    success: 'Refund issued',
  });
  return (
    <>
      <PageHeader title="Transactions" subtitle="Online payments (Razorpay / mock), refunds and reconciliation." />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input placeholder="Order / payment id or phone" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[180px]">
            <option value="">All statuses</option>
            {['CREATED', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED'].map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replace('_', ' ')}
              </option>
            ))}
          </Select>
          <Select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="max-w-[180px]">
            <option value="">All purposes</option>
            <option value="BOOKING">Bookings</option>
            <option value="SUBSCRIPTION">Subscriptions</option>
          </Select>
        </div>
        <Table
          rows={data}
          empty="No online payments yet — in the pilot most visits are paid at the clinic."
          cols={[
            { h: 'When', c: (p: any) => dt(p.createdAt) },
            { h: 'Order', c: (p: any) => (<div className="font-mono text-xs">{p.gatewayOrderId}<div className="text-slate-400">{p.gateway}</div></div>) },
            { h: 'For', c: (p: any) => (p.booking ? `${p.booking.patientName} · token #${p.booking.tokenNo}` : p.purpose.toLowerCase()) },
            { h: 'Amount', c: (p: any) => inr(p.amountPaise) },
            { h: 'Refunded', c: (p: any) => (p.refundedPaise ? inr(p.refundedPaise) : '—') },
            { h: 'Status', c: (p: any) => <StatusBadge status={p.status} /> },
            {
              h: '',
              c: (p: any) =>
                ['PAID', 'PARTIALLY_REFUNDED'].includes(p.status) ? (
                  <Button tone="outline" onClick={() => { setRefund(p); setAmount(String((p.amountPaise - p.refundedPaise) / 100)); setReason(''); }}>
                    Refund
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>
      <Modal open={!!refund} onClose={() => setRefund(null)} title="Manual refund">
        {refund && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Up to {inr(refund.amountPaise - refund.refundedPaise)} can be refunded.
            </p>
            <Field label="Amount ₹">
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Reason (audit log)">
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="flex justify-end">
              <Button disabled={reason.length < 3 || !amount} loading={doRefund.isPending} onClick={() => doRefund.mutate(undefined, { onSuccess: () => setRefund(null) })}>
                Issue refund
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
