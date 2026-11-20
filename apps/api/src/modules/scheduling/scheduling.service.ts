import { Global, Injectable, Module } from '@nestjs/common';
import {
  SlotView,
  addDays,
  checkBookable,
  effectiveBookingWindowHours,
  istDateString,
  istDateTime,
  istWeekday,
} from '@okidoc/shared';
import type { Sitting, SittingException } from '@prisma/client';
import { bad } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';

export const todayIST = () => istDateString(new Date());

const WEEK_MS = 7 * 86400_000;

/** Does a recurring sitting rule occur on this IST date? */
export function sittingOccursOn(s: Pick<Sitting, 'weekdays' | 'recurrence' | 'specificDates' | 'anchorDate' | 'validFrom' | 'validTo' | 'active'>, date: string) {
  if (!s.active) return false;
  if (date < s.validFrom) return false;
  if (s.validTo && date > s.validTo) return false;
  if (s.recurrence === 'SPECIFIC_DATES') return s.specificDates.includes(date);
  if (!s.weekdays.includes(istWeekday(date))) return false;
  if (s.recurrence === 'ALTERNATE_WEEKS') {
    const anchor = s.anchorDate ?? s.validFrom;
    const weeks = Math.floor((Date.parse(date) - Date.parse(anchor)) / WEEK_MS);
    return weeks % 2 === 0;
  }
  return true;
}

/** Apply day-off / changed-time exceptions. Returns null when the sitting is off. */
export function applyExceptions(
  s: Pick<Sitting, 'id' | 'startTime' | 'endTime'>,
  date: string,
  exceptions: Pick<SittingException, 'sittingId' | 'fromDate' | 'toDate' | 'type' | 'startTime' | 'endTime'>[],
) {
  let start = s.startTime;
  let end = s.endTime;
  for (const e of exceptions) {
    if (e.sittingId && e.sittingId !== s.id) continue;
    if (date < e.fromDate || date > e.toDate) continue;
    if (e.type === 'OFF') return null;
    if (e.type === 'CHANGED_TIME') {
      start = e.startTime ?? start;
      end = e.endTime ?? end;
    }
  }
  return { startTime: start, endTime: end };
}

