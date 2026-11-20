import { Body, Controller, Get, HttpCode, Module, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  AD_PLACEMENTS,
  BASE_TRANSLATIONS,
  adCampaignSchema,
  adPlacementSchema,
  addDays,
  areaSchema,
  bonusCampaignSchema,
  broadcastSchema,
  manualRefundSchema,
  settlementPaidSchema,
  specialtySchema,
  ticketReplySchema,
  translationSchema,
} from '@okidoc/shared';
import { z } from 'zod';
import { AdminOnly, AuthUser, CurrentUser, Public } from '../../common/auth';
import { bad, must, Zod } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/settings.service';
import { AuthModule } from '../auth/auth.controller';
import { BookingsModule } from '../bookings/bookings.controller';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { BonusService } from '../reports/bonus.service';
import { todayIST } from '../scheduling/scheduling.service';
import { AdminController } from './admin.controller';

/** Money, ads, campaigns, taxonomy, content, support (ADM-06/07/09..13/16). */
@AdminOnly()
@Controller('admin')
export class AdminOpsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly payments: PaymentsService,
    private readonly bonus: BonusService,
    private readonly notifications: NotificationsService,
    private readonly bookings: BookingsService,
  ) {}

  // ------------------------------------------------------------------ ads (ADM-16)

  @AdminOnly('ADMIN_FINANCE', 'ADMIN_OPS')
  @Get('ads/placements')
  async placements() {
    const rows = await this.prisma.adPlacement.findMany();
    return AD_PLACEMENTS.map((key) => rows.find((r) => r.key === key) ?? { key, enabled: false, source: 'HOUSE_THEN_ADMOB', admobUnitAndroid: null, admobUnitIos: null, frequencyCapPerDay: 0 });
  }

  @AdminOnly('ADMIN_FINANCE', 'ADMIN_OPS')
  @Put('ads/placements')
  async setPlacement(@CurrentUser() u: AuthUser, @Body(new Zod(adPlacementSchema)) dto: z.infer<typeof adPlacementSchema>) {
    const row = await this.prisma.adPlacement.upsert({ where: { key: dto.key }, create: dto, update: dto });
    await this.audit.log(u.id, 'AD_PLACEMENT', 'AdPlacement', dto.key, undefined, row);
    return row;
  }

  @AdminOnly('ADMIN_FINANCE', 'ADMIN_OPS')
  @Get('ads/campaigns')
  campaigns() {
    return this.prisma.adCampaign.findMany({ orderBy: [{ active: 'desc' }, { endsAt: 'desc' }] });
  }

  @AdminOnly('ADMIN_FINANCE', 'ADMIN_OPS')
  @Post('ads/campaigns')
  async createCampaign(@CurrentUser() u: AuthUser, @Body(new Zod(adCampaignSchema)) dto: z.infer<typeof adCampaignSchema>) {
    const c = await this.prisma.adCampaign.create({ data: { ...dto, startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt) } });
    await this.audit.log(u.id, 'AD_CAMPAIGN_CREATED', 'AdCampaign', c.id, undefined, c);
    return c;
  }

  @AdminOnly('ADMIN_FINANCE', 'ADMIN_OPS')
  @Patch('ads/campaigns/:id')
  async updateCampaign(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(adCampaignSchema.partial())) dto: Partial<z.infer<typeof adCampaignSchema>>) {
    const c = await this.prisma.adCampaign.update({
      where: { id },
      data: { ...dto, startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined, endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined },
    });
    await this.audit.log(u.id, 'AD_CAMPAIGN_UPDATED', 'AdCampaign', id, undefined, dto);
    return c;
  }

  @AdminOnly('ADMIN_FINANCE', 'ADMIN_OPS')
  @Get('ads/report')
  async adReport(@Query('days') days?: string) {
    const n = Math.min(90, Math.max(1, Number(days) || 30));
    const since = new Date(Date.now() - n * 86400_000);
    const events = await this.prisma.adEvent.groupBy({ by: ['placement', 'type', 'source'], where: { createdAt: { gte: since } }, _count: true });
    const revenue = await this.prisma.adRevenueEntry.findMany({ where: { createdAt: { gte: since } }, orderBy: { date: 'desc' } });
    const totalRevenue = revenue.reduce((a, r) => a + r.amountPaise, 0);
    const impressions = events.filter((e) => e.type === 'IMPRESSION').reduce((a, e) => a + e._count, 0);
    return {
      days: n,
      byPlacement: AD_PLACEMENTS.map((p) => ({
        placement: p,
        impressions: events.filter((e) => e.placement === p && e.type === 'IMPRESSION').reduce((a, e) => a + e._count, 0),
        clicks: events.filter((e) => e.placement === p && e.type === 'CLICK').reduce((a, e) => a + e._count, 0),
      })),
      revenueEntries: revenue,
      totalRevenuePaise: totalRevenue,
      impressions,
      eCpmPaise: impressions ? Math.round((totalRevenue / impressions) * 1000) : 0,
    };
  }

  /** AdMob revenue is entered from the AdMob console (or a future reporting-API import). */
  @AdminOnly('ADMIN_FINANCE')
  @Post('ads/revenue')
  async addAdRevenue(@CurrentUser() u: AuthUser, @Body(new Zod(z.object({ date: z.string(), source: z.enum(['ADMOB', 'DIRECT']), amountPaise: z.number().int().min(0), note: z.string().max(200).optional() }))) dto: { date: string; source: string; amountPaise: number; note?: string }) {
    const row = await this.prisma.adRevenueEntry.create({ data: dto });
    await this.audit.log(u.id, 'AD_REVENUE_ENTRY', 'AdRevenueEntry', row.id, undefined, row);
    return row;
  }

  // ------------------------------------------------------------------ transactions & refunds (ADM-06)

  @AdminOnly('ADMIN_FINANCE', 'ADMIN_SUPPORT')
  @Get('payments')
  async paymentsList(@Query('status') status?: string, @Query('purpose') purpose?: string, @Query('q') q?: string) {
    return this.prisma.payment.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(purpose ? { purpose } : {}),
        ...(q ? { OR: [{ gatewayOrderId: { contains: q } }, { gatewayPaymentId: { contains: q } }, { booking: { patientPhone: { contains: q } } }] } : {}),
      },
      include: { refunds: true, booking: { select: { id: true, tokenNo: true, patientName: true, patientPhone: true, status: true, paymentMode: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @AdminOnly('ADMIN_FINANCE')
  @HttpCode(200)
  @Post('payments/:id/refund')
  async manualRefund(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(manualRefundSchema)) dto: z.infer<typeof manualRefundSchema>) {
    const p = must(await this.prisma.payment.findUnique({ where: { id } }), 'Payment');
    if (p.status !== 'PAID' && p.status !== 'PARTIALLY_REFUNDED') throw bad('NOT_REFUNDABLE', 'Only paid payments can be refunded');
    const r = await this.payments.refund(p, dto.amountPaise, dto.reason, u.id);
    await this.audit.log(u.id, 'MANUAL_REFUND', 'Payment', id, undefined, dto);
    return r;
  }

  // ------------------------------------------------------------------ settlements (ADM-07, PAY-10)

  /** What Okidoc holds for clinics: consultation fees collected online (ONLINE_FULL), net of refunds. */
  @AdminOnly('ADMIN_FINANCE')
  @Get('settlements/due')
  async due(@Query('from') from?: string, @Query('to') to?: string) {
    const toDate = to ?? todayIST();
    const fromDate = from ?? addDays(toDate, -6);
    const bookings = await this.prisma.booking.findMany({
      where: { paymentMode: 'ONLINE_FULL', paidOnline: { gt: 0 }, instance: { date: { gte: fromDate, lte: toDate } } },
      include: { payments: { where: { purpose: 'BOOKING' } }, instance: { select: { sitting: { select: { link: { select: { clinicId: true, clinic: { select: { name: true, payoutUpi: true, payoutAccount: true, payoutIfsc: true } } } } } } } } },
    });
    const byClinic = new Map<string, any>();
    for (const b of bookings) {
      const link = b.instance.sitting.link;
      const refunded = b.payments.reduce((a, p) => a + p.refundedPaise, 0);
      const net = Math.max(0, b.paidOnline - b.bookingFee - b.tax - refunded);
      const e = byClinic.get(link.clinicId) ?? { clinicId: link.clinicId, clinicName: link.clinic.name, payout: link.clinic, bookings: 0, amountDue: 0 };
      e.bookings++;
      e.amountDue += net;
      byClinic.set(link.clinicId, e);
    }
    const settled = await this.prisma.settlement.findMany({ where: { periodFrom: fromDate, periodTo: toDate } });
    return {
      from: fromDate,
      to: toDate,
      items: [...byClinic.values()].map((e) => ({ ...e, settlement: settled.find((s) => s.clinicId === e.clinicId) ?? null })),
    };
  }

  @AdminOnly('ADMIN_FINANCE')
  @Post('settlements/generate')
  async generate(@CurrentUser() u: AuthUser, @Body(new Zod(z.object({ from: z.string(), to: z.string() }))) dto: { from: string; to: string }) {
    const due = await this.due(dto.from, dto.to);
    const created = [];
    for (const item of due.items) {
      if (item.settlement || item.amountDue <= 0) continue;
      created.push(
        await this.prisma.settlement.create({ data: { party: 'CLINIC', clinicId: item.clinicId, periodFrom: dto.from, periodTo: dto.to, amountDue: item.amountDue } }),
      );
    }
    await this.audit.log(u.id, 'SETTLEMENTS_GENERATED', 'Settlement', null, undefined, { ...dto, count: created.length });
    return created;
  }

  @AdminOnly('ADMIN_FINANCE')
  @Get('settlements')
  settlements(@Query('status') status?: string) {
    return this.prisma.settlement.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  @AdminOnly('ADMIN_FINANCE')
  @HttpCode(200)
  @Post('settlements/:id/paid')
  async markPaid(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(settlementPaidSchema)) dto: z.infer<typeof settlementPaidSchema>) {
    const s = must(await this.prisma.settlement.findUnique({ where: { id } }), 'Settlement');
    const updated = await this.prisma.settlement.update({ where: { id }, data: { status: 'PAID', amountPaid: s.amountDue, reference: dto.reference, paidAt: new Date() } });
    await this.audit.log(u.id, 'SETTLEMENT_PAID', 'Settlement', id, s, updated);
    return updated;
  }

  // ------------------------------------------------------------------ bonuses (ADM-09)

  @AdminOnly('ADMIN_OPS', 'ADMIN_FINANCE')
  @Get('bonuses')
  bonusesList() {
    return this.prisma.bonusCampaign.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { payouts: true } } } });
  }

  @AdminOnly('ADMIN_OPS', 'ADMIN_FINANCE')
  @Post('bonuses')
  async createBonus(@CurrentUser() u: AuthUser, @Body(new Zod(bonusCampaignSchema)) dto: z.infer<typeof bonusCampaignSchema>) {
    const c = await this.prisma.bonusCampaign.create({ data: dto });
    await this.audit.log(u.id, 'BONUS_CREATED', 'BonusCampaign', c.id, undefined, c);
    return c;
  }

  @AdminOnly('ADMIN_OPS', 'ADMIN_FINANCE')
  @Patch('bonuses/:id')
  async updateBonus(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(bonusCampaignSchema.partial())) dto: Partial<z.infer<typeof bonusCampaignSchema>>) {
    const c = await this.prisma.bonusCampaign.update({ where: { id }, data: dto });
    await this.audit.log(u.id, 'BONUS_UPDATED', 'BonusCampaign', id, undefined, dto);
    return c;
  }

  @AdminOnly('ADMIN_OPS', 'ADMIN_FINANCE')
  @Get('bonuses/:id/progress')
  async bonusProgress(@Param('id') id: string) {
    const c = must(await this.prisma.bonusCampaign.findUnique({ where: { id }, include: { payouts: true } }), 'Campaign');
    const clinics = await this.prisma.clinic.findMany({
      where: { verification: 'APPROVED', active: true, ...(c.clinicIds.length ? { id: { in: c.clinicIds } } : {}) },
      select: { id: true, name: true, code: true },
    });
    const rows = [];
    for (const cl of clinics) rows.push({ clinic: cl, ...(await this.bonus.progress(c, cl.id)), payout: c.payouts.find((p) => p.clinicId === cl.id) ?? null });
    return { campaign: c, rows: rows.sort((a, b) => b.achieved - a.achieved) };
  }

  @AdminOnly('ADMIN_FINANCE')
  @HttpCode(200)
  @Post('bonuses/:id/payouts')
  async payout(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(z.object({ clinicId: z.string(), status: z.enum(['APPROVED', 'PAID', 'REJECTED']) }))) dto: { clinicId: string; status: string }) {
    const c = must(await this.prisma.bonusCampaign.findUnique({ where: { id } }), 'Campaign');
    const p = await this.bonus.progress(c, dto.clinicId);
    if (dto.status !== 'REJECTED' && !p.completed) throw bad('NOT_COMPLETED', 'Target not reached yet');
    const row = await this.prisma.bonusPayout.upsert({
      where: { campaignId_clinicId: { campaignId: id, clinicId: dto.clinicId } },
      create: { campaignId: id, clinicId: dto.clinicId, achieved: p.achieved, amountPaise: p.payablePaise, status: dto.status, approvedById: u.id },
      update: { achieved: p.achieved, amountPaise: p.payablePaise, status: dto.status, approvedById: u.id },
    });
    await this.audit.log(u.id, `BONUS_${dto.status}`, 'BonusPayout', row.id, undefined, row);
    const clinic = await this.prisma.clinic.findUniqueOrThrow({ where: { id: dto.clinicId } });
    if (dto.status !== 'REJECTED') {
      await this.notifications.notify(clinic.ownerId, 'BONUS_MILESTONE', { title: 'Bonus update', body: `${c.name}: your reward is ${dto.status.toLowerCase()}.`, data: { clinicId: clinic.id } });
    }
    return row;
  }

  // ------------------------------------------------------------------ taxonomy (ADM-10)

  @AdminOnly('ADMIN_OPS')
  @Post('specialties')
  async addSpecialty(@CurrentUser() u: AuthUser, @Body(new Zod(specialtySchema)) dto: z.infer<typeof specialtySchema>) {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const s = await this.prisma.specialty.create({ data: { ...dto, slug, keywords: dto.keywords.map((k) => k.toLowerCase()) } });
    await this.audit.log(u.id, 'SPECIALTY_CREATED', 'Specialty', s.id, undefined, s);
    return s;
  }

  @AdminOnly('ADMIN_OPS')
  @Patch('specialties/:id')
  async editSpecialty(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(specialtySchema.partial().extend({ active: z.boolean().optional() }))) dto: any) {
    const s = await this.prisma.specialty.update({ where: { id }, data: { ...dto, keywords: dto.keywords?.map((k: string) => k.toLowerCase()) } });
    await this.audit.log(u.id, 'SPECIALTY_UPDATED', 'Specialty', id, undefined, dto);
    return s;
  }

  @AdminOnly('ADMIN_OPS')
  @Post('areas')
  async addArea(@CurrentUser() u: AuthUser, @Body(new Zod(areaSchema)) dto: z.infer<typeof areaSchema>) {
    const region = await this.prisma.region.upsert({
      where: { state_district: { state: dto.state, district: dto.district } },
      create: { state: dto.state, district: dto.district, name: dto.district },
      update: {},
    });
    const a = await this.prisma.area.create({ data: { regionId: region.id, name: dto.name, nameBn: dto.nameBn, pin: dto.pin, lat: dto.lat, lng: dto.lng } });
    await this.audit.log(u.id, 'AREA_CREATED', 'Area', a.id, undefined, a);
    return a;
  }

  @AdminOnly('ADMIN_OPS')
  @Patch('areas/:id')
  async editArea(@Param('id') id: string, @Body(new Zod(z.object({ name: z.string().optional(), nameBn: z.string().optional(), active: z.boolean().optional() }))) dto: any) {
    return this.prisma.area.update({ where: { id }, data: dto });
  }

  // ------------------------------------------------------------------ localization (ADM-11)

  @Get('translations')
  async translations(@Query('language') language = 'bn') {
    const overrides = await this.prisma.translation.findMany({ where: { language } });
    const base = BASE_TRANSLATIONS.en;
    const target = (BASE_TRANSLATIONS as Record<string, Record<string, string>>)[language] ?? {};
    const keys = Object.keys(base);
    return {
      language,
      items: keys.map((key) => ({
        key,
        en: base[key as keyof typeof base],
        base: target[key] ?? null,
        override: overrides.find((o) => o.key === key)?.value ?? null,
      })),
      missing: keys.filter((k) => !target[k] && !overrides.some((o) => o.key === k)),
    };
  }

  @AdminOnly('ADMIN_OPS')
  @Put('translations')
  async setTranslation(@CurrentUser() u: AuthUser, @Body(new Zod(translationSchema)) dto: z.infer<typeof translationSchema>) {
    const row = await this.prisma.translation.upsert({
      where: { language_key: { language: dto.language, key: dto.key } },
      create: dto,
      update: { value: dto.value },
    });
    await this.audit.log(u.id, 'TRANSLATION', 'Translation', row.id, undefined, dto);
    return row;
  }

  // ------------------------------------------------------------------ support & reviews (ADM-12, ADM-13)

  @AdminOnly('ADMIN_SUPPORT', 'ADMIN_OPS')
  @Get('tickets')
  tickets(@Query('status') status?: string) {
    return this.prisma.supportTicket.findMany({
      where: status ? { status } : { status: { in: ['OPEN', 'PENDING'] } },
      include: { user: { select: { id: true, name: true, phone: true } }, messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  @AdminOnly('ADMIN_SUPPORT', 'ADMIN_OPS')
  @Post('tickets/:id/reply')
  async replyTicket(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(ticketReplySchema)) dto: z.infer<typeof ticketReplySchema>) {
    const t = must(await this.prisma.supportTicket.findUnique({ where: { id } }), 'Ticket');
    await this.prisma.ticketMessage.create({ data: { ticketId: id, authorId: u.id, body: dto.body, fromStaff: true } });
    await this.notifications.notify(t.userId, 'GENERAL', { title: 'Okidoc support replied', body: dto.body.slice(0, 140), data: { ticketId: id } });
    return this.prisma.supportTicket.update({ where: { id }, data: { status: 'PENDING', assignedToId: t.assignedToId ?? u.id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
  }

  @AdminOnly('ADMIN_SUPPORT', 'ADMIN_OPS')
  @Patch('tickets/:id')
  updateTicket(@Param('id') id: string, @Body(new Zod(z.object({ status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional(), assignedToId: z.string().nullable().optional() }))) dto: any) {
    return this.prisma.supportTicket.update({ where: { id }, data: dto });
  }

  @AdminOnly('ADMIN_SUPPORT', 'ADMIN_OPS')
  @Get('reviews')
  reviews(@Query('filter') filter?: string) {
    return this.prisma.review.findMany({
      where: filter === 'hidden' ? { hidden: true } : filter === 'reported' ? { reports: { gt: 0 } } : {},
      include: { user: { select: { name: true } }, doctor: { include: { user: { select: { name: true } } } }, clinic: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @AdminOnly('ADMIN_SUPPORT', 'ADMIN_OPS')
  @Patch('reviews/:id')
  async moderate(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(z.object({ hidden: z.boolean() }))) dto: { hidden: boolean }) {
    const r = await this.prisma.review.update({ where: { id }, data: { hidden: dto.hidden } });
    await this.bookings.recomputeRatings(r);
    await this.audit.log(u.id, dto.hidden ? 'REVIEW_HIDDEN' : 'REVIEW_RESTORED', 'Review', id);
    return r;
  }

  // ------------------------------------------------------------------ broadcast

  @AdminOnly('ADMIN_OPS')
  @HttpCode(200)
  @Post('broadcast')
  async broadcast(@CurrentUser() u: AuthUser, @Body(new Zod(broadcastSchema.extend({ role: z.enum(['PATIENT', 'DOCTOR', 'CLINIC_OWNER']).optional() }))) dto: z.infer<typeof broadcastSchema> & { role?: string }) {
    const users = await this.prisma.user.findMany({ where: { status: 'ACTIVE', ...(dto.role ? { roles: { some: { role: dto.role as any } } } : {}) }, select: { id: true }, take: 5000 });
    for (const x of users) await this.notifications.notify(x.id, dto.type, { title: dto.title, body: dto.body });
    await this.audit.log(u.id, 'BROADCAST', 'Notification', null, undefined, { ...dto, recipients: users.length });
    return { sent: users.length };
  }
}

/** Public translation overrides merged by the apps on top of the bundled strings. */
@Public()
@Controller('i18n')
export class I18nController {
  constructor(private readonly prisma: PrismaService) {}
  @Get(':language')
  async get(@Param('language') language: string) {
    const rows = await this.prisma.translation.findMany({ where: { language } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}

@Module({ imports: [AuthModule, BookingsModule], controllers: [AdminController, AdminOpsController, I18nController] })
export class AdminModule {}
