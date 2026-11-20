import { Global, Injectable, Module } from '@nestjs/common';
import { addDays, computeShares } from '@okidoc/shared';
import { PrismaService } from '../../common/prisma.service';
import { PaymentConfigService } from '../platform/platform.services';
import { todayIST } from '../scheduling/scheduling.service';

/** DOC-09 / CLN-17 earnings: per chamber & per sitting, from served visits. */
@Injectable()
export class EarningsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentConfig: PaymentConfigService,
  ) {}

  async compute(filter: { doctorId?: string; clinicId?: string }, from?: string, to?: string) {
    const toDate = to ?? todayIST();
    const fromDate = from ?? addDays(toDate, -29);
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: 'SERVED',
        instance: {
          date: { gte: fromDate, lte: toDate },
          sitting: { link: { ...(filter.doctorId ? { doctorId: filter.doctorId } : {}), ...(filter.clinicId ? { clinicId: filter.clinicId } : {}) } },
        },
      },
      include: {
        instance: {
          include: {
            sitting: {
              include: { link: { include: { clinic: { select: { id: true, name: true, area: { select: { regionId: true } } } }, doctor: { select: { id: true, user: { select: { name: true } } } } } } },
            },
          },
        },
      },
    });
    const feeCache = new Map<string, Awaited<ReturnType<PaymentConfigService['resolve']>>['fees']>();
    const totals = { visits: 0, gross: 0, clinicShare: 0, doctorShare: 0, commission: 0, collectedOnline: 0, collectedAtClinic: 0, uncollected: 0 };
    const byLink = new Map<string, any>();
    const bySitting = new Map<string, any>();
    for (const b of bookings) {
      const link = b.instance.sitting.link;
      if (!feeCache.has(link.clinicId)) {
        feeCache.set(link.clinicId, (await this.paymentConfig.resolve({ clinicId: link.clinicId, regionId: link.clinic.area.regionId })).fees);
      }
      const s = computeShares(b.consultationFee, link.clinicSplitPercent, feeCache.get(link.clinicId)!);
      const online = b.paymentMode === 'ONLINE_FULL' ? b.consultationFee : 0;
      const atClinic = b.paidAtClinic ? b.consultationFee : 0;
      const add = (t: any) => {
        t.visits++;
        t.gross += b.consultationFee;
        t.clinicShare += s.clinicShare;
        t.doctorShare += s.doctorShare;
        t.commission += s.commission;
        t.collectedOnline += online;
        t.collectedAtClinic += atClinic;
        t.uncollected += online || atClinic ? 0 : b.consultationFee;
      };
      add(totals);
      const lk = byLink.get(link.id) ?? {
        linkId: link.id,
        clinicId: link.clinicId,
        clinicName: link.clinic.name,
        doctorId: link.doctorId,
        doctorName: link.doctor.user.name,
        fee: link.consultationFee,
        clinicSplitPercent: link.clinicSplitPercent,
        ...{ visits: 0, gross: 0, clinicShare: 0, doctorShare: 0, commission: 0, collectedOnline: 0, collectedAtClinic: 0, uncollected: 0 },
      };
      add(lk);
      byLink.set(link.id, lk);
      const sk = b.instanceId;
      const si = bySitting.get(sk) ?? {
        instanceId: b.instanceId,
        date: b.instance.date,
        startTime: b.instance.startTime,
        endTime: b.instance.endTime,
        clinicName: link.clinic.name,
        doctorName: link.doctor.user.name,
        ...{ visits: 0, gross: 0, clinicShare: 0, doctorShare: 0, commission: 0, collectedOnline: 0, collectedAtClinic: 0, uncollected: 0 },
      };
      add(si);
      bySitting.set(sk, si);
    }
    return {
      from: fromDate,
      to: toDate,
      totals,
      chambers: [...byLink.values()],
      sittings: [...bySitting.values()].sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime)),
    };
  }
}

@Global()
@Module({ providers: [EarningsService], exports: [EarningsService] })
export class ReportsModule {}
