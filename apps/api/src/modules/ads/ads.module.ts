import { Body, Controller, Get, HttpCode, Injectable, Module, Post, Query } from '@nestjs/common';
import { AD_PLACEMENTS, AdPlacementKey } from '@okidoc/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Public } from '../../common/auth';
import { Zod } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { RevenueService } from '../platform/platform.services';

export type AdSlot =
  | { enabled: false; reason: string }
  | {
      enabled: true;
      type: 'HOUSE';
      placement: AdPlacementKey;
      frequencyCapPerDay: number;
      campaign: { id: string; advertiser: string; title: string; body: string | null; imageUrl: string | null; ctaLabel: string | null; ctaUrl: string | null };
    }
  | { enabled: true; type: 'ADMOB'; placement: AdPlacementKey; frequencyCapPerDay: number; unitId: string | null };

/**
 * MON-02/03 ad serving. Ads appear only in the patient app and never on ad-free screens (enforced client-side
 * by placement keys; there are no keys for queue/checkout/OTP/passcode/records screens).
 * Direct sponsored (house) campaigns are served first; otherwise the app falls back to AdMob.
 */
@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revenue: RevenueService,
    private readonly settings: SettingsService,
  ) {}

  async slot(placement: AdPlacementKey, areaId: string | undefined, platform: string | undefined): Promise<AdSlot> {
    let regionId: string | null = null;
    if (areaId) regionId = (await this.prisma.area.findUnique({ where: { id: areaId }, select: { regionId: true } }))?.regionId ?? null;
    if (!(await this.revenue.enabled('ADS', { regionId }))) return { enabled: false, reason: 'ADS_OFF' };
    const p = await this.prisma.adPlacement.findUnique({ where: { key: placement } });
    if (p && !p.enabled) return { enabled: false, reason: 'PLACEMENT_OFF' };
    const source = p?.source ?? 'HOUSE_THEN_ADMOB';
    const cap = p?.frequencyCapPerDay ?? 0;
    if (source !== 'ADMOB') {
      const rules = await this.settings.rules();
      const now = new Date();
      const campaigns = await this.prisma.adCampaign.findMany({
        where: {
          active: true,
          placements: { has: placement },
          startsAt: { lte: now },
          endsAt: { gte: now },
          category: { notIn: rules.blockedAdCategories },
          OR: [{ areaIds: { isEmpty: true } }, ...(areaId ? [{ areaIds: { has: areaId } }] : [])],
        },
        orderBy: { priority: 'desc' },
        take: 10,
      });
      if (campaigns.length) {
        // Weighted pick among the top-priority campaigns.
        const top = campaigns.filter((c) => c.priority === campaigns[0].priority);
        const c = top[Math.floor(Math.random() * top.length)];
        return {
          enabled: true,
          type: 'HOUSE',
          placement,
          frequencyCapPerDay: cap,
          campaign: { id: c.id, advertiser: c.advertiser, title: c.title, body: c.body, imageUrl: c.imageUrl, ctaLabel: c.ctaLabel, ctaUrl: c.ctaUrl },
        };
      }
      if (source === 'HOUSE') return { enabled: false, reason: 'NO_FILL' };
    }
    const unitId = platform === 'ios' ? p?.admobUnitIos : p?.admobUnitAndroid;
    return { enabled: true, type: 'ADMOB', placement, frequencyCapPerDay: cap, unitId: unitId ?? null };
  }

  async event(userId: string | null, e: { placement: string; type: 'IMPRESSION' | 'CLICK'; campaignId?: string | null; source?: string }) {
    await this.prisma.adEvent.create({ data: { userId, placement: e.placement, type: e.type, campaignId: e.campaignId ?? null, source: e.source ?? 'HOUSE' } });
    if (e.campaignId) {
      await this.prisma.adCampaign.updateMany({
        where: { id: e.campaignId },
        data: e.type === 'CLICK' ? { clicks: { increment: 1 } } : { impressions: { increment: 1 } },
      });
    }
    return { ok: true };
  }
}

const eventSchema = z.object({
  placement: z.enum(AD_PLACEMENTS),
  type: z.enum(['IMPRESSION', 'CLICK']),
  campaignId: z.string().optional().nullable(),
  source: z.enum(['HOUSE', 'ADMOB']).default('HOUSE'),
});

@Public()
@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Get('slot')
  slot(@Query('placement') placement: AdPlacementKey, @Query('areaId') areaId?: string, @Query('platform') platform?: string) {
    if (!AD_PLACEMENTS.includes(placement)) return { enabled: false, reason: 'UNKNOWN_PLACEMENT' };
    return this.ads.slot(placement, areaId, platform);
  }

  @HttpCode(200)
  @Post('events')
  event(@CurrentUser() u: AuthUser | undefined, @Body(new Zod(eventSchema)) dto: z.infer<typeof eventSchema>) {
    return this.ads.event(u?.id ?? null, dto);
  }
}

@Module({ controllers: [AdsController], providers: [AdsService] })
export class AdsModule {}
