import { Global, Injectable, Module } from '@nestjs/common';
import { countsAsNoShow, evaluateNoShows, istDateTime, PaymentMode } from '@okidoc/shared';
import { forbidden, must } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService, SettingsService } from '../../common/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { todayIST } from '../scheduling/scheduling.service';

/**
 * BR-07 no-show tracking and blocking.
 *  - Only ONLINE bookings in PAY_AT_CLINIC mode count; counts are lifetime and never reset.
 *  - ≥ perClinic at one clinic → clinic block; ≥ total across clinics → platform block.
 *  - Blocks are keyed by the verified phone, so deleting the account doesn't clear them.
 */
@Injectable()
export class NoShowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly payments: PaymentsService,
  ) {}

  async counts(userId: string, clinicId?: string) {
    const [clinicCount, totalCount] = await Promise.all([
      clinicId ? this.prisma.noShowRecord.count({ where: { userId, clinicId, corrected: false } }) : Promise.resolve(0),
      this.prisma.noShowRecord.count({ where: { userId, corrected: false } }),
    ]);
    return { clinicCount, totalCount };
  }

  /** Active block that applies to this phone at this clinic (platform blocks apply everywhere). */
  async activeBlock(phone: string, clinicId?: string | null) {
    return this.prisma.patientBlock.findFirst({
      where: { phone, active: true, OR: [{ scope: 'PLATFORM' }, ...(clinicId ? [{ scope: 'CLINIC', clinicId }] : [])] },
      orderBy: { scope: 'desc' }, // PLATFORM before CLINIC
    });
  }

  /** Called when a booking becomes NO_SHOW. */
  async record(bookingId: string) {
    const b = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { patient: true, instance: { include: { sitting: { include: { link: { include: { clinic: true } } } } } } },
    });
    if (!b.patientUserId || !b.patient) return;
    const clinic = b.instance.sitting.link.clinic;
    if (!countsAsNoShow({ paymentMode: b.paymentMode as PaymentMode, source: b.source })) {
      // Paid online: no penalty, but the patient is still told they were marked absent (BR-12a).
      await this.notifications.notify(b.patientUserId, 'MARKED_ABSENT', { vars: { token: b.tokenNo, clinic: clinic.name }, data: { bookingId } });
      return;
    }
    await this.prisma.noShowRecord.upsert({
      where: { bookingId },
      create: { bookingId, userId: b.patientUserId, memberId: b.memberId, clinicId: clinic.id, date: b.instance.date },
      update: {},
    });
    await this.evaluate(b.patientUserId, b.patient.phone, clinic.id, clinic.name, b.tokenNo);
  }

  private async evaluate(userId: string, phone: string, clinicId: string, clinicName: string, token?: number) {
    const rules = await this.settings.rules();
    const { clinicCount, totalCount } = await this.counts(userId, clinicId);
    const ev = evaluateNoShows(clinicCount, totalCount, { perClinic: rules.noShowPerClinicLimit, total: rules.noShowTotalLimit });
    const vars = { token, clinic: clinicName, clinicCount, clinicLimit: rules.noShowPerClinicLimit, totalCount, totalLimit: rules.noShowTotalLimit };
    await this.notifications.notify(userId, 'NO_SHOW_RECORDED', { vars });

    if (ev.blockPlatform && !(await this.prisma.patientBlock.findFirst({ where: { phone, scope: 'PLATFORM', active: true } }))) {
      await this.createBlock(userId, phone, 'PLATFORM', null, totalCount, `${totalCount} missed visits across clinics`);
      await this.notifications.notify(userId, 'PATIENT_BLOCKED', { vars: { scope: 'Online booking is blocked on Okidoc', count: totalCount } });
      return;
    }
    if (ev.blockClinic && !(await this.prisma.patientBlock.findFirst({ where: { phone, scope: 'CLINIC', clinicId, active: true } }))) {
      await this.createBlock(userId, phone, 'CLINIC', clinicId, clinicCount, `${clinicCount} missed visits at ${clinicName}`);
      await this.notifications.notify(userId, 'PATIENT_BLOCKED', { vars: { scope: `Online booking at ${clinicName} is blocked`, count: clinicCount } });
      return;
    }
    if (ev.warnPlatform) {
      await this.notifications.notify(userId, 'NO_SHOW_WARNING', { vars: { scope: `${totalCount} of ${rules.noShowTotalLimit} allowed missed visits used on Okidoc` } });
    } else if (ev.warnClinic) {
      await this.notifications.notify(userId, 'NO_SHOW_WARNING', { vars: { scope: `${clinicCount} of ${rules.noShowPerClinicLimit} allowed missed visits used at ${clinicName}` } });
    }
  }

  /** BR-07b: create block and cancel future bookings in its scope. */
  private async createBlock(userId: string, phone: string, scope: 'CLINIC' | 'PLATFORM', clinicId: string | null, count: number, reason: string) {
    await this.prisma.patientBlock.create({ data: { userId, phone, scope, clinicId, reason, noShowCount: count } });
    const future = await this.prisma.booking.findMany({
      where: {
        patientUserId: userId,
        status: { in: ['BOOKED', 'PENDING_PAYMENT'] },
        instance: { date: { gte: todayIST() }, ...(clinicId ? { sitting: { link: { clinicId } } } : {}) },
      },
      include: { instance: { include: { sitting: { include: { link: true } } } } },
    });
    for (const fb of future) {
      await this.prisma.booking.update({
        where: { id: fb.id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'SYSTEM', cancelReason: 'Booking blocked after missed visits' },
      });
      const mins = Math.round((istDateTime(fb.instance.date, fb.instance.startTime).getTime() - Date.now()) / 60_000);
      // System cancellation: anything already paid online is returned in full.
      await this.payments.refundForCancellation(fb.id, 'SYSTEM', mins, fb.instance.sitting.link.clinicId);
    }
    await this.audit.log(null, 'BLOCK_CREATED', 'PatientBlock', null, undefined, { userId, scope, clinicId, count });
  }

  /** CLN-26 same-day correction: the patient actually attended. Auto-lifts automatic blocks that no longer apply. */
  async correct(bookingId: string, actorId: string) {
    const rec = await this.prisma.noShowRecord.findUnique({ where: { bookingId }, include: { user: true } });
    if (!rec) return;
    if (rec.date !== todayIST()) throw forbidden('No-shows can only be corrected on the same day. Ask Okidoc support.', 'CORRECTION_WINDOW');
    await this.prisma.noShowRecord.update({ where: { id: rec.id }, data: { corrected: true, correctedById: actorId } });
    const rules = await this.settings.rules();
    const { clinicCount, totalCount } = await this.counts(rec.userId, rec.clinicId);
    const lift = async (where: object, why: string) => {
      const blocks = await this.prisma.patientBlock.findMany({ where: { phone: rec.user.phone, active: true, liftedById: null, ...where } });
      for (const bl of blocks) {
        await this.prisma.patientBlock.update({ where: { id: bl.id }, data: { active: false, liftedAt: new Date(), liftedById: actorId, liftReason: why } });
        await this.notifications.notify(rec.userId, 'BLOCK_LIFTED', { vars: { scope: '' } });
      }
    };
    if (clinicCount < rules.noShowPerClinicLimit) await lift({ scope: 'CLINIC', clinicId: rec.clinicId }, 'No-show corrected by clinic');
    if (totalCount < rules.noShowTotalLimit) await lift({ scope: 'PLATFORM' }, 'No-show corrected by clinic');
    await this.audit.log(actorId, 'NO_SHOW_CORRECTED', 'Booking', bookingId);
  }

  /** ADM-17 / CLN-27 lift a block with a reason (counts stay on record). */
  async lift(blockId: string, actorId: string, reason: string, asClinicId?: string) {
    const block = must(await this.prisma.patientBlock.findUnique({ where: { id: blockId }, include: { clinic: true } }), 'Block');
    if (asClinicId) {
      const rules = await this.settings.rules();
      if (!rules.clinicCanLiftBlocks) throw forbidden('Only Okidoc can lift blocks. Ask the patient to appeal via support.', 'CLINIC_LIFT_DISABLED');
      if (block.scope !== 'CLINIC' || block.clinicId !== asClinicId) throw forbidden('Clinics can only lift blocks at their own clinic');
    }
    const updated = await this.prisma.patientBlock.update({
      where: { id: blockId },
      data: { active: false, liftedAt: new Date(), liftedById: actorId, liftReason: reason },
    });
    if (block.userId) {
      await this.notifications.notify(block.userId, 'BLOCK_LIFTED', { vars: { scope: block.scope === 'CLINIC' && block.clinic ? ` at ${block.clinic.name}` : '' } });
    }
    await this.audit.log(actorId, 'BLOCK_LIFTED', 'PatientBlock', blockId, block, updated);
    return updated;
  }

  /** PAT-19 standing shown in the patient's Account. */
  async standing(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const rules = await this.settings.rules();
    const records = await this.prisma.noShowRecord.findMany({ where: { userId, corrected: false }, include: { clinic: { select: { id: true, name: true } } } });
    const byClinic = new Map<string, { clinicId: string; clinicName: string; count: number }>();
    for (const r of records) {
      const e = byClinic.get(r.clinicId) ?? { clinicId: r.clinicId, clinicName: r.clinic.name, count: 0 };
      e.count++;
      byClinic.set(r.clinicId, e);
    }
    const blocks = await this.prisma.patientBlock.findMany({ where: { phone: user.phone, active: true }, include: { clinic: { select: { name: true } } } });
    return {
      total: records.length,
      limits: { perClinic: rules.noShowPerClinicLimit, total: rules.noShowTotalLimit },
      clinics: [...byClinic.values()],
      blocks: blocks.map((b) => ({ id: b.id, scope: b.scope, clinicId: b.clinicId, clinicName: b.clinic?.name ?? null, reason: b.reason, since: b.createdAt })),
    };
  }
}

@Global()
@Module({ providers: [NoShowService], exports: [NoShowService] })
export class NoShowModule {}