const sittingInclude = {
  link: { include: { clinic: { include: { area: true } }, doctor: { include: { user: { select: { name: true } } } } } },
} as const;

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** Get or create the dated instance for a sitting (validates the rule + exceptions). */
  async ensureInstance(sittingId: string, date: string) {
    const existing = await this.prisma.sittingInstance.findUnique({ where: { sittingId_date: { sittingId, date } } });
    if (existing) return existing;
    const sitting = await this.prisma.sitting.findUnique({ where: { id: sittingId }, include: { link: true } });
    if (!sitting || !sittingOccursOn(sitting, date)) throw bad('NO_SITTING', 'The doctor does not sit at this time');
    const exceptions = await this.prisma.sittingException.findMany({
      where: { doctorId: sitting.link.doctorId, fromDate: { lte: date }, toDate: { gte: date } },
    });
    const times = applyExceptions(sitting, date, exceptions);
    if (!times) throw bad('DAY_OFF', 'The doctor is not sitting on this day');
    return this.prisma.sittingInstance.upsert({
      where: { sittingId_date: { sittingId, date } },
      create: { sittingId, date, ...times },
      update: {},
    });
  }

  /** All sitting occurrences for a clinic on a date (creates instance rows so the console can run them). */
  async clinicInstancesForDate(clinicId: string, date: string) {
    const sittings = await this.prisma.sitting.findMany({
      where: { active: true, link: { clinicId, status: 'APPROVED' } },
      include: { link: { include: { doctor: { include: { user: { select: { name: true } }, specialties: true } } } } },
    });
    const doctorIds = [...new Set(sittings.map((s) => s.link.doctorId))];
    const exceptions = await this.prisma.sittingException.findMany({
      where: { doctorId: { in: doctorIds }, fromDate: { lte: date }, toDate: { gte: date } },
    });
    const out = [];
    for (const s of sittings) {
      if (!sittingOccursOn(s, date)) continue;
      const times = applyExceptions(s, date, exceptions.filter((e) => e.doctorId === s.link.doctorId));
      const existing = await this.prisma.sittingInstance.findUnique({ where: { sittingId_date: { sittingId: s.id, date } } });
      if (!times && !existing) continue;
      const instance =
        existing ??
        (await this.prisma.sittingInstance.create({ data: { sittingId: s.id, date, startTime: times!.startTime, endTime: times!.endTime } }));
      out.push({ instance, sitting: s, link: s.link, doctor: s.link.doctor });
    }
    return out.sort((a, b) => a.instance.startTime.localeCompare(b.instance.startTime));
  }

  /**
   * Slot list for patients (PAT-09): upcoming occurrences of a doctor's (or clinic's) sittings,
   * merged with live instance state and booking counts.
   */
  async slots(filter: { doctorId?: string; clinicId?: string }, days = 7): Promise<SlotView[]> {
    const rules = await this.settings.rules();
    const sittings = await this.prisma.sitting.findMany({
      where: {
        active: true,
        link: {
          status: 'APPROVED',
          ...(filter.doctorId ? { doctorId: filter.doctorId } : {}),
          ...(filter.clinicId ? { clinicId: filter.clinicId } : {}),
          clinic: { verification: 'APPROVED', active: true },
          doctor: { verification: 'APPROVED' },
        },
      },
      include: sittingInclude,
    });
    if (!sittings.length) return [];
    const today = todayIST();
    const last = addDays(today, days - 1);
    const doctorIds = [...new Set(sittings.map((s) => s.link.doctorId))];
    const [exceptions, instances] = await Promise.all([
      this.prisma.sittingException.findMany({ where: { doctorId: { in: doctorIds }, toDate: { gte: today }, fromDate: { lte: last } } }),
      this.prisma.sittingInstance.findMany({
        where: { sittingId: { in: sittings.map((s) => s.id) }, date: { gte: today, lte: last } },
        include: { _count: { select: { bookings: { where: { status: { notIn: ['CANCELLED'] } } } } } },
      }),
    ]);
    const now = new Date();
    const out: SlotView[] = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(today, i);
      for (const s of sittings) {
        if (!sittingOccursOn(s, date)) continue;
        const inst = instances.find((x) => x.sittingId === s.id && x.date === date);
        const times = inst ? { startTime: inst.startTime, endTime: inst.endTime } : applyExceptions(s, date, exceptions.filter((e) => e.doctorId === s.link.doctorId));
        if (!times) continue;
        const start = istDateTime(date, times.startTime);
        const end = istDateTime(date, times.endTime);
        if (end.getTime() < now.getTime()) continue;
        const booked = inst?._count.bookings ?? 0;
        const status = inst?.status ?? 'SCHEDULED';
        let bookable: string = checkBookable({
          now,
          sittingStart: start,
          sittingEnd: end,
          windowHours: effectiveBookingWindowHours(s.link.doctor.defaultBookingWindowHours, s.link.clinic.bookingWindowHours),
          cutoffMinutes: s.link.clinic.cutoffMinutes ?? rules.defaultCutoffMinutes,
          bookedCount: booked,
          maxPatients: s.maxPatients,
          status,
        });
        if (bookable === 'OK' && inst && !inst.bookingsOpen) bookable = 'CLOSED';
        out.push({
          sittingId: s.id,
          date,
          startTime: times.startTime,
          endTime: times.endTime,
          clinicId: s.link.clinicId,
          clinicName: s.link.clinic.name,
          clinicArea: s.link.clinic.area.name,
          status,
          bookable,
          booked,
          maxPatients: s.maxPatients,
          consultationFee: s.link.consultationFee,
          label: i === 0 ? 'LATER_TODAY' : i === 1 ? 'TOMORROW' : date,
        });
      }
    }
    return out.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  }
}

@Global()
@Module({ providers: [SchedulingService], exports: [SchedulingService] })
export class SchedulingModule {}
