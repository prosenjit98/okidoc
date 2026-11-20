import { Injectable, Logger } from '@nestjs/common';
import { CancelActor, computeRefund, computeShares, formatINR } from '@okidoc/shared';
import type { Booking, Payment } from '@prisma/client';
import { bad, must } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentConfigService } from '../platform/platform.services';
import { RealtimeService } from '../realtime/realtime.gateway';
import { GatewayService } from './gateway';

type PaidHandler = (payment: Payment) => Promise<void>;

@Injectable()
export class PaymentsService {
  private readonly log = new Logger('Payments');
  private handlers = new Map<string, PaidHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: GatewayService,
    private readonly notifications: NotificationsService,
    private readonly paymentConfig: PaymentConfigService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Other modules (subscriptions) register what happens when their payment succeeds. */
  onPaid(purpose: string, handler: PaidHandler) {
    this.handlers.set(purpose, handler);
  }

  async createOrder(purpose: 'BOOKING' | 'SUBSCRIPTION', amountPaise: number, refs: { bookingId?: string; clinicId?: string }) {
    const order = await this.gateway.createOrder(amountPaise, refs.bookingId ?? refs.clinicId ?? purpose, {
      purpose,
      ...(refs.bookingId ? { bookingId: refs.bookingId } : {}),
      ...(refs.clinicId ? { clinicId: refs.clinicId } : {}),
    });
    const payment = await this.prisma.payment.create({
      data: {
        purpose,
        gateway: order.gateway,
        gatewayOrderId: order.orderId,
        amountPaise,
        status: 'CREATED',
        bookingId: refs.bookingId,
        clinicId: refs.clinicId,
      },
    });
    return { paymentId: payment.id, ...order, isMock: this.gateway.isMock };
  }

