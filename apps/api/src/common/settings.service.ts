import { Global, Injectable, Module } from '@nestjs/common';
import { DEFAULT_RULES, RuleSettings } from '@okidoc/shared';
import { PrismaService } from './prisma.service';

export const DEFAULT_BLOCKED_AD_CATEGORIES = ['PRESCRIPTION_DRUGS', 'ALCOHOL', 'TOBACCO', 'BETTING', 'MIRACLE_CURES', 'DATING'];

export type Rules = RuleSettings & { blockedAdCategories: string[] };

/** Admin-configurable business rules (ADM-17 thresholds etc.), cached briefly. */
@Injectable()
export class SettingsService {
  private cache: { at: number; rules: Rules } | null = null;
  constructor(private readonly prisma: PrismaService) {}

  async rules(): Promise<Rules> {
    if (this.cache && Date.now() - this.cache.at < 15_000) return this.cache.rules;
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'rules' } });
    const rules = {
      ...DEFAULT_RULES,
      blockedAdCategories: DEFAULT_BLOCKED_AD_CATEGORIES,
      ...((row?.value as object) ?? {}),
    } as Rules;
    this.cache = { at: Date.now(), rules };
    return rules;
  }

  async updateRules(patch: Partial<Rules>): Promise<Rules> {
    const current = await this.rules();
    const next = { ...current, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
    await this.prisma.platformSetting.upsert({
      where: { key: 'rules' },
      create: { key: 'rules', value: next as object },
      update: { value: next as object },
    });
    this.cache = null;
    return next as Rules;
  }

  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    return (row?.value as T) ?? fallback;
  }

  async set(key: string, value: unknown) {
    await this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: value as object },
      update: { value: value as object },
    });
  }
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async log(actorId: string | null, action: string, entity: string, entityId?: string | null, before?: unknown, after?: unknown) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId: entityId ?? null,
        before: before === undefined ? undefined : JSON.parse(JSON.stringify(before)),
        after: after === undefined ? undefined : JSON.parse(JSON.stringify(after)),
      },
    });
  }
}

/** Simple fixed-window in-memory rate limiter (per process). */
@Injectable()
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  /** Returns true if allowed. */
  allow(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const h = this.hits.get(key);
    if (!h || h.resetAt < now) {
      this.hits.set(key, { count: 1, resetAt: now + windowMs });
      if (this.hits.size > 50_000) this.gc(now);
      return true;
    }
    h.count++;
    return h.count <= limit;
  }
  private gc(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt < now) this.hits.delete(k);
  }
}

@Global()
@Module({ providers: [SettingsService, AuditService, RateLimiter], exports: [SettingsService, AuditService, RateLimiter] })
export class CommonModule {}
