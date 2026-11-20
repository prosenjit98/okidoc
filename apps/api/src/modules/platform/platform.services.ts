import { Global, Injectable, Module } from '@nestjs/common';
import {
  Entitlements,
  FeatureKey,
  FeeRules,
  LimitKey,
  PaymentConfigLayer,
  PaymentMode,
  RevenueSettingLayer,
  RevenueStream,
  ResolvedPaymentMode,
  entitledPaymentModes,
  isRevenueStreamEnabled,
  resolveEntitlements,
  resolvePaymentMode,
} from '@okidoc/shared';
import { AppError, forbidden } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { RealtimeService } from '../realtime/realtime.gateway';

/** ADM-02 clinic feature entitlements (plan + per-clinic overrides). */
@Injectable()
export class EntitlementsService {
  private cache = new Map<string, { at: number; value: Entitlements & { planId: string | null; planCode: string | null } }>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeService,
  ) {}

  async forClinic(clinicId: string) {
    const hit = this.cache.get(clinicId);
    if (hit && Date.now() - hit.at < 10_000) return hit.value;
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId }, include: { plan: true, featureOverrides: true } });
    let plan = clinic?.plan ?? null;
    if (!plan) {
      const code = await this.settings.get<string>('defaultPlanCode', 'FREE');
      plan = await this.prisma.plan.findUnique({ where: { code } });
    }
    const resolved = resolveEntitlements(
      (plan?.features as Partial<Record<FeatureKey, boolean>>) ?? {},
      (plan?.limits as Partial<Record<LimitKey, number | null>>) ?? {},
      clinic?.featureOverrides ?? [],
    );
    const value = { ...resolved, planId: plan?.id ?? null, planCode: plan?.code ?? null };
    this.cache.set(clinicId, { at: Date.now(), value });
    return value;
  }

  async has(clinicId: string, feature: FeatureKey) {
    return (await this.forClinic(clinicId)).features[feature];
  }

  /** Throws a 403 with code FEATURE_LOCKED when the clinic is not entitled (BR-11). */
  async require(clinicId: string, feature: FeatureKey) {
    if (!(await this.has(clinicId, feature))) {
      throw new AppError(403, 'FEATURE_LOCKED', 'This feature is not enabled for your clinic. Contact Okidoc to enable it.', { feature });
    }
  }

  async requireWithinLimit(clinicId: string, limit: LimitKey, current: number) {
    const max = (await this.forClinic(clinicId)).limits[limit];
    if (max != null && current >= max) {
      throw new AppError(403, 'LIMIT_REACHED', `Your plan allows up to ${max}. Contact Okidoc or upgrade your plan.`, { limit, max });
    }
  }

  invalidate(clinicId?: string) {
    if (clinicId) {
      this.cache.delete(clinicId);
      this.realtime.emitClinic(clinicId, 'entitlements:changed', { clinicId });
    } else this.cache.clear();
  }
}

/** MON-01 revenue stream switches. */
@Injectable()
export class RevenueService {
  private cache: { at: number; layers: RevenueSettingLayer[] } | null = null;
  constructor(private readonly prisma: PrismaService) {}

  async layers(): Promise<RevenueSettingLayer[]> {
    if (this.cache && Date.now() - this.cache.at < 15_000) return this.cache.layers;
    const rows = await this.prisma.revenueSetting.findMany();
    const layers = rows.map((r) => ({
      stream: r.stream as RevenueStream,
      scope: r.scope as RevenueSettingLayer['scope'],
      scopeId: r.scopeId === 'GLOBAL' ? null : r.scopeId,
      enabled: r.enabled,
      effectiveFrom: r.effectiveFrom,
    }));
    this.cache = { at: Date.now(), layers };
    return layers;
  }

  async enabled(stream: RevenueStream, ctx: { regionId?: string | null; clinicId?: string | null } = {}) {
    return isRevenueStreamEnabled(await this.layers(), stream, ctx);
  }

  invalidate() {
    this.cache = null;
  }
}

