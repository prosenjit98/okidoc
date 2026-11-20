import { Body, Controller, Get, Injectable, Module, OnModuleInit, Param, Post } from '@nestjs/common';
import { subscribeSchema } from '@okidoc/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/auth';
import { AppError, bad, must, Zod } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/settings.service';
import { ClinicAccessService } from '../clinic/clinic-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { EntitlementsService, RevenueService } from '../platform/platform.services';

const GRACE_DAYS = 7;
const addMonths = (d: Date, n: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};

/** MON-04 clinic subscriptions. Billing runs only when the CLINIC_SUBSCRIPTION revenue stream is on. */
@Injectable()
export class SubscriptionsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly revenue: RevenueService,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.payments.onPaid('SUBSCRIPTION', async (p) => {
      const invoiceId = (p.raw as { invoiceId?: string } | null)?.invoiceId;
      const inv = invoiceId ? await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { subscription: true } }) : null;
      if (!inv || inv.status === 'PAID') return;
      await this.prisma.invoice.update({ where: { id: inv.id }, data: { status: 'PAID', paidAt: new Date() } });
      if (inv.subscription) await this.activate(inv.subscription.id);
    });
  }

  private async nextInvoiceNumber() {
    const n = await this.prisma.invoice.count();
    return `OKD-${new Date().getFullYear()}-${String(n + 1).padStart(6, '0')}`;
  }

  async status(clinicId: string) {
    const clinic = await this.prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, include: { area: true } });
    const enabled = await this.revenue.enabled('CLINIC_SUBSCRIPTION', { clinicId, regionId: clinic.area.regionId });
    const [plans, current, invoices, ent] = await Promise.all([
      this.prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.clinicSubscription.findFirst({ where: { clinicId, status: { in: ['TRIAL', 'ACTIVE', 'GRACE'] } }, include: { plan: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.invoice.findMany({ where: { clinicId }, orderBy: { issuedAt: 'desc' }, take: 24 }),
      this.entitlements.forClinic(clinicId),
    ]);
    const usage = {
      doctors: await this.prisma.clinicDoctorLink.count({ where: { clinicId, status: 'APPROVED' } }),
      sittings: await this.prisma.sitting.count({ where: { active: true, link: { clinicId } } }),
      queueManagers: await this.prisma.roleAssignment.count({ where: { clinicId, role: 'QUEUE_MANAGER' } }),
    };
    return {
      enabled,
      message: enabled ? null : 'Free — every feature is included for your clinic.',
      currentPlanCode: ent.planCode,
      entitlements: ent,
      usage,
      plans,
      subscription: current,
      invoices,
    };
  }

  async subscribe(clinicId: string, planId: string, actorId: string) {
    const st = await this.status(clinicId);
    if (!st.enabled) throw new AppError(403, 'SUBSCRIPTIONS_OFF', 'Okidoc is free for your clinic — there is no plan to choose.');
    const plan = must(await this.prisma.plan.findFirst({ where: { id: planId, active: true } }), 'Plan');
    // Close any current subscription when switching.
    await this.prisma.clinicSubscription.updateMany({ where: { clinicId, status: { in: ['TRIAL', 'ACTIVE', 'GRACE'] } }, data: { status: 'CANCELLED' } });
    const hadTrial = await this.prisma.clinicSubscription.count({ where: { clinicId, planId, trialEndsAt: { not: null } } });
    if (plan.priceMonthlyPaise === 0) {
      await this.prisma.clinicSubscription.create({ data: { clinicId, planId, status: 'ACTIVE' } });
      await this.setPlan(clinicId, plan.id, actorId);
      return { ok: true, status: 'ACTIVE' };
    }
    if (plan.trialDays > 0 && !hadTrial) {
      const trialEndsAt = new Date(Date.now() + plan.trialDays * 86400_000);
      await this.prisma.clinicSubscription.create({ data: { clinicId, planId, status: 'TRIAL', trialEndsAt, currentPeriodEnd: trialEndsAt } });
      await this.setPlan(clinicId, plan.id, actorId);
      return { ok: true, status: 'TRIAL', trialEndsAt };
    }
    const sub = await this.prisma.clinicSubscription.create({ data: { clinicId, planId, status: 'GRACE', currentPeriodEnd: new Date() } });
    const invoice = await this.issueInvoice(clinicId, sub.id, plan.priceMonthlyPaise);
    return { ok: true, status: 'PAYMENT_DUE', invoice, payment: await this.payInvoice(clinicId, invoice.id) };
  }

  async issueInvoice(clinicId: string, subscriptionId: string, amountPaise: number) {
    const tax = Math.round(amountPaise * 0.18);
    return this.prisma.invoice.create({
      data: { number: await this.nextInvoiceNumber(), clinicId, subscriptionId, amountPaise: amountPaise + tax, taxPaise: tax, status: 'DUE' },
    });
  }

  async payInvoice(clinicId: string, invoiceId: string) {
    const inv = must(await this.prisma.invoice.findFirst({ where: { id: invoiceId, clinicId } }), 'Invoice');
    if (inv.status !== 'DUE') throw bad('NOT_DUE', 'This invoice is not due');
    const order = await this.payments.createOrder('SUBSCRIPTION', inv.amountPaise, { clinicId });
    await this.prisma.payment.update({ where: { id: order.paymentId }, data: { raw: { invoiceId: inv.id } } });
    return order;
  }

  private async activate(subscriptionId: string) {
    const sub = await this.prisma.clinicSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    const start = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
    await this.prisma.clinicSubscription.update({ where: { id: sub.id }, data: { status: 'ACTIVE', currentPeriodEnd: addMonths(start, sub.period === 'YEARLY' ? 12 : 1) } });
    await this.setPlan(sub.clinicId, sub.planId, null);
  }

  private async setPlan(clinicId: string, planId: string | null, actorId: string | null) {
    await this.prisma.clinic.update({ where: { id: clinicId }, data: { planId } });
    this.entitlements.invalidate(clinicId);
    await this.audit.log(actorId, 'PLAN_CHANGED', 'Clinic', clinicId, undefined, { planId });
  }

  /** Daily job: trials ending, renewals, grace period expiry → downgrade to Free (MON-04, ADM-18 dunning). */
  async runBillingCycle() {
    const now = new Date();
    const due = await this.prisma.clinicSubscription.findMany({
      where: { status: { in: ['TRIAL', 'ACTIVE'] }, currentPeriodEnd: { lte: now } },
      include: { plan: true, clinic: true },
    });
    for (const s of due) {
      if (!(await this.revenue.enabled('CLINIC_SUBSCRIPTION', { clinicId: s.clinicId }))) continue;
      await this.prisma.clinicSubscription.update({ where: { id: s.id }, data: { status: 'GRACE' } });
      await this.issueInvoice(s.clinicId, s.id, s.plan.priceMonthlyPaise);
      await this.notifications.notify(s.clinic.ownerId, 'SUBSCRIPTION', {
        title: 'Subscription payment due',
        body: `Your ${s.plan.name} plan needs renewal. Pay within ${GRACE_DAYS} days to keep your features.`,
        data: { clinicId: s.clinicId },
      });
    }
    const expired = await this.prisma.clinicSubscription.findMany({
      where: { status: 'GRACE', currentPeriodEnd: { lte: new Date(now.getTime() - GRACE_DAYS * 86400_000) } },
      include: { clinic: true },
    });
    for (const s of expired) {
      await this.prisma.clinicSubscription.update({ where: { id: s.id }, data: { status: 'EXPIRED' } });
      await this.setPlan(s.clinicId, null, null); // back to the default (Free) plan — data is never deleted
      await this.notifications.notify(s.clinic.ownerId, 'SUBSCRIPTION', {
        title: 'Moved to the Free plan',
        body: 'Your subscription was not renewed. Paid features are locked; your data is safe.',
        data: { clinicId: s.clinicId },
      });
    }
  }
}

@Controller('clinic/:id/subscription')
export class SubscriptionsController {
  constructor(
    private readonly subs: SubscriptionsService,
    private readonly access: ClinicAccessService,
  ) {}

  @Get()
  async get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.check(u, id, 'owner');
    return this.subs.status(id);
  }

  @Post()
  async subscribe(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(subscribeSchema)) dto: z.infer<typeof subscribeSchema>) {
    await this.access.check(u, id, 'owner');
    return this.subs.subscribe(id, dto.planId, u.id);
  }

  @Post('invoices/:invoiceId/pay')
  async pay(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('invoiceId') invoiceId: string) {
    await this.access.check(u, id, 'owner');
    return this.subs.payInvoice(id, invoiceId);
  }
}

@Module({ controllers: [SubscriptionsController], providers: [SubscriptionsService], exports: [SubscriptionsService] })
export class SubscriptionsModule {}
