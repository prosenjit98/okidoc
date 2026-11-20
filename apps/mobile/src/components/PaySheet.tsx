import { useEffect, useRef, useState } from 'react';
import RazorpayCheckout from 'react-native-razorpay';
import { api, errMessage } from '@/lib/api';
import { inr } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { Button, Card, Sheet, T } from './ui';

export interface GatewayPayment {
  paymentId: string;
  gateway: 'MOCK' | 'RAZORPAY';
  orderId: string;
  amountPaise: number;
  keyId?: string;
  isMock: boolean;
}

/**
 * PAY-05 checkout. Development (mock gateway): simulate success/failure. Production: Razorpay native checkout
 * (react-native-razorpay); the returned signature is verified server-side via POST /payments/confirm.
 */
export function PaySheet({ payment, onDone, prefill }: { payment: GatewayPayment | null; onDone: (ok: boolean, message?: string) => void; prefill?: { name?: string; contact?: string } }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const started = useRef<string | null>(null);

  // Real gateway: open the native Razorpay sheet once per order.
  useEffect(() => {
    if (!payment || payment.isMock || payment.gateway === 'MOCK' || started.current === payment.orderId) return;
    started.current = payment.orderId;
    RazorpayCheckout.open({
      key: payment.keyId ?? '',
      order_id: payment.orderId,
      amount: payment.amountPaise,
      currency: 'INR',
      name: 'Okidoc',
      description: 'Clinic booking',
      prefill: { name: prefill?.name ?? '', contact: prefill?.contact ?? '' },
      theme: { color: '#14B8A6' },
    })
      .then((r) => api('/payments/confirm', { body: { gatewayOrderId: r.razorpay_order_id, gatewayPaymentId: r.razorpay_payment_id, signature: r.razorpay_signature } }))
      .then(() => onDone(true))
      .catch((e: { code?: number; description?: string; message?: string }) => onDone(false, e?.code === 0 || e?.code === 2 ? 'Payment cancelled' : e?.description ?? e?.message ?? 'Payment failed'));
  }, [payment, prefill, onDone]);

  if (!payment) return null;

  if (payment.isMock || payment.gateway === 'MOCK') {
    const run = async (success: boolean) => {
      setBusy(true);
      try {
        const r = await api<{ ok: boolean }>('/payments/mock/complete', { body: { gatewayOrderId: payment.orderId, success } });
        onDone(!!r.ok, r.ok ? undefined : 'Payment failed');
      } catch (e) {
        onDone(false, errMessage(e));
      } finally {
        setBusy(false);
      }
    };
    return (
      <Sheet visible onClose={() => onDone(false, 'Payment cancelled')} title={t('book.mockPay')}>
        <Card>
          <T variant="muted">Mock gateway — no real money moves.</T>
          <T variant="h1" style={{ marginTop: 6 }}>
            {inr(payment.amountPaise)}
          </T>
        </Card>
        <Button title={t('book.paySuccess')} loading={busy} onPress={() => run(true)} />
        <Button title={t('book.payFail')} tone="outline" disabled={busy} onPress={() => run(false)} style={{ marginTop: 10 }} />
      </Sheet>
    );
  }

  return null; // native Razorpay sheet is presented by the effect above
}
