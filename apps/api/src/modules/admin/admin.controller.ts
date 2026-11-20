import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, StreamableFile } from '@nestjs/common';
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  LIMIT_KEYS,
  entitlementOverrideSchema,
  liftBlockSchema,
  paymentConfigSchema,
  planSchema,
  revenueSettingSchema,
  ruleSettingsSchema,
  userAdminActionSchema,
  verificationDecisionSchema,
} from '@okidoc/shared';
import { z } from 'zod';
import { AdminOnly, AuthUser, CurrentUser } from '../../common/auth';
import { bad, must, Zod } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService, SettingsService } from '../../common/settings.service';
import { AuthService } from '../auth/auth.service';
import { NoShowService } from '../noshow/noshow.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService, PaymentConfigService, RevenueService } from '../platform/platform.services';
import { QueueService } from '../queue/queue.service';
import { todayIST } from '../scheduling/scheduling.service';
import { StorageService } from '../storage/storage.service';

const page = (p?: string, size?: string) => {
  const pageSize = Math.min(100, Math.max(1, Number(size) || 25));
  const pageNo = Math.max(1, Number(p) || 1);
  return { take: pageSize, skip: (pageNo - 1) * pageSize, page: pageNo, pageSize };
};

/** Okidoc operations: dashboard, verification, entitlements, users, blocks, rules (ADM-01..04, 08, 14, 17). */
@AdminOnly()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly entitlements: EntitlementsService,
    private readonly revenue: RevenueService,
    private readonly paymentConfig: PaymentConfigService,
    private readonly notifications: NotificationsService,
    private readonly noShows: NoShowService,
    private readonly auth: AuthService,
    private readonly queue: QueueService,
    private readonly storage: StorageService,
  ) {}

  // ------------------------------------------------------------------ ADM-01 dashboard

  @Get('dashboard')
  async dashboard() {
    const today = todayIST();
    const since30 = new Date(Date.now() - 30 * 86400_000);
    const [clinics, clinicsPending, doctors, doctorsPending, patients, todayInstances, todayBookings, noShows30, served30, blocks, openTickets] = await Promise.all([
      this.prisma.clinic.count({ where: { verification: 'APPROVED', active: true } }),
      this.prisma.clinic.count({ where: { verification: 'PENDING' } }),
      this.prisma.doctor.count({ where: { verification: 'APPROVED' } }),
      this.prisma.doctor.count({ where: { verification: 'PENDING' } }),
      this.prisma.roleAssignment.count({ where: { role: 'PATIENT' } }),
      this.prisma.sittingInstance.groupBy({ by: ['status'], where: { date: today }, _count: true }),
      this.prisma.booking.groupBy({ by: ['source'], where: { instance: { date: today }, status: { not: 'PENDING_PAYMENT' } }, _count: true }),
      this.prisma.booking.count({ where: { status: 'NO_SHOW', source: 'ONLINE', paymentMode: 'PAY_AT_CLINIC', createdAt: { gte: since30 } } }),
      this.prisma.booking.count({ where: { status: { in: ['SERVED', 'NO_SHOW'] }, source: 'ONLINE', paymentMode: 'PAY_AT_CLINIC', createdAt: { gte: since30 } } }),
      this.prisma.patientBlock.groupBy({ by: ['scope'], where: { active: true }, _count: true }),
      this.prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'PENDING'] } } }),
    ]);
    const revenueByStream = await this.revenueSummary(since30);
    return {
      clinics: { live: clinics, pending: clinicsPending },
      doctors: { verified: doctors, pending: doctorsPending },
      patients,
      today: {
        sittings: Object.fromEntries(todayInstances.map((g) => [g.status, g._count])),
        bookings: Object.fromEntries(todayBookings.map((g) => [g.source, g._count])),
      },
      noShowRate30d: served30 ? Math.round((noShows30 / served30) * 1000) / 10 : 0,
      activeBlocks: Object.fromEntries(blocks.map((b) => [b.scope, b._count])),
      openTickets,
      revenue30d: revenueByStream,
    };
  }

  private async revenueSummary(since: Date) {
    const [ledger, adRevenue, adEvents, subs] = await Promise.all([
      this.prisma.ledgerEntry.groupBy({ by: ['type'], where: { createdAt: { gte: since }, party: 'OKIDOC' }, _sum: { amountPaise: true } }),
      this.prisma.adRevenueEntry.aggregate({ where: { createdAt: { gte: since } }, _sum: { amountPaise: true } }),
      this.prisma.adEvent.groupBy({ by: ['type'], where: { createdAt: { gte: since } }, _count: true }),
      this.prisma.invoice.aggregate({ where: { status: 'PAID', paidAt: { gte: since } }, _sum: { amountPaise: true } }),
    ]);
    const l = (t: string) => ledger.find((x) => x.type === t)?._sum.amountPaise ?? 0;
    return {
      adsPaise: adRevenue._sum.amountPaise ?? 0,
      adImpressions: adEvents.find((e) => e.type === 'IMPRESSION')?._count ?? 0,
      adClicks: adEvents.find((e) => e.type === 'CLICK')?._count ?? 0,
      subscriptionsPaise: subs._sum.amountPaise ?? 0,
      bookingFeesPaise: l('BOOKING_FEE'),
      commissionPaise: l('COMMISSION'),
    };
  }

  // ------------------------------------------------------------------ clinics (ADM-02, ADM-03)

  @AdminOnly('ADMIN_OPS', 'ADMIN_SUPPORT', 'ADMIN_FINANCE')
  @Get('clinics')
  async clinics(@Query('q') q?: string, @Query('verification') verification?: string, @Query('regionId') regionId?: string, @Query('page') p?: string) {
    const pg = page(p);
    const where = {
      ...(verification ? { verification: verification as any } : {}),
      ...(regionId ? { area: { regionId } } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { code: { contains: q.toUpperCase() } }, { owner: { phone: { contains: q } } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.clinic.findMany({
        where,
        include: { area: { include: { region: true } }, plan: { select: { code: true, name: true } }, owner: { select: { name: true, phone: true } }, _count: { select: { links: { where: { status: 'APPROVED' } } } } },
        orderBy: { createdAt: 'desc' },
        take: pg.take,
        skip: pg.skip,
      }),
      this.prisma.clinic.count({ where }),
    ]);
    return { items, total, page: pg.page, pageSize: pg.pageSize };
  }

  @AdminOnly('ADMIN_OPS', 'ADMIN_SUPPORT', 'ADMIN_FINANCE')
  @Get('clinics/:id')
  async clinic(@Param('id') id: string) {
    const clinic = must(
      await this.prisma.clinic.findUnique({
        where: { id },
        include: {
          area: { include: { region: true } },
          owner: { select: { id: true, name: true, phone: true } },
          plan: true,
          featureOverrides: true,
          links: { include: { doctor: { include: { user: { select: { name: true } } } } } },
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 5, include: { plan: true } },
          staff: { include: { user: { select: { name: true, phone: true } } } },
        },
      }),
      'Clinic',
    );
    const [entitlements, paymentRows, resolved] = await Promise.all([
      this.entitlements.forClinic(id),
      this.paymentConfig.rows({ clinicId: id, regionId: clinic.area.regionId }),
      this.paymentConfig.resolve({ clinicId: id, regionId: clinic.area.regionId }),
    ]);
    return { ...clinic, entitlements, paymentRows, effectivePayment: resolved, featureCatalog: { features: FEATURE_KEYS, limits: LIMIT_KEYS, labels: FEATURE_LABELS } };
  }

  @AdminOnly('ADMIN_OPS')
  @Put('clinics/:id/entitlements')
  async setEntitlements(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(entitlementOverrideSchema)) dto: z.infer<typeof entitlementOverrideSchema>) {
    const before = await this.entitlements.forClinic(id);
    if (dto.planId !== undefined) await this.prisma.clinic.update({ where: { id }, data: { planId: dto.planId } });
    await this.prisma.clinicFeatureOverride.deleteMany({ where: { clinicId: id } });
    const overrides = dto.overrides.filter((o) => o.enabled != null || o.limit != null);
    if (overrides.length) {
      await this.prisma.clinicFeatureOverride.createMany({ data: overrides.map((o) => ({ clinicId: id, key: o.key, enabled: o.enabled ?? null, limit: o.limit ?? null })) });
    }
    this.entitlements.invalidate(id);
    const after = await this.entitlements.forClinic(id);
    await this.audit.log(u.id, 'ENTITLEMENTS_CHANGED', 'Clinic', id, before, after);
    const clinic = await this.prisma.clinic.findUniqueOrThrow({ where: { id } });
    await this.notifications.notify(clinic.ownerId, 'ENTITLEMENT_CHANGED', { title: 'Your Okidoc features changed', body: 'Okidoc updated the features available to your clinic.', data: { clinicId: id } });
    return after;
  }

  @AdminOnly('ADMIN_OPS')
  @HttpCode(200)
  @Post('clinics/:id/verification')
  async verifyClinic(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(verificationDecisionSchema)) dto: z.infer<typeof verificationDecisionSchema>) {
    const clinic = await this.prisma.clinic.update({
      where: { id },
      data: { verification: dto.decision, verificationNote: dto.reason ?? null, verifiedAt: dto.decision === 'APPROVED' ? new Date() : null },
    });
    await this.audit.log(u.id, `CLINIC_${dto.decision}`, 'Clinic', id, undefined, dto);
    await this.notifications.notify(clinic.ownerId, 'VERIFICATION_RESULT', {
      title: dto.decision === 'APPROVED' ? 'Clinic approved' : dto.decision === 'REJECTED' ? 'Clinic not approved' : 'More information needed',
      body: dto.decision === 'APPROVED' ? `${clinic.name} is now live on Okidoc.` : dto.reason ?? 'Please check your clinic details.',
      data: { clinicId: id },
    });
    return clinic;
  }

  @AdminOnly('ADMIN_OPS')
  @Patch('clinics/:id/active')
  async clinicActive(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(z.object({ active: z.boolean() }))) dto: { active: boolean }) {
    const c = await this.prisma.clinic.update({ where: { id }, data: { active: dto.active } });
    await this.audit.log(u.id, dto.active ? 'CLINIC_ACTIVATED' : 'CLINIC_DEACTIVATED', 'Clinic', id);
    return c;
  }

  // ------------------------------------------------------------------ doctors & links (ADM-03, ADM-04)

  @AdminOnly('ADMIN_OPS', 'ADMIN_SUPPORT')
  @Get('doctors')
  async doctors(@Query('q') q?: string, @Query('verification') verification?: string, @Query('page') p?: string) {
    const pg = page(p);
    const where = {
      ...(verification ? { verification: verification as any } : {}),
      ...(q ? { OR: [{ user: { name: { contains: q, mode: 'insensitive' as const } } }, { registrationNo: { contains: q, mode: 'insensitive' as const } }, { user: { phone: { contains: q } } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where,
        include: { user: { select: { name: true, phone: true } }, specialties: { select: { name: true } }, documents: { select: { id: true, kind: true, createdAt: true } }, _count: { select: { links: { where: { status: 'APPROVED' } } } } },
        orderBy: { updatedAt: 'desc' },
        take: pg.take,
        skip: pg.skip,
      }),
      this.prisma.doctor.count({ where }),
    ]);
    return { items, total, page: pg.page, pageSize: pg.pageSize };
  }

  @AdminOnly('ADMIN_OPS')
  @Get('doctor-documents/:docId/file')
  async doctorDoc(@Param('docId') docId: string) {
    const d = must(await this.prisma.doctorDocument.findUnique({ where: { id: docId } }), 'Document');
    return new StreamableFile(this.storage.stream(d.fileKey));
  }

  @AdminOnly('ADMIN_OPS')
  @HttpCode(200)
  @Post('doctors/:id/verification')
  async verifyDoctor(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(verificationDecisionSchema)) dto: z.infer<typeof verificationDecisionSchema>) {
    const d = await this.prisma.doctor.update({
      where: { id },
      data: { verification: dto.decision, verificationNote: dto.reason ?? null, verifiedAt: dto.decision === 'APPROVED' ? new Date() : null },
    });
    await this.audit.log(u.id, `DOCTOR_${dto.decision}`, 'Doctor', id, undefined, dto);
    await this.notifications.notify(d.userId, 'VERIFICATION_RESULT', {
      title: dto.decision === 'APPROVED' ? 'Approved by Okidoc' : dto.decision === 'REJECTED' ? 'Verification not approved' : 'More information needed',
      body: dto.decision === 'APPROVED' ? 'Patients can now book your sittings.' : dto.reason ?? 'Please check your registration details.',
    });
    return d;
  }

  @AdminOnly('ADMIN_OPS', 'ADMIN_SUPPORT')
  @Get('links')
  links(@Query('status') status?: string) {
    return this.prisma.clinicDoctorLink.findMany({
      where: status ? { status: status as any } : {},
      include: { clinic: { select: { id: true, name: true, code: true } }, doctor: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @AdminOnly('ADMIN_OPS')
  @HttpCode(200)
  @Post('links/:id/status')
  async linkStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(z.object({ status: z.enum(['APPROVED', 'DECLINED', 'REMOVED']), reason: z.string().max(200).optional() }))) dto: { status: 'APPROVED' | 'DECLINED' | 'REMOVED'; reason?: string }) {
    const before = must(await this.prisma.clinicDoctorLink.findUnique({ where: { id } }), 'Link');
    const link = await this.prisma.clinicDoctorLink.update({ where: { id }, data: { status: dto.status, declineReason: dto.reason ?? null, respondedAt: new Date() } });
    if (dto.status === 'REMOVED') {
      await this.prisma.sitting.updateMany({ where: { linkId: id }, data: { active: false, validTo: todayIST() } });
      const future = await this.prisma.sittingInstance.findMany({ where: { sitting: { linkId: id }, date: { gte: todayIST() }, status: 'SCHEDULED' } });
      for (const i of future) await this.queue.cancelInstance(i.id, u.id, 'Doctor no longer sits at this clinic', 'ADMIN');
    }
    await this.audit.log(u.id, `LINK_${dto.status}`, 'ClinicDoctorLink', id, before, link);
    return link;
  }

  // ------------------------------------------------------------------ plans (ADM-18)

  @Get('plans')
  plans() {
    return this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { clinics: true } } } });
  }

  @AdminOnly('ADMIN_FINANCE')
  @Post('plans')
  async createPlan(@CurrentUser() u: AuthUser, @Body(new Zod(planSchema)) dto: z.infer<typeof planSchema>) {
    const p = await this.prisma.plan.create({ data: { ...dto, code: dto.code.toUpperCase() } });
    await this.audit.log(u.id, 'PLAN_CREATED', 'Plan', p.id, undefined, p);
    this.entitlements.invalidate();
    return p;
  }

  @AdminOnly('ADMIN_FINANCE')
  @Patch('plans/:id')
  async updatePlan(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(planSchema.partial())) dto: Partial<z.infer<typeof planSchema>>) {
    const before = await this.prisma.plan.findUniqueOrThrow({ where: { id } });
    const p = await this.prisma.plan.update({ where: { id }, data: dto });
    await this.audit.log(u.id, 'PLAN_UPDATED', 'Plan', id, before, p);
    this.entitlements.invalidate();
    return p;
  }

  @AdminOnly('ADMIN_FINANCE')
  @HttpCode(200)
  @Post('plans/default')
  async defaultPlan(@CurrentUser() u: AuthUser, @Body(new Zod(z.object({ code: z.string() }))) dto: { code: string }) {
    must(await this.prisma.plan.findUnique({ where: { code: dto.code } }), 'Plan');
    await this.settings.set('defaultPlanCode', dto.code);
    this.entitlements.invalidate();
    await this.audit.log(u.id, 'DEFAULT_PLAN', 'PlatformSetting', 'defaultPlanCode', undefined, dto);
    return { ok: true };
  }

  // ------------------------------------------------------------------ payments config (ADM-05, PAY-01/02)

  @AdminOnly('ADMIN_FINANCE')
  @Get('payment-configs')
  paymentConfigs() {
    return this.prisma.paymentConfig.findMany({ where: { scope: { in: ['PLATFORM', 'REGION', 'CLINIC'] } }, orderBy: [{ scope: 'asc' }, { updatedAt: 'desc' }] });
  }

  @AdminOnly('ADMIN_FINANCE')
  @Put('payment-configs')
  async upsertPaymentConfig(@CurrentUser() u: AuthUser, @Body(new Zod(paymentConfigSchema)) dto: z.infer<typeof paymentConfigSchema>) {
    const scopeId = dto.scope === 'PLATFORM' ? 'GLOBAL' : dto.scopeId;
    if (!scopeId) throw bad('SCOPE_ID', 'Choose a region or clinic');
    const { scope, scopeId: _, allowedModes, ...rest } = dto;
    const before = await this.prisma.paymentConfig.findUnique({ where: { scope_scopeId: { scope, scopeId } } });
    const data = { ...rest, allowedModes: allowedModes ?? [], updatedById: u.id };
    const row = await this.prisma.paymentConfig.upsert({ where: { scope_scopeId: { scope, scopeId } }, create: { scope, scopeId, ...data }, update: data });
    await this.audit.log(u.id, 'PAYMENT_CONFIG', 'PaymentConfig', row.id, before, row);
    return row;
  }

  @AdminOnly('ADMIN_FINANCE')
  @Delete('payment-configs/:id')
  async deletePaymentConfig(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = must(await this.prisma.paymentConfig.findUnique({ where: { id } }), 'Config');
    if (row.scope === 'PLATFORM') throw bad('PLATFORM_REQUIRED', 'The platform default cannot be deleted');
    await this.prisma.paymentConfig.delete({ where: { id } });
    await this.audit.log(u.id, 'PAYMENT_CONFIG_DELETED', 'PaymentConfig', id, row);
    return { ok: true };
  }

  // ------------------------------------------------------------------ revenue switches (ADM-15, MON-01)

  @AdminOnly('ADMIN_FINANCE')
  @Get('revenue-settings')
  async revenueSettings() {
    const rows = await this.prisma.revenueSetting.findMany({ orderBy: [{ stream: 'asc' }, { scope: 'asc' }] });
    const streams = ['ADS', 'CLINIC_SUBSCRIPTION', 'DOCTOR_SUBSCRIPTION', 'BOOKING_FEE', 'COMMISSION', 'SPONSORED_LISTINGS'] as const;
    const platform = await Promise.all(streams.map(async (s) => ({ stream: s, enabled: await this.revenue.enabled(s) })));
    return { platform, rows };
  }

  @AdminOnly('ADMIN_FINANCE')
  @Put('revenue-settings')
  async setRevenue(@CurrentUser() u: AuthUser, @Body(new Zod(revenueSettingSchema)) dto: z.infer<typeof revenueSettingSchema>) {
    const scopeId = dto.scope === 'PLATFORM' ? 'GLOBAL' : dto.scopeId;
    if (!scopeId) throw bad('SCOPE_ID', 'Choose a region or clinic');
    const key = { stream: dto.stream, scope: dto.scope, scopeId };
    const before = await this.prisma.revenueSetting.findUnique({ where: { stream_scope_scopeId: key } });
    const data = { enabled: dto.enabled, effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null, updatedById: u.id };
    const row = await this.prisma.revenueSetting.upsert({ where: { stream_scope_scopeId: key }, create: { ...key, ...data }, update: data });
    this.revenue.invalidate();
    await this.audit.log(u.id, 'REVENUE_SETTING', 'RevenueSetting', row.id, before, row);
    return row;
  }

  @AdminOnly('ADMIN_FINANCE')
  @Delete('revenue-settings/:id')
  async deleteRevenue(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = must(await this.prisma.revenueSetting.findUnique({ where: { id } }), 'Setting');
    await this.prisma.revenueSetting.delete({ where: { id } });
    this.revenue.invalidate();
    await this.audit.log(u.id, 'REVENUE_SETTING_DELETED', 'RevenueSetting', id, row);
    return { ok: true };
  }

  // ------------------------------------------------------------------ users (ADM-08)

  @AdminOnly('ADMIN_OPS', 'ADMIN_SUPPORT')
  @Get('users')
  async users(@Query('q') q?: string, @Query('role') role?: string, @Query('page') p?: string) {
    const pg = page(p);
    const where = {
      status: { not: 'DELETED' },
      ...(role ? { roles: { some: { role: role as any } } } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { phone: { contains: q } }, { email: { contains: q, mode: 'insensitive' as const } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { id: true, name: true, phone: true, email: true, status: true, language: true, createdAt: true, roles: { select: { role: true, clinicId: true } } },
        orderBy: { createdAt: 'desc' },
        take: pg.take,
        skip: pg.skip,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: pg.page, pageSize: pg.pageSize };
  }

  @AdminOnly('ADMIN_OPS', 'ADMIN_SUPPORT')
  @Get('users/:id')
  async user(@Param('id') id: string) {
    const u = must(
      await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true, name: true, phone: true, email: true, status: true, blockedReason: true, language: true, createdAt: true, phoneVerifiedAt: true,
          roles: true,
          devices: { where: { revokedAt: null }, select: { id: true, name: true, platform: true, quickLoginMethod: true, lastSeenAt: true } },
          family: { where: { deletedAt: null } },
        },
      }),
      'User',
    );
    const [bookings, standing, audit] = await Promise.all([
      this.prisma.booking.findMany({
        where: { patientUserId: id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { instance: { select: { date: true, startTime: true, sitting: { select: { link: { select: { clinic: { select: { name: true } }, doctor: { select: { user: { select: { name: true } } } } } } } } } } },
      }),
      this.noShows.standing(id),
      this.prisma.auditLog.findMany({ where: { OR: [{ actorId: id }, { entityId: id }] }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    return { ...u, bookings, standing, audit };
  }

  @AdminOnly('ADMIN_OPS')
  @HttpCode(200)
  @Post('users/:id/action')
  async userAction(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(userAdminActionSchema)) dto: z.infer<typeof userAdminActionSchema>) {
    switch (dto.action) {
      case 'BLOCK':
        await this.prisma.user.update({ where: { id }, data: { status: 'BLOCKED', blockedReason: dto.reason ?? null } });
        await this.auth.revokeAllDevices(id);
        break;
      case 'UNBLOCK':
        await this.prisma.user.update({ where: { id }, data: { status: 'ACTIVE', blockedReason: null } });
        break;
      case 'FORCE_LOGOUT':
        await this.auth.revokeAllDevices(id);
        break;
      case 'RESET_QUICK_LOGIN':
        await this.prisma.device.updateMany({ where: { userId: id }, data: { quickLoginMethod: null, passcodeHash: null, deviceSecretHash: null, failedAttempts: 0 } });
        break;
    }
    await this.audit.log(u.id, `USER_${dto.action}`, 'User', id, undefined, dto);
    return { ok: true };
  }

  // ------------------------------------------------------------------ no-show blocks & rules (ADM-17)

  @AdminOnly('ADMIN_OPS', 'ADMIN_SUPPORT')
  @Get('blocks')
  async blocks(@Query('active') active?: string, @Query('scope') scope?: string, @Query('q') q?: string) {
    return this.prisma.patientBlock.findMany({
      where: {
        ...(active === 'false' ? { active: false } : active === 'all' ? {} : { active: true }),
        ...(scope ? { scope } : {}),
        ...(q ? { OR: [{ phone: { contains: q } }, { user: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
      },
      include: { user: { select: { id: true, name: true } }, clinic: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @AdminOnly('ADMIN_OPS')
  @HttpCode(200)
  @Post('blocks/:id/lift')
  lift(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(liftBlockSchema)) dto: z.infer<typeof liftBlockSchema>) {
    return this.noShows.lift(id, u.id, dto.reason);
  }

  @AdminOnly('ADMIN_OPS')
  @HttpCode(200)
  @Post('blocks/:id/reinstate')
  async reinstate(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(liftBlockSchema)) dto: z.infer<typeof liftBlockSchema>) {
    const b = await this.prisma.patientBlock.update({ where: { id }, data: { active: true, liftedAt: null, liftedById: null, liftReason: null } });
    await this.audit.log(u.id, 'BLOCK_REINSTATED', 'PatientBlock', id, undefined, { reason: dto.reason });
    return b;
  }

  @Get('rules')
  rules() {
    return this.settings.rules();
  }

  @AdminOnly('ADMIN_OPS')
  @Put('rules')
  async setRules(@CurrentUser() u: AuthUser, @Body(new Zod(ruleSettingsSchema)) dto: z.infer<typeof ruleSettingsSchema>) {
    const before = await this.settings.rules();
    const after = await this.settings.updateRules(dto);
    await this.audit.log(u.id, 'RULES_UPDATED', 'PlatformSetting', 'rules', before, after);
    return after;
  }

  // ------------------------------------------------------------------ audit (ADM-14)

  @AdminOnly('ADMIN_SUPER')
  @Get('audit')
  async auditLog(@Query('entity') entity?: string, @Query('entityId') entityId?: string, @Query('actorId') actorId?: string, @Query('page') p?: string) {
    const pg = page(p, '50');
    const where = { ...(entity ? { entity } : {}), ...(entityId ? { entityId } : {}), ...(actorId ? { actorId } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: pg.take, skip: pg.skip }),
      this.prisma.auditLog.count({ where }),
    ]);
    const actors = await this.prisma.user.findMany({ where: { id: { in: [...new Set(items.map((i) => i.actorId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } });
    return { items: items.map((i) => ({ ...i, actorName: actors.find((a) => a.id === i.actorId)?.name ?? (i.actorId ? 'Unknown' : 'System') })), total, page: pg.page, pageSize: pg.pageSize };
  }
}
