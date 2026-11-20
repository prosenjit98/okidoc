import { Injectable } from '@nestjs/common';
import { bad } from '../../common/http';
import { config } from '../../config';
import { hmacHex, randomToken, safeEqual } from '../auth/crypto';

export interface GatewayOrder {
  gateway: 'MOCK' | 'RAZORPAY';
  orderId: string;
  amountPaise: number;
  currency: 'INR';
  keyId?: string;
}

export interface PaymentGateway {
  createOrder(amountPaise: number, receipt: string, notes: Record<string, string>): Promise<GatewayOrder>;
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean;
  refund(paymentId: string, amountPaise: number, notes: Record<string, string>): Promise<{ refundId: string }>;
  verifyWebhook(rawBody: Buffer, signature: string): boolean;
}

const MOCK_SECRET = 'okidoc-mock-gateway';

/** Simulated gateway for development: orders are local; signatures use a fixed HMAC secret. */
class MockGateway implements PaymentGateway {
  async createOrder(amountPaise: number): Promise<GatewayOrder> {
    return { gateway: 'MOCK', orderId: `mock_order_${randomToken(10)}`, amountPaise, currency: 'INR' };
  }
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
    return safeEqual(hmacHex(MOCK_SECRET, `${orderId}|${paymentId}`), signature);
  }
  async refund() {
    return { refundId: `mock_rfnd_${randomToken(10)}` };
  }
  verifyWebhook() {
    return false;
  }
  /** Dev helper: what the checkout widget would return on success. */
  static simulate(orderId: string) {
    const paymentId = `mock_pay_${randomToken(10)}`;
    return { gatewayOrderId: orderId, gatewayPaymentId: paymentId, signature: hmacHex(MOCK_SECRET, `${orderId}|${paymentId}`) };
  }
}

/** Razorpay Orders / Payments / Refunds REST API. */
class RazorpayGateway implements PaymentGateway {
  private get auth() {
    return 'Basic ' + Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
  }
  private async call<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: 'POST',
      headers: { authorization: this.auth, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as any;
    if (!res.ok) throw bad('GATEWAY_ERROR', json?.error?.description ?? 'Payment gateway error');
    return json as T;
  }
  async createOrder(amountPaise: number, receipt: string, notes: Record<string, string>): Promise<GatewayOrder> {
    const o = await this.call<{ id: string }>('/orders', { amount: amountPaise, currency: 'INR', receipt: receipt.slice(0, 40), notes });
    return { gateway: 'RAZORPAY', orderId: o.id, amountPaise, currency: 'INR', keyId: config.razorpay.keyId };
  }
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
    return safeEqual(hmacHex(config.razorpay.keySecret, `${orderId}|${paymentId}`), signature);
  }
  async refund(paymentId: string, amountPaise: number, notes: Record<string, string>) {
    const r = await this.call<{ id: string }>(`/payments/${paymentId}/refund`, { amount: amountPaise, notes });
    return { refundId: r.id };
  }
  verifyWebhook(rawBody: Buffer, signature: string) {
    if (!config.razorpay.webhookSecret) return false;
    return safeEqual(hmacHex(config.razorpay.webhookSecret, rawBody), signature);
  }
}

@Injectable()
export class GatewayService implements PaymentGateway {
  readonly impl: PaymentGateway = config.paymentGateway === 'razorpay' ? new RazorpayGateway() : new MockGateway();
  readonly isMock = config.paymentGateway !== 'razorpay';
  createOrder(a: number, r: string, n: Record<string, string>) {
    return this.impl.createOrder(a, r, n);
  }
  verifyPaymentSignature(o: string, p: string, s: string) {
    return this.impl.verifyPaymentSignature(o, p, s);
  }
  refund(p: string, a: number, n: Record<string, string>) {
    return this.impl.refund(p, a, n);
  }
  verifyWebhook(b: Buffer, s: string) {
    return this.impl.verifyWebhook(b, s);
  }
  simulate(orderId: string) {
    return MockGateway.simulate(orderId);
  }
}
