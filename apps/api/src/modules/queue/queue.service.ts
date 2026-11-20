import { Global, Injectable, Module } from '@nestjs/common';
import {
  BookingSource,
  PatientLiveView,
  QueueBookingView,
  QueueSnapshot,
  addDays,
  aheadOfReturned,
  estimateTurn,
  istDateString,
  lateRejoinDue,
  patientCanCancel,
  istDateTime,
  nextTokenNumber,
  rollingConsultAverage,
} from '@okidoc/shared';
import { Prisma } from '@prisma/client';
import { bad, forbidden, must } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { NoShowService } from '../noshow/noshow.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { RealtimeService } from '../realtime/realtime.gateway';
import { SchedulingService, applyExceptions, sittingOccursOn } from '../scheduling/scheduling.service';

const WAITING = ['BOOKED', 'PRESENT', 'LATE', 'SKIPPED'] as const;
/** Patients may move their own booking once, while they have not been seen (BR-06a). */
const PATIENT_MOVABLE: string[] = ['BOOKED', 'LATE'];
/** Staff may move any booking that is still waiting. */
const CLINIC_MOVABLE: string[] = ['BOOKED', 'LATE', 'PRESENT', 'SKIPPED'];
/** How far ahead to look for the doctor's next sitting at the same clinic. */
const MOVE_LOOKAHEAD_DAYS = 14;
/** "Thu, 26 Nov, 1:00 PM" for patient messages. */
const whenLabel = (date: string, hm: string) => {
  const d = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const [h, m] = hm.split(':').map(Number);
  return `${d}, ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const instanceInclude = {
  sitting: { include: { link: { include: { clinic: true, doctor: { include: { user: { select: { id: true, name: true } } } } } } } },
} as const;
type InstanceCtx = Prisma.SittingInstanceGetPayload<{ include: typeof instanceInclude }>;

@Injectable()
export class QueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly noShows: NoShowService,
    private readonly payments: PaymentsService,
    private readonly settings: SettingsService,
    private readonly scheduling: SchedulingService,
  ) {}

  async ctx(instanceId: string): Promise<InstanceCtx> {
    return must(await this.prisma.sittingInstance.findUnique({ where: { id: instanceId }, include: instanceInclude }), 'Sitting');
  }

  // ------------------------------------------------------------------ views

  async snapshot(instanceId: string, ctx?: InstanceCtx): Promise<QueueSnapshot> {
    const inst = ctx ?? (await this.ctx(instanceId));
    const grouped = await this.prisma.booking.groupBy({ by: ['status'], where: { instanceId }, _count: true });
    const n = (s: string) => grouped.find((g) => g.status === s)?._count ?? 0;
    return {
      instanceId: inst.id,
      sittingId: inst.sittingId,
      date: inst.date,
      status: inst.status,
      presence: inst.presence,
      delayMinutes: inst.delayMinutes,
      bookingsOpen: inst.bookingsOpen,
      startTime: inst.startTime,
      endTime: inst.endTime,
      nowServing: inst.nowServingToken,
      waiting: WAITING.reduce((a, s) => a + n(s), 0),
      completed: n('SERVED'),
      avgConsultMinutes: inst.sitting.link.avgConsultMinutes ?? (await this.settings.rules()).defaultConsultMinutes,
      updatedAt: inst.updatedAt.toISOString(),
    };
  }

  async staffView(instanceId: string) {
    const ctx = await this.ctx(instanceId);
    const bookings = await this.prisma.booking.findMany({ where: { instanceId }, orderBy: { tokenNo: 'asc' } });
    const list: QueueBookingView[] = bookings.map((b) => ({
      id: b.id,
      tokenNo: b.tokenNo,
      status: b.status,
      source: b.source,
      patientName: b.patientName,
      phone: b.patientPhone,
      paymentMode: b.paymentMode,
      paidAtClinic: b.paidAtClinic,
      calledAt: b.calledAt?.toISOString() ?? null,
      presentAt: b.presentAt?.toISOString() ?? null,
      checkInAt: b.checkInAt?.toISOString() ?? null,
      recalledAt: b.recalledAt?.toISOString() ?? null,
      rejoinAfter: b.rejoinAfter,
      movedFrom: b.movedFrom,
    }));
    const tiles = {
      total: bookings.filter((b) => b.status !== 'PENDING_PAYMENT').length,
      online: bookings.filter((b) => b.source === 'ONLINE' && b.status !== 'PENDING_PAYMENT').length,
      walkIn: bookings.filter((b) => b.source !== 'ONLINE').length,
      present: bookings.filter((b) => ['PRESENT', 'IN_CONSULTATION', 'SERVED', 'SKIPPED'].includes(b.status)).length,
      late: bookings.filter((b) => b.status === 'LATE').length,
      cancelled: bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'NO_SHOW').length,
    };
    return {
      snapshot: await this.snapshot(instanceId, ctx),
      doctor: { id: ctx.sitting.link.doctorId, name: ctx.sitting.link.doctor.user.name },
      clinic: { id: ctx.sitting.link.clinicId, name: ctx.sitting.link.clinic.name, lateRejoinAfter: ctx.sitting.link.clinic.lateRejoinAfter },
      bookings: list,
      tiles,
    };
  }

  private async patientsAhead(instanceId: string, tokenNo: number) {
    return this.prisma.booking.count({ where: { instanceId, tokenNo: { lt: tokenNo }, status: { in: ['BOOKED', 'PRESENT', 'IN_CONSULTATION'] } } });
  }

  async patientLive(bookingId: string, userId: string): Promise<PatientLiveView> {
    const b = must(await this.prisma.booking.findUnique({ where: { id: bookingId } }), 'Booking');
    if (b.patientUserId !== userId) throw forbidden();
    const ctx = await this.ctx(b.instanceId);
    const snap = await this.snapshot(b.instanceId, ctx);
    const rejoined = b.status === 'PRESENT' && !!b.recalledAt;
    const ahead = rejoined
      ? await this.aheadOfReturned(b.instanceId, b.recalledAt!, b.rejoinAfter)
      : ['BOOKED', 'PRESENT', 'LATE', 'SKIPPED'].includes(b.status)
        ? await this.patientsAhead(b.instanceId, b.tokenNo)
        : 0;
    const eta = ['BOOKED', 'PRESENT'].includes(b.status)
      ? estimateTurn({
          now: new Date(),
          sittingStart: istDateTime(ctx.date, ctx.startTime),
          patientsAhead: ahead,
          avgConsultMinutes: snap.avgConsultMinutes,
          delayMinutes: ctx.delayMinutes,
          doctorOnline: ctx.status === 'ONLINE',
        })
      : null;
    return {
      ...snap,
      bookingId: b.id,
      myToken: b.tokenNo,
      myStatus: b.status,
      patientsAhead: ahead,
      etaFrom: eta?.from.toISOString() ?? null,
      etaTo: eta?.to.toISOString() ?? null,
      doctorName: ctx.sitting.link.doctor.user.name,
      clinicName: ctx.sitting.link.clinic.name,
      checkInAt: b.checkInAt?.toISOString() ?? null,
      lateRejoinAfter: ctx.sitting.link.clinic.lateRejoinAfter,
      rejoined,
      canMove: b.moveCount < 1 && PATIENT_MOVABLE.includes(b.status) && !['ENDED', 'CANCELLED'].includes(ctx.status),
      movedFrom: b.movedFrom,
      canCancel: patientCanCancel({
        now: new Date(),
        sittingStart: istDateTime(ctx.date, ctx.startTime),
        sittingEnd: istDateTime(ctx.date, ctx.endTime),
        sittingStatus: ctx.status,
        bookingStatus: b.status,
      }),
      cancelUntil: istDateTime(ctx.date, ctx.startTime).toISOString(),
    };
  }

  /** Patients ahead of a late patient who came back (BR-06a). */
  private async aheadOfReturned(instanceId: string, recalledAt: Date, rejoinAfter: number | null) {
    const [calledSinceReturn, othersWaiting, returnedEarlier] = await Promise.all([
      this.prisma.booking.count({ where: { instanceId, calledAt: { gt: recalledAt } } }),
      this.prisma.booking.count({ where: { instanceId, status: { in: ['BOOKED', 'PRESENT'] }, recalledAt: null } }),
      this.prisma.booking.count({ where: { instanceId, status: 'PRESENT', recalledAt: { lt: recalledAt } } }),
    ]);
    return aheadOfReturned({ rejoinAfter, calledSinceReturn, othersWaiting, returnedEarlier });
  }

  // ------------------------------------------------------------------ token allocation

  /** Create a booking with the next token (BR-01), retrying on concurrent token collisions. */
  async createWithToken(instanceId: string, source: BookingSource, data: Omit<Prisma.BookingUncheckedCreateInput, 'instanceId' | 'tokenNo' | 'source'>) {
    const ctx = await this.ctx(instanceId);
    for (let attempt = 0; attempt < 5; attempt++) {
      const used = (await this.prisma.booking.findMany({ where: { instanceId }, select: { tokenNo: true } })).map((b) => b.tokenNo);
      const tokenNo = nextTokenNumber(used, source, ctx.sitting.link.walkInEvery, ctx.nowServingToken ?? 0);
      try {
        return await this.prisma.booking.create({ data: { ...data, instanceId, source, tokenNo } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const target = String((e.meta as { target?: unknown })?.target ?? '');
          if (target.includes('clientRef') && data.clientRef) {
            return must(await this.prisma.booking.findUnique({ where: { instanceId_clientRef: { instanceId, clientRef: data.clientRef } } }));
          }
          continue;
        }
        throw e;
      }
    }
    throw bad('TOKEN_BUSY', 'The queue is busy, please try again');
  }

  // ------------------------------------------------------------------ instance actions (CLN-10/11)

  async instanceAction(instanceId: string, action: string, actorId: string, opts: { delayMinutes?: number; reason?: string; moveLate?: boolean } = {}) {
    const ctx = await this.ctx(instanceId);
    if (ctx.status === 'ENDED' || ctx.status === 'CANCELLED') {
      if (!['OPEN_BOOKINGS', 'STOP_BOOKINGS'].includes(action)) throw bad('SITTING_CLOSED', 'This sitting has already ended');
    }
    const link = ctx.sitting.link;
    const doctorName = `Dr. ${link.doctor.user.name}`;
    const patientIds = async () =>
      (
        await this.prisma.booking.findMany({
          where: { instanceId, status: { in: ['BOOKED', 'PRESENT', 'LATE', 'SKIPPED'] }, patientUserId: { not: null } },
          select: { patientUserId: true },
        })
      ).map((b) => b.patientUserId!);

    switch (action) {
      case 'ONLINE': {
        const wasOnline = ctx.status === 'ONLINE';
        await this.prisma.sittingInstance.update({
          where: { id: instanceId },
          data: { status: 'ONLINE', presence: 'ONLINE', onlineAt: ctx.onlineAt ?? new Date() },
        });
        if (!wasOnline) {
          await this.notifications.notifyMany(await patientIds(), 'DOCTOR_ONLINE', {
            vars: { doctor: doctorName, clinic: link.clinic.name },
            data: { instanceId },
          });
        }
        break;
      }
      case 'OFFLINE':
        await this.prisma.sittingInstance.update({ where: { id: instanceId }, data: { status: 'SCHEDULED', presence: 'NOT_ARRIVED' } });
        break;
      case 'PAUSE':
        await this.prisma.sittingInstance.update({ where: { id: instanceId }, data: { status: 'PAUSED', presence: 'ON_BREAK' } });
        break;
      case 'RESUME':
        await this.prisma.sittingInstance.update({ where: { id: instanceId }, data: { status: 'ONLINE', presence: 'ONLINE' } });
        break;
      case 'DELAY': {
        const minutes = opts.delayMinutes ?? 15;
        await this.prisma.sittingInstance.update({ where: { id: instanceId }, data: { delayMinutes: minutes, presence: minutes > 0 ? 'DELAYED' : ctx.presence } });
        if (minutes > 0) {
          await this.notifications.notifyMany(await patientIds(), 'DOCTOR_DELAYED', {
            vars: { doctor: doctorName, clinic: link.clinic.name, minutes },
            data: { instanceId },
          });
        }
        break;
      }
      case 'STOP_BOOKINGS':
        await this.prisma.sittingInstance.update({ where: { id: instanceId }, data: { bookingsOpen: false } });
        break;
      case 'OPEN_BOOKINGS':
        await this.prisma.sittingInstance.update({ where: { id: instanceId }, data: { bookingsOpen: true } });
        break;
      case 'CALL_NEXT':
        await this.callNext(ctx, actorId);
        break;
      case 'END':
        await this.endInstance(instanceId, actorId, { moveLate: opts.moveLate });
        break;
      case 'CANCEL':
        await this.cancelInstance(instanceId, actorId, opts.reason ?? 'Sitting cancelled', 'CLINIC');
        break;
      default:
        throw bad('BAD_ACTION', 'Unknown action');
    }
    await this.event(instanceId, `INSTANCE_${action}`, actorId, opts);
    return this.changed(instanceId);
  }

  /**
   * Call the next patient: completes the current one, then
   *  1. a late patient who came back, once `rejoinAfter` more patients have been seen since they returned (BR-06a);
   *  2. otherwise the lowest present token — booked tokens passed on the way are not here, so they move to Late
   *     and the patient is told they missed their turn (BR-06);
   *  3. otherwise any returned late patient, so the doctor is never left idle.
   */
  private async callNext(ctx: InstanceCtx, actorId: string) {
    if (ctx.status !== 'ONLINE') throw bad('NOT_ONLINE', 'Put the doctor online first');
    await this.completeCurrent(ctx.id);
    const candidates = await this.prisma.booking.findMany({
      where: { instanceId: ctx.id, status: { in: ['BOOKED', 'PRESENT'] } },
      orderBy: [{ tokenNo: 'asc' }],
    });
    const returned = candidates.filter((c) => c.status === 'PRESENT' && c.recalledAt).sort((x, y) => x.recalledAt!.getTime() - y.recalledAt!.getTime());
    const regular = candidates.filter((c) => !c.recalledAt);
    const othersPresent = regular.filter((c) => c.status === 'PRESENT').length;
    let next: (typeof candidates)[number] | undefined;
    for (const r of returned) {
      const calledSinceReturn = await this.prisma.booking.count({ where: { instanceId: ctx.id, calledAt: { gt: r.recalledAt! } } });
      if (lateRejoinDue(r.rejoinAfter, calledSinceReturn, othersPresent)) {
        next = r;
        break;
      }
    }
    if (!next) {
      for (const c of regular) {
        if (c.status === 'PRESENT') {
          next = c;
          break;
        }
        // Their token came up but they are not here → late bucket.
        await this.markLate(ctx, c, actorId);
      }
    }
    next ??= returned[0];
    if (!next) {
      await this.prisma.sittingInstance.update({ where: { id: ctx.id }, data: { nowServingToken: null } });
      return null;
    }
    await this.call(ctx.id, next.id, actorId);
    return next;
  }

  /** Move a booked patient who is not here to Late and tell them how to get back in (BR-06a). */
  private async markLate(ctx: InstanceCtx, b: { id: string; tokenNo: number; patientUserId: string | null }, actorId: string) {
    await this.prisma.booking.update({ where: { id: b.id }, data: { status: 'LATE' } });
    await this.event(ctx.id, 'BOOKING_LATE', actorId, { bookingId: b.id, token: b.tokenNo });
    if (b.patientUserId) {
      await this.notifications.notify(b.patientUserId, 'MISSED_TURN', {
        vars: { token: b.tokenNo, clinic: ctx.sitting.link.clinic.name, doctor: `Dr. ${ctx.sitting.link.doctor.user.name}` },
        data: { bookingId: b.id },
        sms: true,
      });
    }
  }

  private async call(instanceId: string, bookingId: string, actorId: string) {
    await this.completeCurrent(instanceId, bookingId);
    const b = await this.prisma.booking.update({ where: { id: bookingId }, data: { status: 'IN_CONSULTATION', calledAt: new Date(), recalledAt: null, rejoinAfter: null, checkInAt: null } });
    await this.prisma.sittingInstance.update({ where: { id: instanceId }, data: { nowServingToken: b.tokenNo } });
    await this.event(instanceId, 'BOOKING_CALLED', actorId, { bookingId, token: b.tokenNo });
  }

  private async completeCurrent(instanceId: string, exceptBookingId?: string) {
    const current = await this.prisma.booking.findMany({ where: { instanceId, status: 'IN_CONSULTATION', id: { not: exceptBookingId ?? '' } } });
    for (const c of current) await this.serve(c.id);
  }

  private async serve(bookingId: string) {
    const b = await this.prisma.booking.update({ where: { id: bookingId }, data: { status: 'SERVED', servedAt: new Date() }, include: { instance: { include: { sitting: { include: { link: { include: { doctor: { include: { user: true } } } } } } } } } });
    // Rolling average consult time for ETA (BR-08)
    const link = b.instance.sitting.link;
    const recent = await this.prisma.booking.findMany({
      where: { status: 'SERVED', calledAt: { not: null }, servedAt: { not: null }, instance: { sitting: { linkId: link.id } } },
      orderBy: { servedAt: 'desc' },
      take: 20,
      select: { calledAt: true, servedAt: true },
    });
    const avg = rollingConsultAverage(recent.map((r) => (r.servedAt!.getTime() - r.calledAt!.getTime()) / 60_000).reverse());
    await this.prisma.clinicDoctorLink.update({ where: { id: link.id }, data: { avgConsultMinutes: avg } });
    if (b.patientUserId) {
      await this.notifications.notify(b.patientUserId, 'RATE_VISIT', { vars: { doctor: `Dr. ${link.doctor.user.name}` }, data: { bookingId: b.id } });
    }
  }

  // ------------------------------------------------------------------ booking actions

  async bookingAction(bookingId: string, action: string, actorId: string, opts: { paidVia?: string; reason?: string } = {}) {
    const b = must(await this.prisma.booking.findUnique({ where: { id: bookingId } }), 'Booking');
    const instanceId = b.instanceId;
    const set = (data: Prisma.BookingUpdateInput) => this.prisma.booking.update({ where: { id: bookingId }, data });
    switch (action) {
      case 'PRESENT':
        if (!['BOOKED', 'LATE', 'SKIPPED'].includes(b.status)) throw bad('BAD_STATE', 'Patient cannot be marked present now');
        if (b.status === 'LATE') {
          // A late patient who arrives rejoins after the clinic's set number of patients (BR-06a).
          const ctx = await this.ctx(instanceId);
          await set({ status: 'PRESENT', presentAt: new Date(), recalledAt: new Date(), rejoinAfter: ctx.sitting.link.clinic.lateRejoinAfter });
        } else {
          await set({ status: 'PRESENT', presentAt: b.presentAt ?? new Date() });
        }
        break;
      case 'LATE':
        if (!['BOOKED', 'PRESENT'].includes(b.status)) throw bad('BAD_STATE', 'Only waiting patients can be marked late');
        await this.markLate(await this.ctx(instanceId), b, actorId);
        break;
      case 'SKIP':
        if (!['PRESENT', 'IN_CONSULTATION'].includes(b.status)) throw bad('BAD_STATE', 'Only present patients can be skipped');
        await set({ status: 'SKIPPED' });
        break;
      case 'RECALL':
        if (!['LATE', 'SKIPPED'].includes(b.status)) throw bad('BAD_STATE', 'Only late or skipped patients can be recalled');
        // Recall = staff bring the patient back straight after the current one.
        await set({ status: 'PRESENT', recalledAt: new Date(), rejoinAfter: 0, presentAt: b.presentAt ?? new Date() });
        break;
      case 'MOVE_NEXT':
        await this.moveToNextSitting(bookingId, actorId, 'CLINIC');
        break;
      case 'CALL':
        if (!['PRESENT', 'BOOKED', 'LATE', 'SKIPPED'].includes(b.status)) throw bad('BAD_STATE', 'This patient cannot be called');
        await this.call(instanceId, bookingId, actorId);
        break;
      case 'COMPLETE':
        if (b.status !== 'IN_CONSULTATION') throw bad('BAD_STATE', 'Only the patient being seen can be completed');
        await this.serve(bookingId);
        break;
      case 'NO_SHOW':
        if (!['BOOKED', 'LATE'].includes(b.status)) throw bad('BAD_STATE', 'Only patients who have not arrived can be marked no-show');
        await set({ status: 'NO_SHOW', noShowAt: new Date() });
        await this.noShows.record(bookingId);
        break;
      case 'UNDO_NO_SHOW':
        if (b.status !== 'NO_SHOW') throw bad('BAD_STATE', 'This booking is not a no-show');
        await set({ status: 'SERVED', servedAt: new Date(), noShowAt: null });
        await this.noShows.correct(bookingId, actorId);
        break;
      case 'PAID_AT_CLINIC':
        await this.payments.recordPaidAtClinic(bookingId, opts.paidVia ?? 'CASH');
        break;
      case 'CANCEL': {
        // Clinics can cancel at any time before the visit (also after the sitting has started, when patients no
        // longer can — BR-12a). Online payments are refunded in full and the patient is told why.
        if (['SERVED', 'CANCELLED', 'NO_SHOW', 'IN_CONSULTATION'].includes(b.status)) throw bad('BAD_STATE', 'Booking is already closed');
        const ctx = await this.ctx(instanceId);
        const reason = opts.reason?.trim() || 'Cancelled by the clinic';
        await set({ status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'CLINIC', cancelReason: reason });
        const mins = Math.round((istDateTime(ctx.date, ctx.startTime).getTime() - Date.now()) / 60_000);
        const refunded = await this.payments.refundForCancellation(bookingId, 'CLINIC', mins, ctx.sitting.link.clinicId);
        const doctor = `Dr. ${ctx.sitting.link.doctor.user.name}`;
        const clinic = ctx.sitting.link.clinic.name;
        if (b.patientUserId) {
          await this.notifications.notify(b.patientUserId, 'BOOKING_CANCELLED', {
            vars: { token: b.tokenNo, doctor, clinic, when: whenLabel(ctx.date, ctx.startTime), reason, extra: refunded > 0 ? `₹${Math.round(refunded / 100)} will be refunded.` : '' },
            data: { bookingId },
            sms: true,
          });
        } else if (b.patientPhone) {
          await this.notifications.textPhone(b.patientPhone, `Okidoc: ${clinic} cancelled your token #${b.tokenNo} with ${doctor} (${whenLabel(ctx.date, ctx.startTime)}). Reason: ${reason}`);
        }
        break;
      }
      default:
        throw bad('BAD_ACTION', 'Unknown action');
    }
    await this.event(instanceId, `BOOKING_${action}`, actorId, { bookingId, token: b.tokenNo });
    return this.changed(instanceId);
  }

  // ------------------------------------------------------------------ missed turn: check-in and move (BR-06a)

  /** Patient taps "I'm here": reception sees it and confirms with Arrived. */
  async checkIn(bookingId: string, userId: string) {
    const b = must(await this.prisma.booking.findUnique({ where: { id: bookingId } }), 'Booking');
    if (b.patientUserId !== userId) throw forbidden();
    if (!['BOOKED', 'LATE'].includes(b.status)) throw bad('BAD_STATE', 'You are already checked in');
    const ctx = await this.ctx(b.instanceId);
    const running = ctx.status === 'ONLINE' || ctx.status === 'PAUSED';
    if (['ENDED', 'CANCELLED'].includes(ctx.status) || (!running && ctx.date !== istDateString(new Date()))) {
      throw bad('NOT_TODAY', 'You can check in on the day of your visit, while the sitting is running');
    }
    await this.prisma.booking.update({ where: { id: bookingId }, data: { checkInAt: b.checkInAt ?? new Date() } });
    await this.event(b.instanceId, 'BOOKING_CHECK_IN', userId, { bookingId, token: b.tokenNo });
    await this.changed(b.instanceId);
    return this.patientLive(bookingId, userId);
  }

  /** The doctor's next sitting at the same clinic after this one (creates the dated instance), or null. */
  async nextInstance(ctx: InstanceCtx) {
    const link = ctx.sitting.link;
    if (link.status !== 'APPROVED') return null;
    const now = new Date();
    const today = istDateString(now);
    const from = ctx.date > today ? ctx.date : today;
    const sittings = await this.prisma.sitting.findMany({ where: { linkId: link.id, active: true } });
    if (!sittings.length) return null;
    const exceptions = await this.prisma.sittingException.findMany({ where: { doctorId: link.doctorId, toDate: { gte: from } } });
    for (let i = 0; i <= MOVE_LOOKAHEAD_DAYS; i++) {
      const date = addDays(from, i);
      const options: { sittingId: string; startTime: string }[] = [];
      for (const st of sittings) {
        if (!sittingOccursOn(st, date)) continue;
        const times = applyExceptions(st, date, exceptions);
        if (!times) continue;
        if (date === ctx.date && (st.id === ctx.sittingId || times.startTime <= ctx.startTime)) continue;
        if (istDateTime(date, times.endTime).getTime() <= now.getTime()) continue;
        options.push({ sittingId: st.id, startTime: times.startTime });
      }
      options.sort((x, y) => x.startTime.localeCompare(y.startTime));
      for (const o of options) {
        const inst = await this.scheduling.ensureInstance(o.sittingId, date);
        if (!['ENDED', 'CANCELLED'].includes(inst.status)) return inst;
      }
    }
    return null;
  }

  /** Preview for the patient app: where a move would land. */
  async nextSittingPreview(bookingId: string, userId: string) {
    const b = must(await this.prisma.booking.findUnique({ where: { id: bookingId } }), 'Booking');
    if (b.patientUserId !== userId) throw forbidden();
    const inst = await this.nextInstance(await this.ctx(b.instanceId));
    return { next: inst ? { instanceId: inst.id, date: inst.date, startTime: inst.startTime, endTime: inst.endTime } : null };
  }

  /**
   * Move a booking to the doctor's next sitting at the same clinic with a new token (BR-06a).
   * The same booking row moves, so any online payment carries over. Patients may do this once per booking.
   */
  async moveToNextSitting(bookingId: string, actorId: string | null, by: 'CLINIC' | 'PATIENT', opts: { quiet?: boolean } = {}) {
    const b = must(await this.prisma.booking.findUnique({ where: { id: bookingId } }), 'Booking');
    if (by === 'PATIENT') {
      if (b.patientUserId !== actorId) throw forbidden();
      if (!PATIENT_MOVABLE.includes(b.status)) throw bad('BAD_STATE', 'This booking can no longer be moved');
      if (b.moveCount >= 1) throw bad('MOVE_LIMIT', 'You have already moved this visit once. Please contact the clinic.');
    } else if (!CLINIC_MOVABLE.includes(b.status)) {
      throw bad('BAD_STATE', 'Only waiting patients can be moved to another sitting');
    }
    const ctx = await this.ctx(b.instanceId);
    if (by === 'PATIENT' && ['ENDED', 'CANCELLED'].includes(ctx.status)) throw bad('SITTING_CLOSED', 'This sitting has ended');
    const doctor = `Dr. ${ctx.sitting.link.doctor.user.name}`;
    const clinic = ctx.sitting.link.clinic.name;
    const target = await this.nextInstance(ctx);
    if (!target) throw bad('NO_NEXT_SITTING', `${doctor} has no other sitting at ${clinic} in the next ${MOVE_LOOKAHEAD_DAYS} days`);
    let moved: Awaited<ReturnType<typeof this.prisma.booking.update>> | undefined;
    for (let attempt = 0; attempt < 5 && !moved; attempt++) {
      const used = (await this.prisma.booking.findMany({ where: { instanceId: target.id }, select: { tokenNo: true } })).map((x) => x.tokenNo);
      const tokenNo = nextTokenNumber(used, b.source, ctx.sitting.link.walkInEvery, target.nowServingToken ?? 0);
      try {
        moved = await this.prisma.booking.update({
          where: { id: b.id },
          data: {
            instanceId: target.id,
            tokenNo,
            status: 'BOOKED',
            presentAt: null,
            recalledAt: null,
            rejoinAfter: null,
            checkInAt: null,
            calledAt: null,
            reminderSentAt: null,
            nearAlertSentAt: null,
            clientRef: null,
            moveCount: { increment: 1 },
            movedFrom: `${ctx.date} ${ctx.startTime}`,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    if (!moved) throw bad('TOKEN_BUSY', 'The queue is busy, please try again');
    const info = { bookingId: b.id, fromToken: b.tokenNo, token: moved.tokenNo, to: `${target.date} ${target.startTime}`, by };
    await this.event(ctx.id, 'BOOKING_MOVED_OUT', actorId, info);
    await this.event(target.id, 'BOOKING_MOVED_IN', actorId, info);
    if (b.patientUserId) {
      await this.notifications.notify(b.patientUserId, 'BOOKING_MOVED', {
        vars: { token: moved.tokenNo, doctor, clinic, when: whenLabel(target.date, target.startTime) },
        data: { bookingId: b.id },
        sms: by === 'CLINIC',
      });
    } else if (b.patientPhone) {
      await this.notifications.textPhone(b.patientPhone, `Okidoc: Your visit with ${doctor} at ${clinic} is moved to ${whenLabel(target.date, target.startTime)}. New token #${moved.tokenNo}.`);
    }
    if (!opts.quiet) await this.changed(ctx.id);
    await this.changed(target.id);
    return { booking: moved, instance: target };
  }

  // ------------------------------------------------------------------ walk-ins (CLN-12/13)

  async addWalkIn(instanceId: string, dto: { name: string; phone?: string; clientRef?: string }, actorId: string, source: BookingSource = 'WALK_IN') {
    const ctx = await this.ctx(instanceId);
    if (ctx.status === 'ENDED' || ctx.status === 'CANCELLED') throw bad('SITTING_CLOSED', 'This sitting has ended');
    const booking = await this.createWithToken(instanceId, source, {
      patientName: dto.name,
      patientPhone: dto.phone ?? null,
      status: 'PRESENT',
      presentAt: new Date(),
      paymentMode: 'PAY_AT_CLINIC',
      consultationFee: ctx.sitting.link.consultationFee,
      clientRef: dto.clientRef ?? null,
      createdById: actorId,
    });
    if (dto.phone) {
      await this.notifications.textPhone(
        dto.phone,
        `Okidoc: Your token is #${booking.tokenNo} for Dr. ${ctx.sitting.link.doctor.user.name} at ${ctx.sitting.link.clinic.name} today.`,
      );
    }
    await this.event(instanceId, 'WALK_IN_ADDED', actorId, { bookingId: booking.id, token: booking.tokenNo });
    await this.changed(instanceId);
    return booking;
  }

  // ------------------------------------------------------------------ end / cancel

  /**
   * End a sitting. BOOKED/LATE tokens become NO_SHOW (counted only for pay-at-clinic online bookings, BR-07a);
   * patients who arrived but were not seen are cancelled with a full refund; current consultation is completed.
   */
  async endInstance(instanceId: string, actorId: string | null, opts: { moveLate?: boolean } = {}) {
    const ctx = await this.ctx(instanceId);
    await this.completeCurrent(instanceId);
    if (!ctx.onlineAt) {
      // Doctor never went online: nobody is penalised (sitting did not run).
      return this.cancelInstance(instanceId, actorId, 'The sitting did not run', 'SYSTEM');
    }
    if (opts.moveLate) {
      // BR-06a: patients who missed their turn keep their visit at the doctor's next sitting instead of a no-show.
      const late = await this.prisma.booking.findMany({ where: { instanceId, status: 'LATE' }, select: { id: true } });
      for (const l of late) {
        try {
          await this.moveToNextSitting(l.id, actorId, 'CLINIC', { quiet: true });
        } catch {
          break; // no next sitting: the rest fall through to no-show below
        }
      }
    }
    const open = await this.prisma.booking.findMany({ where: { instanceId, status: { in: ['BOOKED', 'LATE', 'PRESENT', 'SKIPPED', 'PENDING_PAYMENT'] } } });
    for (const b of open) {
      if (b.status === 'BOOKED' || b.status === 'LATE') {
        await this.prisma.booking.update({ where: { id: b.id }, data: { status: 'NO_SHOW', noShowAt: new Date() } });
        await this.noShows.record(b.id);
      } else {
        await this.prisma.booking.update({
          where: { id: b.id },
          data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'SYSTEM', cancelReason: 'Sitting ended before this turn' },
        });
        await this.payments.refundForCancellation(b.id, 'SYSTEM', 0, ctx.sitting.link.clinicId);
      }
    }
    await this.prisma.sittingInstance.update({ where: { id: instanceId }, data: { status: 'ENDED', endedAt: new Date(), presence: 'NOT_ARRIVED' } });
    await this.event(instanceId, 'INSTANCE_ENDED', actorId);
    return this.changed(instanceId);
  }

  async cancelInstance(instanceId: string, actorId: string | null, reason: string, by: 'CLINIC' | 'DOCTOR' | 'SYSTEM' | 'ADMIN') {
    const ctx = await this.ctx(instanceId);
    const open = await this.prisma.booking.findMany({
      where: { instanceId, status: { in: ['BOOKED', 'PRESENT', 'LATE', 'SKIPPED', 'PENDING_PAYMENT', 'IN_CONSULTATION'] } },
    });
    await this.prisma.sittingInstance.update({ where: { id: instanceId }, data: { status: 'CANCELLED', cancelledReason: reason, bookingsOpen: false } });
    for (const b of open) {
      await this.prisma.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: by, cancelReason: reason } });
      await this.payments.refundForCancellation(b.id, by, 0, ctx.sitting.link.clinicId);
    }
    const userIds = open.map((b) => b.patientUserId).filter((x): x is string => !!x);
    await this.notifications.notifyMany(userIds, 'SITTING_CANCELLED', {
      vars: {
        doctor: `Dr. ${ctx.sitting.link.doctor.user.name}`,
        clinic: ctx.sitting.link.clinic.name,
        date: ctx.date,
        extra: 'Any online payment will be refunded in full. Please book another sitting.',
      },
      data: { instanceId, doctorId: ctx.sitting.link.doctorId },
    });
    // Walk-ins with a phone get an SMS.
    for (const b of open.filter((x) => !x.patientUserId && x.patientPhone)) {
      await this.notifications.textPhone(b.patientPhone!, `Okidoc: Dr. ${ctx.sitting.link.doctor.user.name}'s sitting at ${ctx.sitting.link.clinic.name} today is cancelled.`);
    }
    await this.event(instanceId, 'INSTANCE_CANCELLED', actorId, { reason });
    return this.changed(instanceId);
  }

  // ------------------------------------------------------------------ fan-out

  private async event(instanceId: string, type: string, actorId: string | null, data?: object) {
    await this.prisma.queueEvent.create({ data: { instanceId, type, actorId, data: data ? JSON.parse(JSON.stringify(data)) : undefined } });
  }

  /** Broadcast state and send "turn is near" alerts (PAT-12). */
  async changed(instanceId: string) {
    const ctx = await this.ctx(instanceId);
    const snap = await this.snapshot(instanceId, ctx);
    this.realtime.emitInstance(instanceId, 'queue:update', snap);
    this.realtime.emitClinic(ctx.sitting.link.clinicId, 'queue:update', snap);
    if (ctx.status === 'ONLINE') await this.turnAlerts(ctx);
    return snap;
  }

  private async turnAlerts(ctx: InstanceCtx) {
    const rules = await this.settings.rules();
    const waiting = await this.prisma.booking.findMany({
      where: { instanceId: ctx.id, status: { in: ['BOOKED', 'PRESENT'] }, patientUserId: { not: null }, nearAlertSentAt: null },
      include: { patient: { select: { turnNearThreshold: true } } },
      orderBy: { tokenNo: 'asc' },
      take: 25,
    });
    for (const b of waiting) {
      const ahead = await this.patientsAhead(ctx.id, b.tokenNo);
      const threshold = b.patient?.turnNearThreshold ?? rules.turnNearThreshold;
      if (ahead > threshold) break;
      const type = ahead === 0 ? 'YOU_ARE_NEXT' : 'TURN_NEAR';
      await this.prisma.booking.update({ where: { id: b.id }, data: { nearAlertSentAt: new Date() } });
      await this.notifications.notify(b.patientUserId!, type, {
        vars: { ahead, token: b.tokenNo, clinic: ctx.sitting.link.clinic.name },
        data: { bookingId: b.id },
        sms: true,
      });
    }
  }
}

@Global()
@Module({ providers: [QueueService], exports: [QueueService] })
export class QueueModule {}
