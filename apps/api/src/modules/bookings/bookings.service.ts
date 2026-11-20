import { Injectable } from '@nestjs/common';
import {
  ACTIVE_BOOKING_STATUSES,
  CreateBookingInput,
  QuoteView,
  checkBookable,
  computeFeeBreakdown,
  effectiveBookingWindowHours,
  istDateTime,
  patientCanCancel,
} from '@okidoc/shared';
import { AppError, bad, forbidden, must } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { NoShowService } from '../noshow/noshow.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { EntitlementsService, PaymentConfigService } from '../platform/platform.services';
import { QueueService } from '../queue/queue.service';
import { RealtimeService } from '../realtime/realtime.gateway';
import { SchedulingService, todayIST } from '../scheduling/scheduling.service';

const BOOKING_REASONS: Record<string, string> = {
  TOO_EARLY: 'Booking for this sitting has not opened yet',
  CUTOFF_PASSED: 'Online booking for this sitting has closed',
  FULL: 'This sitting is full',
  ENDED: 'This sitting has ended',
  CANCELLED: 'This sitting has been cancelled',
  CLOSED: 'The clinic has stopped online bookings for this sitting',
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
    private readonly paymentConfig: PaymentConfigService,
    private readonly entitlements: EntitlementsService,
    private readonly payments: PaymentsService,
    private readonly noShows: NoShowService,
    private readonly queue: QueueService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly settings: SettingsService,
  ) {}

  private async sittingCtx(sittingId: string) {
    return must(
      await this.prisma.sitting.findUnique({
        where: { id: sittingId },
        include: { link: { include: { clinic: { include: { area: true } }, doctor: { include: { user: { select: { name: true } } } } } } },
      }),
      'Sitting',
    );
  }

  /** PAT-10 / PAY-04: what booking this sitting would cost and whether it is possible. */
  async quote(userId: string, sittingId: string, date: string): Promise<QuoteView & { instanceId: string | null }> {
    const s = await this.sittingCtx(sittingId);
    const link = s.link;
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const rules = await this.settings.rules();
    const instance = await this.scheduling.ensureInstance(sittingId, date);
    const booked = await this.prisma.booking.count({ where: { instanceId: instance.id, status: { notIn: ['CANCELLED'] } } });
    let bookable: string = checkBookable({
      now: new Date(),
      sittingStart: istDateTime(date, instance.startTime),
      sittingEnd: istDateTime(date, instance.endTime),
      windowHours: effectiveBookingWindowHours(link.doctor.defaultBookingWindowHours, link.clinic.bookingWindowHours),
      cutoffMinutes: link.clinic.cutoffMinutes ?? rules.defaultCutoffMinutes,
      bookedCount: booked,
      maxPatients: s.maxPatients,
      status: instance.status,
    });
    if (bookable === 'OK' && !instance.bookingsOpen) bookable = 'CLOSED';
    if (link.status !== 'APPROVED' || link.clinic.verification !== 'APPROVED' || link.doctor.verification !== 'APPROVED') bookable = 'NOT_VERIFIED';
    if (bookable === 'OK' && !(await this.entitlements.has(link.clinicId, 'ONLINE_BOOKING'))) bookable = 'ONLINE_BOOKING_OFF';
    const resolved = await this.paymentConfig.resolve({ clinicId: link.clinicId, regionId: link.clinic.area.regionId, linkId: link.id, sittingId });
    const breakdown = computeFeeBreakdown(link.consultationFee, resolved.mode, resolved.fees);
    const block = await this.noShows.activeBlock(user.phone, link.clinicId);
    return {
      instanceId: instance.id,
      bookable,
      paymentMode: resolved.mode,
      allowedModes: resolved.allowedModes,
      lockedBy: resolved.lockedBy,
      breakdown,
      blocked: block ? { scope: block.scope as 'CLINIC' | 'PLATFORM', reason: block.reason } : null,
    };
  }

  /** PAT-10: create the booking (BR-05, BR-07b, BR-14, BR-15). */
  async create(userId: string, dto: CreateBookingInput) {
    const q = await this.quote(userId, dto.sittingId, dto.date);
    if (q.blocked) {
      throw new AppError(403, 'PATIENT_BLOCKED', q.blocked.scope === 'PLATFORM'
        ? 'Online booking is blocked on your account after repeated missed visits. You can still visit as a walk-in, or appeal via Contact & support.'
        : 'Online booking at this clinic is blocked after repeated missed visits. You can still visit as a walk-in, or appeal via Contact & support.');
    }
    if (q.bookable !== 'OK') throw bad(q.bookable, BOOKING_REASONS[q.bookable] ?? 'This sitting cannot be booked online');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    // BR-15: only the account holder or a saved family member.
    let patientName = user.name;
    if (dto.memberId) {
      const m = await this.prisma.familyMember.findFirst({ where: { id: dto.memberId, ownerId: userId, deletedAt: null } });
      if (!m) throw forbidden('You can only book for yourself or a family member saved on your profile', 'MEMBER_NOT_FOUND');
      patientName = m.name;
    }

    const rules = await this.settings.rules();
    const active = await this.prisma.booking.count({
      where: { patientUserId: userId, status: { in: ACTIVE_BOOKING_STATUSES }, instance: { date: { gte: todayIST() } } },
    });
    if (active >= rules.maxActiveBookings) {
      throw bad('MAX_ACTIVE_BOOKINGS', `You can hold at most ${rules.maxActiveBookings} active bookings. Cancel one or wait until a visit is done.`);
    }
    const dup = await this.prisma.booking.findFirst({
      where: { instanceId: q.instanceId!, patientUserId: userId, memberId: dto.memberId ?? null, status: { in: ACTIVE_BOOKING_STATUSES } },
    });
    if (dup) throw bad('ALREADY_BOOKED', `${patientName} already has token #${dup.tokenNo} for this sitting`);

    const s = await this.sittingCtx(dto.sittingId);
    const needsPayment = q.breakdown.payableNow > 0;
    let sharedRecordIds: string[] = [];
    if (dto.sharedRecordIds?.length) {
      sharedRecordIds = (await this.prisma.record.findMany({ where: { id: { in: dto.sharedRecordIds }, ownerId: userId, deletedAt: null }, select: { id: true } })).map((r) => r.id);
    }
    const booking = await this.queue.createWithToken(q.instanceId!, 'ONLINE', {
      patientUserId: userId,
      memberId: dto.memberId ?? null,
      patientName,
      patientPhone: user.phone,
      status: needsPayment ? 'PENDING_PAYMENT' : 'BOOKED',
      paymentMode: q.paymentMode,
      consultationFee: q.breakdown.consultationFee,
      bookingFee: q.breakdown.bookingFee,
      tax: q.breakdown.tax,
      payableNow: q.breakdown.payableNow,
      note: dto.note,
      createdById: userId,
      holdExpiresAt: needsPayment ? new Date(Date.now() + rules.paymentHoldMinutes * 60_000) : null,
    });
    if (sharedRecordIds.length) {
      await this.prisma.booking.update({ where: { id: booking.id }, data: { sharedRecords: { connect: sharedRecordIds.map((id) => ({ id })) } } });
    }
    let payment = null;
    if (needsPayment) {
      payment = await this.payments.createOrder('BOOKING', q.breakdown.payableNow, { bookingId: booking.id, clinicId: s.link.clinicId });
    } else {
      await this.notifications.notify(userId, 'BOOKING_CONFIRMED', {
        vars: { token: booking.tokenNo, doctor: `Dr. ${s.link.doctor.user.name}`, clinic: s.link.clinic.name, date: dto.date, time: s.startTime },
        data: { bookingId: booking.id },
      });
    }
    this.realtime.emitClinic(s.link.clinicId, 'bookings:changed', { instanceId: booking.instanceId });
    await this.queue.changed(booking.instanceId);
    return { booking: await this.view(booking.id), payment, breakdown: q.breakdown };
  }

  async view(bookingId: string) {
    const b = must(
      await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          review: { select: { rating: true, clinicRating: true, comment: true } },
          payments: { select: { id: true, status: true, amountPaise: true, refundedPaise: true, gatewayOrderId: true, gateway: true } },
          instance: {
            include: {
              sitting: {
                include: {
                  link: {
                    include: {
                      clinic: { select: { id: true, name: true, addressLine: true, phone: true, lat: true, lng: true, area: { select: { name: true } } } },
                      doctor: { select: { id: true, degrees: true, user: { select: { name: true } }, specialties: { select: { name: true, patientName: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      'Booking',
    );
    const link = b.instance.sitting.link;
    return {
      id: b.id,
      tokenNo: b.tokenNo,
      status: b.status,
      source: b.source,
      patientName: b.patientName,
      memberId: b.memberId,
      paymentMode: b.paymentMode,
      consultationFee: b.consultationFee,
      bookingFee: b.bookingFee,
      tax: b.tax,
      payableNow: b.payableNow,
      paidOnline: b.paidOnline,
      holdExpiresAt: b.holdExpiresAt,
      note: b.note,
      cancelReason: b.cancelReason,
      cancelledBy: b.cancelledBy,
      createdAt: b.createdAt,
      reviewed: !!b.review,
      review: b.review,
      payments: b.payments,
      instance: {
        id: b.instance.id,
        date: b.instance.date,
        startTime: b.instance.startTime,
        endTime: b.instance.endTime,
        status: b.instance.status,
        presence: b.instance.presence,
        delayMinutes: b.instance.delayMinutes,
        nowServing: b.instance.nowServingToken,
      },
      clinic: link.clinic,
      doctor: { id: link.doctor.id, name: link.doctor.user.name, degrees: link.doctor.degrees, specialties: link.doctor.specialties },
    };
  }

  async listMine(userId: string, scope: 'upcoming' | 'past' | 'all' = 'all') {
    const today = todayIST();
    const rows = await this.prisma.booking.findMany({
      where: {
        patientUserId: userId,
        ...(scope === 'upcoming'
          ? { status: { in: ACTIVE_BOOKING_STATUSES }, instance: { date: { gte: today } } }
          : scope === 'past'
            ? { OR: [{ status: { in: ['SERVED', 'NO_SHOW', 'CANCELLED'] } }, { instance: { date: { lt: today } } }] }
            : {}),
      },
      orderBy: [{ instance: { date: scope === 'past' ? 'desc' : 'asc' } }, { tokenNo: 'asc' }],
      take: 100,
      select: { id: true },
    });
    return Promise.all(rows.map((r) => this.view(r.id)));
  }

  /** PAT-13: patient cancels (refund per BR-12; never counts as a no-show). */
  async cancel(userId: string, bookingId: string, reason?: string) {
    const b = must(await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { instance: { include: { sitting: { include: { link: true } } } } } }), 'Booking');
    if (b.patientUserId !== userId) throw forbidden();
    if (!['BOOKED', 'PENDING_PAYMENT', 'PRESENT', 'LATE'].includes(b.status)) throw bad('BAD_STATE', 'This booking can no longer be cancelled');
    const start = istDateTime(b.instance.date, b.instance.startTime);
    const end = istDateTime(b.instance.date, b.instance.endTime);
    if (end.getTime() < Date.now()) throw bad('BAD_STATE', 'This sitting is over');
    // BR-12a: no patient cancellation once the doctor's sitting has started; a missed visit is marked absent.
    if (!patientCanCancel({ now: new Date(), sittingStart: start, sittingEnd: end, sittingStatus: b.instance.status, bookingStatus: b.status })) {
      throw bad('CANCEL_CLOSED', "The doctor's sitting has started, so this booking can no longer be cancelled. If you do not visit, you will be marked absent.");
    }
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'PATIENT', cancelReason: reason ?? 'Cancelled by patient', holdExpiresAt: null },
    });
    const minutes = Math.round((start.getTime() - Date.now()) / 60_000);
    const refunded = await this.payments.refundForCancellation(bookingId, 'PATIENT', minutes, b.instance.sitting.link.clinicId);
    await this.queue.changed(b.instanceId);
    return { ok: true, refundedPaise: refunded };
  }

  /**
   * PAT-16: after a completed visit the patient rates the doctor, the clinic, or both (one review per booking,
   * editable). Hidden reviews are excluded from both averages.
   */
  async review(userId: string, bookingId: string, dto: { rating?: number; clinicRating?: number; comment?: string }) {
    const b = must(await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { review: true, instance: { include: { sitting: { include: { link: true } } } } } }), 'Booking');
    if (b.patientUserId !== userId) throw forbidden();
    if (b.status !== 'SERVED') throw bad('NOT_SERVED', 'You can rate a visit after it is completed');
    const { doctorId, clinicId } = b.instance.sitting.link;
    // On edit, a field left out keeps its earlier value.
    const data = {
      rating: dto.rating ?? b.review?.rating ?? null,
      clinicRating: dto.clinicRating ?? b.review?.clinicRating ?? null,
      comment: dto.comment === undefined ? (b.review?.comment ?? null) : dto.comment || null,
    };
    const r = await this.prisma.review.upsert({
      where: { bookingId },
      create: { bookingId, doctorId, clinicId, userId, ...data },
      update: data,
    });
    await this.recomputeRatings(r);
    return r;
  }

  async recomputeRatings(r: { doctorId: string; clinicId: string }) {
    await Promise.all([this.recomputeDoctorRating(r.doctorId), this.recomputeClinicRating(r.clinicId)]);
  }

  async recomputeDoctorRating(doctorId: string) {
    const agg = await this.prisma.review.aggregate({ where: { doctorId, hidden: false, rating: { not: null } }, _avg: { rating: true }, _count: { rating: true } });
    await this.prisma.doctor.update({
      where: { id: doctorId },
      data: { ratingAvg: round1(agg._avg.rating), ratingCount: agg._count.rating },
    });
  }

  async recomputeClinicRating(clinicId: string) {
    const agg = await this.prisma.review.aggregate({ where: { clinicId, hidden: false, clinicRating: { not: null } }, _avg: { clinicRating: true }, _count: { clinicRating: true } });
    await this.prisma.clinic.update({
      where: { id: clinicId },
      data: { ratingAvg: round1(agg._avg.clinicRating), ratingCount: agg._count.clinicRating },
    });
  }
}

const round1 = (v: number | null) => (v ? Math.round(v * 10) / 10 : null);