export interface PaymentContext {
  clinicId: string;
  regionId: string | null;
  linkId?: string | null;
  sittingId?: string | null;
}

/** BR-09 layered payment configuration + fee rules. */
@Injectable()
export class PaymentConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly revenue: RevenueService,
    private readonly settings: SettingsService,
  ) {}

  async rows(ctx: PaymentContext) {
    const or: { scope: string; scopeId: string }[] = [
      { scope: 'PLATFORM', scopeId: 'GLOBAL' },
      { scope: 'CLINIC', scopeId: ctx.clinicId },
    ];
    if (ctx.regionId) or.push({ scope: 'REGION', scopeId: ctx.regionId });
    if (ctx.linkId) or.push({ scope: 'DOCTOR', scopeId: ctx.linkId });
    if (ctx.sittingId) or.push({ scope: 'SITTING', scopeId: ctx.sittingId });
    return this.prisma.paymentConfig.findMany({ where: { OR: or } });
  }

  async resolve(ctx: PaymentContext): Promise<ResolvedPaymentMode & { fees: FeeRules; refundMinutes: number }> {
    const rows = await this.rows(ctx);
    const ent = await this.entitlements.forClinic(ctx.clinicId);
    const layers: PaymentConfigLayer[] = rows.map((r) => ({
      scope: r.scope as PaymentConfigLayer['scope'],
      allowedModes: ['PLATFORM', 'REGION', 'CLINIC'].includes(r.scope) && r.allowedModes.length ? (r.allowedModes as PaymentMode[]) : null,
      selectedMode: (r.selectedMode as PaymentMode) ?? null,
      locked: ['PLATFORM', 'REGION', 'CLINIC'].includes(r.scope) ? r.locked : false,
    }));
    const resolved = resolvePaymentMode(layers, entitledPaymentModes(ent.features));
    const order = ['PLATFORM', 'REGION', 'CLINIC'];
    const pick = <K extends 'bookingFeePaise' | 'commissionPercent' | 'commissionFlatPaise' | 'taxPercent' | 'patientFullRefundMinutes'>(k: K) => {
      let v: number | null = null;
      for (const s of order) {
        const r = rows.find((x) => x.scope === s);
        if (r && r[k] != null) v = r[k] as number;
      }
      return v;
    };
    const rules = await this.settings.rules();
    const fees: FeeRules = {
      bookingFeePaise: pick('bookingFeePaise') ?? 0,
      bookingFeeEnabled: await this.revenue.enabled('BOOKING_FEE', { clinicId: ctx.clinicId, regionId: ctx.regionId }),
      commissionPercent: pick('commissionPercent') ?? 0,
      commissionFlatPaise: pick('commissionFlatPaise') ?? 0,
      commissionEnabled: await this.revenue.enabled('COMMISSION', { clinicId: ctx.clinicId, regionId: ctx.regionId }),
      taxPercent: pick('taxPercent') ?? 18,
    };
    return { ...resolved, fees, refundMinutes: pick('patientFullRefundMinutes') ?? rules.patientFullRefundMinutes };
  }

  /** Admin lock check before a clinic changes CLINIC / DOCTOR / SITTING selections (PAY-03). */
  async assertClinicMayChoose(clinicId: string, regionId: string | null, mode: PaymentMode | null) {
    const rows = await this.rows({ clinicId, regionId });
    const locked = rows.find((r) => ['PLATFORM', 'REGION', 'CLINIC'].includes(r.scope) && r.locked);
    if (locked) throw new AppError(403, 'PAYMENT_LOCKED', 'Payment mode is set by Okidoc for your clinic', { lockedBy: locked.scope });
    if (mode) {
      const { allowedModes } = await this.resolve({ clinicId, regionId });
      if (!allowedModes.includes(mode)) throw forbidden('That payment mode is not allowed for your clinic', 'MODE_NOT_ALLOWED');
    }
  }
}

@Global()
@Module({ providers: [EntitlementsService, RevenueService, PaymentConfigService], exports: [EntitlementsService, RevenueService, PaymentConfigService] })
export class PlatformModule {}
