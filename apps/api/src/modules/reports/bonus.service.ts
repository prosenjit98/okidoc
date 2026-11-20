import { Global, Injectable, Module } from '@nestjs/common';
import { BonusCampaign } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { istDateTime } from '@okidoc/shared';

/** CLN-23 / ADM-09 Bonuses & Prizes progress. */
@Injectable()
export class BonusService {
  constructor(private readonly prisma: PrismaService) {}

  async progress(campaign: BonusCampaign, clinicId: string) {
    const range = { gte: campaign.startsAt, lte: campaign.endsAt };
    let achieved = 0;
    if (campaign.metric === 'PATIENTS_SERVED') {
      achieved = await this.prisma.booking.count({ where: { status: 'SERVED', instance: { date: range, sitting: { link: { clinicId } } } } });
    } else if (campaign.metric === 'ONLINE_BOOKINGS') {
      achieved = await this.prisma.booking.count({
        where: { source: 'ONLINE', status: { in: ['SERVED', 'BOOKED', 'PRESENT', 'IN_CONSULTATION'] }, instance: { date: range, sitting: { link: { clinicId } } } },
      });
    } else if (campaign.metric === 'DOCTORS_ADDED') {
      achieved = await this.prisma.clinicDoctorLink.count({
        where: {
          clinicId,
          status: 'APPROVED',
          createdAt: { gte: istDateTime(campaign.startsAt, '00:00'), lte: istDateTime(campaign.endsAt, '23:59') },
        },
      });
    }
    return { achieved, target: campaign.target, completed: achieved >= campaign.target, payablePaise: achieved >= campaign.target ? campaign.rewardPaise : 0 };
  }

  async forClinic(clinicId: string) {
    const campaigns = await this.prisma.bonusCampaign.findMany({
      where: { active: true, OR: [{ clinicIds: { isEmpty: true } }, { clinicIds: { has: clinicId } }] },
      include: { payouts: { where: { clinicId } } },
      orderBy: { endsAt: 'desc' },
    });
    const items = [];
    for (const c of campaigns) {
      const p = await this.progress(c, clinicId);
      items.push({
        id: c.id,
        name: c.name,
        description: c.description,
        metric: c.metric,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        rewardPaise: c.rewardPaise,
        ...p,
        payoutStatus: c.payouts[0]?.status ?? null,
      });
    }
    const summary = {
      patients: items.filter((i) => i.metric === 'PATIENTS_SERVED').reduce((a, i) => a + i.achieved, 0),
      doctorsCompleted: items.filter((i) => i.metric === 'DOCTORS_ADDED').reduce((a, i) => a + i.achieved, 0),
      payablePaise: items.filter((i) => i.payoutStatus !== 'PAID').reduce((a, i) => a + i.payablePaise, 0),
    };
    return { summary, campaigns: items };
  }
}

@Global()
@Module({ providers: [BonusService], exports: [BonusService] })
export class BonusModule {}