  /** Client-side confirmation after checkout (signature verified server-side). Idempotent. */
  async confirm(gatewayOrderId: string, gatewayPaymentId: string, signature: string) {
    const payment = must(await this.prisma.payment.findUnique({ where: { gatewayOrderId } }), 'Payment');
    if (payment.status === 'PAID') return { ok: true, payment };
    if (!this.gateway.verifyPaymentSignature(gatewayOrderId, gatewayPaymentId, signature)) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      throw bad('PAYMENT_SIGNATURE', 'Payment could not be verified');
    }
    return { ok: true, payment: await this.markPaid(payment, gatewayPaymentId) };
  }

  /** Dev only: simulate a successful (or failed) checkout for MOCK orders. */
  async simulate(gatewayOrderId: string, success: boolean) {
    if (!this.gateway.isMock) throw bad('NOT_MOCK', 'Simulation is only available with the mock gateway');
    if (!success) {
      await this.prisma.payment.update({ where: { gatewayOrderId }, data: { status: 'FAILED' } });
      return { ok: false };
    }
    const s = this.gateway.simulate(gatewayOrderId);
    return this.confirm(s.gatewayOrderId, s.gatewayPaymentId, s.signature);
  }

  async handleWebhook(raw: Buffer, signature: string) {
    if (!this.gateway.verifyWebhook(raw, signature)) throw bad('WEBHOOK_SIGNATURE', 'Invalid webhook signature');
    const evt = JSON.parse(raw.toString('utf8'));
    if (evt.event === 'payment.captured' || evt.event === 'order.paid') {
      const p = evt.payload?.payment?.entity;
      const payment = p?.order_id ? await this.prisma.payment.findUnique({ where: { gatewayOrderId: p.order_id } }) : null;
      if (payment && payment.status !== 'PAID') await this.markPaid(payment, p.id, evt);
    }
    if (evt.event === 'payment.failed') {
      const p = evt.payload?.payment?.entity;
      if (p?.order_id) await this.prisma.payment.updateMany({ where: { gatewayOrderId: p.order_id, status: 'CREATED' }, data: { status: 'FAILED' } });
    }
    if (evt.event === 'refund.processed') {
      const r = evt.payload?.refund?.entity;
      if (r?.id) await this.prisma.refund.updateMany({ where: { gatewayRefundId: r.id }, data: { status: 'PROCESSED' } });
    }
    return { ok: true };
  }

  private async markPaid(payment: Payment, gatewayPaymentId: string, raw?: unknown): Promise<Payment> {
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'PAID', gatewayPaymentId, paidAt: new Date(), raw: raw ? JSON.parse(JSON.stringify(raw)) : undefined },
    });
    if (payment.purpose === 'BOOKING' && payment.bookingId) await this.onBookingPaid(updated);
    const h = this.handlers.get(payment.purpose);
    if (h) await h(updated);
    return updated;
  }

  private async onBookingPaid(payment: Payment) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: payment.bookingId! },
      include: { instance: { include: { sitting: { include: { link: { include: { clinic: true, doctor: { include: { user: true } } } } } } } } },
    });
    const link = booking.instance.sitting.link;
    const wasPending = booking.status === 'PENDING_PAYMENT';
    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { paidOnline: { increment: payment.amountPaise }, status: wasPending ? 'BOOKED' : booking.status, holdExpiresAt: null },
    });
    await this.writePaymentLedger(booking, link.clinicId, link.doctorId, link.clinicSplitPercent, payment.amountPaise);
    if (booking.patientUserId) {
      const vars = {
        amount: formatINR(payment.amountPaise),
        token: booking.tokenNo,
        doctor: `Dr. ${link.doctor.user.name}`,
        clinic: link.clinic.name,
        date: booking.instance.date,
        time: booking.instance.startTime,
      };
      await this.notifications.notify(booking.patientUserId, 'PAYMENT_SUCCESS', { vars, data: { bookingId: booking.id } });
      if (wasPending) await this.notifications.notify(booking.patientUserId, 'BOOKING_CONFIRMED', { vars, data: { bookingId: booking.id } });
    }
    this.realtime.emitClinic(link.clinicId, 'bookings:changed', { instanceId: booking.instanceId });
  }

  /** PAY-08: record where the online money goes. Consultation part is split; booking fee & tax go to Okidoc. */
  private async writePaymentLedger(booking: Booking, clinicId: string, doctorId: string, clinicSplit: number, paid: number) {
    const ctx = await this.paymentConfig.resolve({ clinicId, regionId: null });
    const consult = booking.paymentMode === 'ONLINE_FULL' ? booking.consultationFee : 0;
    const shares = computeShares(consult, clinicSplit, ctx.fees);
    const entries = [
      { type: 'PAYMENT', party: 'PATIENT', amountPaise: paid },
      booking.bookingFee ? { type: 'BOOKING_FEE', party: 'OKIDOC', amountPaise: booking.bookingFee } : null,
      booking.tax ? { type: 'TAX', party: 'OKIDOC', amountPaise: booking.tax } : null,
      consult ? { type: 'CLINIC_SHARE', party: 'CLINIC', amountPaise: shares.clinicShare } : null,
      consult ? { type: 'DOCTOR_SHARE', party: 'DOCTOR', amountPaise: shares.doctorShare } : null,
      shares.commission ? { type: 'COMMISSION', party: 'OKIDOC', amountPaise: shares.commission } : null,
    ].filter(Boolean) as { type: string; party: string; amountPaise: number }[];
    await this.prisma.ledgerEntry.createMany({ data: entries.map((e) => ({ ...e, bookingId: booking.id, clinicId, doctorId })) });
  }

  /** PAY-09: front desk marks a visit as paid at the clinic. */
  async recordPaidAtClinic(bookingId: string, via: string) {
    const b = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { instance: { include: { sitting: { include: { link: true } } } } } });
    if (b.paidAtClinic) return;
    const link = b.instance.sitting.link;
    const ctx = await this.paymentConfig.resolve({ clinicId: link.clinicId, regionId: null });
    const fee = b.paymentMode === 'ONLINE_FULL' ? 0 : b.consultationFee;
    const shares = computeShares(fee, link.clinicSplitPercent, ctx.fees);
    await this.prisma.$transaction([
      this.prisma.booking.update({ where: { id: bookingId }, data: { paidAtClinic: true, paidVia: via } }),
      this.prisma.ledgerEntry.createMany({
        data: [
          { type: 'PAID_AT_CLINIC', party: 'PATIENT', amountPaise: fee, bookingId, clinicId: link.clinicId, doctorId: link.doctorId, note: via },
          { type: 'CLINIC_SHARE', party: 'CLINIC', amountPaise: shares.clinicShare, bookingId, clinicId: link.clinicId, doctorId: link.doctorId },
          { type: 'DOCTOR_SHARE', party: 'DOCTOR', amountPaise: shares.doctorShare, bookingId, clinicId: link.clinicId, doctorId: link.doctorId },
          ...(shares.commission
            ? [{ type: 'COMMISSION', party: 'OKIDOC', amountPaise: shares.commission, bookingId, clinicId: link.clinicId, doctorId: link.doctorId }]
            : []),
        ],
      }),
    ]);
  }

  /** BR-12 automatic refund on cancellation. Returns refunded amount. */
  async refundForCancellation(bookingId: string, actor: CancelActor | 'NO_SHOW', minutesBeforeSitting: number, clinicId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { payments: true } });
    const paid = booking.payments.find((p) => p.status === 'PAID' && p.purpose === 'BOOKING');
    if (!paid) return 0;
    const ctx = await this.paymentConfig.resolve({ clinicId, regionId: null });
    const { amount, reason } = computeRefund({
      actor,
      minutesBeforeSitting,
      paidPaise: paid.amountPaise - paid.refundedPaise,
      bookingFeePaise: booking.bookingFee,
      taxPaise: booking.tax,
      patientFullRefundMinutes: ctx.refundMinutes,
    });
    if (amount <= 0) return 0;
    await this.refund(paid, amount, reason, null);
    return amount;
  }

  async refund(payment: Payment, amountPaise: number, reason: string, actorId: string | null) {
    const remaining = payment.amountPaise - payment.refundedPaise;
    if (amountPaise > remaining) throw bad('REFUND_TOO_LARGE', `At most ${formatINR(remaining)} can be refunded`);
    let gatewayRefundId: string | undefined;
    let status = 'PROCESSED';
    try {
      gatewayRefundId = (await this.gateway.refund(payment.gatewayPaymentId ?? '', amountPaise, { reason: reason.slice(0, 200) })).refundId;
      if (!this.gateway.isMock) status = 'PENDING';
    } catch (e) {
      this.log.error(`Refund failed for ${payment.id}: ${String(e)}`);
      status = 'FAILED';
    }
    const refundedTotal = payment.refundedPaise + (status === 'FAILED' ? 0 : amountPaise);
    await this.prisma.$transaction([
      this.prisma.refund.create({ data: { paymentId: payment.id, amountPaise, reason, status, gatewayRefundId, createdById: actorId } }),
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { refundedPaise: refundedTotal, status: refundedTotal >= payment.amountPaise ? 'REFUNDED' : refundedTotal > 0 ? 'PARTIALLY_REFUNDED' : payment.status },
      }),
      ...(status === 'FAILED'
        ? []
        : [this.prisma.ledgerEntry.create({ data: { type: 'REFUND', party: 'PATIENT', amountPaise: -amountPaise, bookingId: payment.bookingId, clinicId: payment.clinicId, note: reason } })]),
    ]);
    if (status !== 'FAILED' && payment.bookingId) {
      const b = await this.prisma.booking.findUnique({ where: { id: payment.bookingId } });
      if (b?.patientUserId) await this.notifications.notify(b.patientUserId, 'REFUND_ISSUED', { vars: { amount: formatINR(amountPaise) }, data: { bookingId: b.id } });
    }
    return { status, amountPaise };
  }
}
