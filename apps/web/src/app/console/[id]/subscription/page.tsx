'use client';

import { FEATURE_KEYS, FEATURE_LABELS } from '@okidoc/shared';
import { use, useState } from 'react';
import { Badge, Button, Card, ErrorBox, Modal, PageHeader, Spinner, StatusBadge, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { dt, inr } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

/** CLN-28 / MON-04 plan & features. While subscriptions are off it only shows that everything is free. */
export default function SubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const key = ['clinic', id, 'subscription'];
  const { data, error } = useApi<any>(key, `/clinic/${id}/subscription`);
  const [checkout, setCheckout] = useState<any | null>(null);
  const subscribe = useAction((planId: string) => api(`/clinic/${id}/subscription`, { body: { planId } }), {
    invalidate: [key, ['clinic', id]],
    success: (r: any) => (r.status === 'PAYMENT_DUE' ? 'Invoice created — complete payment' : r.status === 'TRIAL' ? 'Trial started' : 'Plan changed'),
  });
  const pay = useAction((invoiceId: string) => api(`/clinic/${id}/subscription/invoices/${invoiceId}/pay`, { method: 'POST' }), {});
  const mockPay = useAction((orderId: string) => api('/payments/mock/complete', { body: { gatewayOrderId: orderId, success: true } }), { invalidate: [key, ['clinic', id]], success: 'Payment received' });
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Spinner />;
  return (
    <>
      <PageHeader title="Plan & features" />
      {!data.enabled && (
        <div className="mb-4 rounded-[16px] bg-teal-50 p-5 text-navy-900">
          <p className="text-lg font-bold">Free</p>
          <p className="text-sm">Every feature is included for your clinic.</p>
        </div>
      )}
      <Card title="Your plan" className="mb-4">
        <p className="text-sm">
          Current plan: <Badge tone="info">{data.currentPlanCode ?? 'FREE'}</Badge> {data.subscription && <StatusBadge status={data.subscription.status} />}
          {data.subscription?.currentPeriodEnd && <span className="text-slate-500"> · renews {dt(data.subscription.currentPeriodEnd)}</span>}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Using {data.usage.doctors}/{data.entitlements.limits.MAX_DOCTORS ?? '∞'} doctors · {data.usage.sittings}/{data.entitlements.limits.MAX_SITTINGS ?? '∞'} sittings · {data.usage.queueManagers}/{data.entitlements.limits.MAX_QUEUE_MANAGERS ?? '∞'} Queue Managers
        </p>
      </Card>
      {data.enabled && (
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        {data.plans.map((p: any) => (
          <Card key={p.id} title={p.name} actions={data.currentPlanCode === p.code ? <Badge tone="ok">current</Badge> : null}>
            <p className="text-2xl font-bold">{p.priceMonthlyPaise ? `${inr(p.priceMonthlyPaise)}/mo` : 'Free'}</p>
            {p.trialDays > 0 && <p className="text-xs text-slate-500">{p.trialDays}-day free trial</p>}
            <ul className="mt-3 space-y-1 text-sm">
              {FEATURE_KEYS.filter((k) => p.features?.[k]).map((k) => <li key={k}>✓ {FEATURE_LABELS[k]}</li>)}
            </ul>
            <Button className="mt-4 w-full" disabled={!data.enabled || data.currentPlanCode === p.code} onClick={() => subscribe.mutate(p.id, { onSuccess: (r: any) => r.payment && setCheckout(r.payment) })}>
              Choose plan
            </Button>
          </Card>
        ))}
      </div>
      )}
      {(data.enabled || data.invoices.length > 0) && (
      <Card title="Invoices">
        <Table
          rows={data.invoices}
          empty="No invoices."
          cols={[
            { h: 'Number', c: (i: any) => i.number },
            { h: 'Issued', c: (i: any) => dt(i.issuedAt) },
            { h: 'Amount (incl. GST)', c: (i: any) => inr(i.amountPaise) },
            { h: 'Status', c: (i: any) => <StatusBadge status={i.status} /> },
            { h: '', c: (i: any) => (i.status === 'DUE' ? <Button onClick={() => pay.mutate(i.id, { onSuccess: (r: any) => setCheckout(r) })}>Pay</Button> : null) },
          ]}
        />
      </Card>
      )}
      <Modal open={!!checkout} onClose={() => setCheckout(null)} title="Complete payment">
        {checkout && (
          <>
            <p className="text-sm">Amount: <b>{inr(checkout.amountPaise)}</b></p>
            {checkout.isMock ? (
              <Button className="mt-4 w-full" onClick={() => mockPay.mutate(checkout.orderId, { onSuccess: () => setCheckout(null) })}>Simulate successful payment (development)</Button>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Razorpay checkout opens here in production (order {checkout.orderId}).</p>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
