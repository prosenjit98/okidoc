import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  addDays,
  doctorProfileSchema,
  doctorSittingSchema,
  exceptionSchema,
  freeHoursSchema,
  instanceActionSchema,
  linkRequestByDoctorSchema,
  linkRespondSchema,
  presenceSchema,
  sittingSchema,
} from '@okidoc/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../../common/auth';
import { bad, forbidden, must, Zod } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from '../platform/platform.services';
import { QueueService } from '../queue/queue.service';
import { RealtimeService } from '../realtime/realtime.gateway';
import { EarningsService } from '../reports/earnings.service';
import { SchedulingService, sittingOccursOn, todayIST } from '../scheduling/scheduling.service';
import { StorageService, UploadedFile as StoredFile } from '../storage/storage.service';

const PRESENCE_TO_ACTION: Record<string, string> = { ONLINE: 'ONLINE', NOT_ARRIVED: 'OFFLINE', ON_BREAK: 'PAUSE', DELAYED: 'DELAY' };

@Roles('DOCTOR')
@Controller('doctor')
export class DoctorController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
    private readonly queue: QueueService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly entitlements: EntitlementsService,
    private readonly earnings: EarningsService,
    private readonly storage: StorageService,
  ) {}

  private async doctor(u: AuthUser) {
    return must(await this.prisma.doctor.findUnique({ where: { userId: u.id } }), 'Doctor profile');
  }

  // ---------------- profile & verification (DOC-01, DOC-11)

  @Get('profile')
  async profile(@CurrentUser() u: AuthUser) {
    const d = await this.prisma.doctor.findUniqueOrThrow({
      where: { userId: u.id },
      include: { specialties: true, documents: { select: { id: true, kind: true, createdAt: true } }, user: { select: { name: true, phone: true } } },
    });
    return d;
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() u: AuthUser, @Body(new Zod(doctorProfileSchema)) dto: z.infer<typeof doctorProfileSchema>) {
    const d = await this.doctor(u);
    const { specialtyIds, ...rest } = dto;
    // Changing registration details after approval sends the profile back for review.
    const needsReview = d.verification === 'APPROVED' && ((rest.registrationNo && rest.registrationNo !== d.registrationNo) || (rest.council && rest.council !== d.council));
    return this.prisma.doctor.update({
      where: { id: d.id },
      data: {
        ...rest,
        ...(specialtyIds ? { specialties: { set: specialtyIds.map((id) => ({ id })) } } : {}),
        ...(needsReview ? { verification: 'PENDING' } : {}),
      },
      include: { specialties: true },
    });
  }

  @Post('photo')
  @UseInterceptors(FileInterceptor('file'))
  async photo(@CurrentUser() u: AuthUser, @UploadedFile() file: StoredFile) {
    const d = await this.doctor(u);
    const key = await this.storage.save(file, 'doctors', 'public', { maxMb: 5, imagesOnly: true });
    return this.prisma.doctor.update({ where: { id: d.id }, data: { photoUrl: this.storage.publicUrl(key) } });
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  async document(@CurrentUser() u: AuthUser, @UploadedFile() file: StoredFile, @Body('kind') kind = 'REGISTRATION') {
    const d = await this.doctor(u);
    const key = await this.storage.save(file, 'doctor-docs', 'private');
    return this.prisma.doctorDocument.create({ data: { doctorId: d.id, kind: String(kind).toUpperCase().slice(0, 20), fileKey: key } });
  }

  @HttpCode(200)
  @Post('verification/submit')
  async submit(@CurrentUser() u: AuthUser) {
    const d = await this.prisma.doctor.findUniqueOrThrow({ where: { userId: u.id }, include: { documents: true, specialties: true } });
    if (!d.registrationNo || !d.council) throw bad('INCOMPLETE', 'Add your registration number and council first');
    if (!d.specialties.length) throw bad('INCOMPLETE', 'Choose at least one specialty');
    if (!d.documents.length) throw bad('INCOMPLETE', 'Upload your registration certificate');
    return this.prisma.doctor.update({ where: { id: d.id }, data: { verification: 'PENDING', verificationNote: null } });
  }

  // ---------------- schedule (DOC-02..06)

  @Get('schedule')
  async schedule(@CurrentUser() u: AuthUser) {
    const d = await this.doctor(u);
    const links = await this.prisma.clinicDoctorLink.findMany({
      where: { doctorId: d.id, status: { in: ['APPROVED', 'PENDING'] } },
      include: {
        clinic: { select: { id: true, name: true, phone: true, addressLine: true, code: true, area: { select: { name: true } } } },
        sittings: { where: { active: true }, orderBy: { startTime: 'asc' } },
      },
    });
    const approved = links.filter((l) => l.status === 'APPROVED');
    const sittings = approved.flatMap((l) => l.sittings.map((s) => ({ ...s, clinicName: l.clinic.name, clinicId: l.clinicId, fee: l.consultationFee })));
    const days = new Set(sittings.flatMap((s) => (s.recurrence === 'SPECIFIC_DATES' ? [] : s.weekdays)));
    const today = todayIST();
    const week = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i);
      return { date, items: sittings.filter((s) => sittingOccursOn(s, date)).map((s) => ({ sittingId: s.id, clinicName: s.clinicName, startTime: s.startTime, endTime: s.endTime })) };
    });
    const exceptions = await this.prisma.sittingException.findMany({ where: { doctorId: d.id, toDate: { gte: today } }, orderBy: { fromDate: 'asc' } });
    return {
      summary: { chambers: approved.length, sittings: sittings.length, daysAWeek: days.size },
      bookingWindowHours: d.defaultBookingWindowHours,
      links,
      week,
      exceptions,
    };
  }

  private async ownLink(doctorId: string, linkId: string) {
    const link = must(await this.prisma.clinicDoctorLink.findUnique({ where: { id: linkId }, include: { clinic: true } }), 'Clinic link');
    if (link.doctorId !== doctorId) throw forbidden();
    if (link.status !== 'APPROVED') throw bad('LINK_NOT_APPROVED', 'This clinic connection is not approved yet');
    return link;
  }

  private async notifyClinicOfChange(clinicId: string, text: string) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (clinic) await this.notifications.notify(clinic.ownerId, 'SITTING_CHANGED', { title: 'Sitting changed', body: text, data: { clinicId } });
    this.realtime.emitClinic(clinicId, 'roster:changed', { clinicId });
  }

  @Post('sittings')
  async addSitting(@CurrentUser() u: AuthUser, @Body(new Zod(doctorSittingSchema)) dto: z.infer<typeof doctorSittingSchema>) {
    const d = await this.doctor(u);
    const link = await this.ownLink(d.id, dto.linkId);
    if (dto.endTime <= dto.startTime) throw bad('BAD_TIME', 'End time must be after start time');
    const existing = await this.prisma.sitting.count({ where: { link: { clinicId: link.clinicId }, active: true } });
    await this.entitlements.requireWithinLimit(link.clinicId, 'MAX_SITTINGS', existing);
    const { linkId, ...rest } = dto;
    const s = await this.prisma.sitting.create({
      data: { ...rest, linkId, specificDates: rest.specificDates ?? [], validFrom: rest.validFrom ?? todayIST(), createdById: u.id },
    });
    await this.notifyClinicOfChange(link.clinicId, `Dr. ${u.name} added a sitting (${dto.startTime}–${dto.endTime}).`);
    return s;
  }

  @Patch('sittings/:id')
  async editSitting(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(sittingSchema.partial())) dto: Partial<z.infer<typeof sittingSchema>>) {
    const d = await this.doctor(u);
    const s = must(await this.prisma.sitting.findUnique({ where: { id }, include: { link: true } }), 'Sitting');
    if (s.link.doctorId !== d.id) throw forbidden();
    const updated = await this.prisma.sitting.update({ where: { id }, data: dto });
    await this.notifyClinicOfChange(s.link.clinicId, `Dr. ${u.name} changed a sitting.`);
    return updated;
  }

  @Delete('sittings/:id')
  async removeSitting(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const d = await this.doctor(u);
    const s = must(await this.prisma.sitting.findUnique({ where: { id }, include: { link: true } }), 'Sitting');
    if (s.link.doctorId !== d.id) throw forbidden();
    await this.prisma.sitting.update({ where: { id }, data: { active: false, validTo: todayIST() } });
    await this.notifyClinicOfChange(s.link.clinicId, `Dr. ${u.name} removed a sitting.`);
    return { ok: true };
  }

  /** DOC-04 days off: booked patients are notified and refunded via sitting cancellation. */
  @Post('exceptions')
  async addException(@CurrentUser() u: AuthUser, @Body(new Zod(exceptionSchema)) dto: z.infer<typeof exceptionSchema>) {
    const d = await this.doctor(u);
    if (dto.toDate < dto.fromDate) throw bad('BAD_RANGE', 'End date must be on or after start date');
    const ex = await this.prisma.sittingException.create({ data: { ...dto, doctorId: d.id } });
    if (dto.type === 'OFF') {
      const affected = await this.prisma.sittingInstance.findMany({
        where: {
          date: { gte: dto.fromDate, lte: dto.toDate },
          status: { in: ['SCHEDULED', 'ONLINE', 'PAUSED'] },
          sitting: { link: { doctorId: d.id }, ...(dto.sittingId ? { id: dto.sittingId } : {}) },
        },
      });
      for (const i of affected) await this.queue.cancelInstance(i.id, u.id, dto.reason ?? 'Doctor is not sitting on this day', 'DOCTOR');
    } else if (dto.type === 'CHANGED_TIME' && dto.startTime && dto.endTime) {
      await this.prisma.sittingInstance.updateMany({
        where: {
          date: { gte: dto.fromDate, lte: dto.toDate },
          status: 'SCHEDULED',
          sitting: { link: { doctorId: d.id }, ...(dto.sittingId ? { id: dto.sittingId } : {}) },
        },
        data: { startTime: dto.startTime, endTime: dto.endTime },
      });
    }
    return ex;
  }

  @Delete('exceptions/:id')
  async removeException(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const d = await this.doctor(u);
    await this.prisma.sittingException.deleteMany({ where: { id, doctorId: d.id } });
    return { ok: true };
  }

  @Patch('settings')
  async settings(@CurrentUser() u: AuthUser, @Body(new Zod(z.object({ defaultBookingWindowHours: z.number().int().min(1).max(720) }))) dto: { defaultBookingWindowHours: number }) {
    const d = await this.doctor(u);
    return this.prisma.doctor.update({ where: { id: d.id }, data: dto });
  }

  // ---------------- clinic connections (DOC-07)

  @Get('links')
  async links(@CurrentUser() u: AuthUser) {
    const d = await this.doctor(u);
    return this.prisma.clinicDoctorLink.findMany({
      where: { doctorId: d.id },
      include: { clinic: { select: { id: true, name: true, code: true, addressLine: true, area: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @HttpCode(200)
  @Post('links/:id/respond')
  async respond(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(linkRespondSchema)) dto: z.infer<typeof linkRespondSchema>) {
    const d = await this.doctor(u);
    const link = must(await this.prisma.clinicDoctorLink.findUnique({ where: { id }, include: { clinic: true } }), 'Request');
    if (link.doctorId !== d.id) throw forbidden();
    if (link.status !== 'PENDING' || link.initiatedBy !== 'CLINIC') throw bad('BAD_STATE', 'There is nothing to respond to');
    const updated = await this.prisma.clinicDoctorLink.update({
      where: { id },
      data: { status: dto.accept ? 'APPROVED' : 'DECLINED', declineReason: dto.accept ? null : dto.reason ?? null, respondedAt: new Date() },
    });
    await this.notifications.notify(link.clinic.ownerId, 'LINK_RESPONSE', {
      title: dto.accept ? 'Doctor accepted' : 'Doctor declined',
      body: `Dr. ${u.name} ${dto.accept ? 'accepted' : 'declined'} your request${dto.reason ? `: ${dto.reason}` : ''}.`,
      data: { clinicId: link.clinicId },
    });
    this.realtime.emitClinic(link.clinicId, 'roster:changed', { clinicId: link.clinicId });
    return updated;
  }

  @Post('links/request')
  async request(@CurrentUser() u: AuthUser, @Body(new Zod(linkRequestByDoctorSchema)) dto: z.infer<typeof linkRequestByDoctorSchema>) {
    const d = await this.doctor(u);
    const clinic = must(await this.prisma.clinic.findUnique({ where: { code: dto.clinicCode.toUpperCase() } }), 'Clinic');
    const existing = await this.prisma.clinicDoctorLink.findUnique({ where: { clinicId_doctorId: { clinicId: clinic.id, doctorId: d.id } } });
    if (existing && ['APPROVED', 'PENDING'].includes(existing.status)) throw bad('ALREADY_LINKED', 'You already have a connection with this clinic');
    const link = existing
      ? await this.prisma.clinicDoctorLink.update({ where: { id: existing.id }, data: { status: 'PENDING', initiatedBy: 'DOCTOR', declineReason: null } })
      : await this.prisma.clinicDoctorLink.create({ data: { clinicId: clinic.id, doctorId: d.id, initiatedBy: 'DOCTOR' } });
    await this.notifications.notify(clinic.ownerId, 'LINK_REQUEST', {
      title: 'Doctor wants to join',
      body: `Dr. ${u.name} asked to sit at ${clinic.name}.`,
      data: { clinicId: clinic.id, linkId: link.id },
    });
    this.realtime.emitClinic(clinic.id, 'roster:changed', { clinicId: clinic.id });
    return link;
  }

  // ---------------- queue (DOC-08)

  @Get('queue')
  async today(@CurrentUser() u: AuthUser, @Query('date') date?: string) {
    const d = await this.doctor(u);
    const day = date ?? todayIST();
    const links = await this.prisma.clinicDoctorLink.findMany({ where: { doctorId: d.id, status: 'APPROVED' }, select: { clinicId: true } });
    const out = [];
    for (const l of links) {
      const items = await this.scheduling.clinicInstancesForDate(l.clinicId, day);
      for (const it of items.filter((x) => x.link.doctorId === d.id)) out.push(await this.queue.staffView(it.instance.id));
    }
    return out.sort((a, b) => a.snapshot.startTime.localeCompare(b.snapshot.startTime));
  }

  private async ownInstance(doctorId: string, instanceId: string) {
    const ctx = await this.queue.ctx(instanceId);
    if (ctx.sitting.link.doctorId !== doctorId) throw forbidden();
    return ctx;
  }

  @HttpCode(200)
  @Post('instances/:id/presence')
  async presence(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(presenceSchema)) dto: z.infer<typeof presenceSchema>) {
    const d = await this.doctor(u);
    await this.ownInstance(d.id, id);
    return this.queue.instanceAction(id, PRESENCE_TO_ACTION[dto.status], u.id, { delayMinutes: dto.delayMinutes });
  }

  @HttpCode(200)
  @Post('instances/:id/action')
  async action(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(instanceActionSchema)) dto: z.infer<typeof instanceActionSchema>) {
    const d = await this.doctor(u);
    await this.ownInstance(d.id, id);
    if (!d.canRunQueue && ['CALL_NEXT', 'END'].includes(dto.action)) throw forbidden('The clinic runs this queue');
    if (dto.action === 'CANCEL') return this.queue.cancelInstance(id, u.id, dto.reason ?? 'Doctor cancelled the sitting', 'DOCTOR');
    return this.queue.instanceAction(id, dto.action, u.id, dto);
  }

  // ---------------- earnings & patients (DOC-09, DOC-10)

  @Get('earnings')
  async earningsReport(@CurrentUser() u: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    const d = await this.doctor(u);
    return this.earnings.compute({ doctorId: d.id }, from, to);
  }

  @Get('patients')
  async patients(@CurrentUser() u: AuthUser, @Query('q') q?: string) {
    const d = await this.doctor(u);
    const rows = await this.prisma.booking.findMany({
      where: {
        status: 'SERVED',
        instance: { sitting: { link: { doctorId: d.id } } },
        ...(q ? { patientName: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { servedAt: 'desc' },
      take: 300,
      select: {
        id: true,
        patientName: true,
        patientUserId: true,
        memberId: true,
        servedAt: true,
        note: true,
        instance: { select: { date: true, sitting: { select: { link: { select: { clinic: { select: { name: true } } } } } } } },
        sharedRecords: { where: { deletedAt: null }, select: { id: true, title: true, type: true, recordDate: true } },
      },
    });
    const map = new Map<string, any>();
    for (const r of rows) {
      const key = `${r.patientUserId ?? 'walkin'}:${r.memberId ?? ''}:${r.patientUserId ? '' : r.patientName}`;
      const e = map.get(key) ?? { key, name: r.patientName, visits: 0, lastVisit: r.instance.date, lastClinic: r.instance.sitting.link.clinic.name, sharedRecords: [] as any[], history: [] as any[] };
      e.visits++;
      e.history.push({ bookingId: r.id, date: r.instance.date, clinic: r.instance.sitting.link.clinic.name, note: r.note });
      e.sharedRecords.push(...r.sharedRecords);
      map.set(key, e);
    }
    return [...map.values()];
  }

  // ---------------- open slots / free hours (DOC-12)

  @Get('free-hours')
  async freeHours(@CurrentUser() u: AuthUser) {
    const d = await this.doctor(u);
    return this.prisma.freeHours.findMany({ where: { doctorId: d.id, active: true } });
  }

  @Post('free-hours')
  async addFreeHours(@CurrentUser() u: AuthUser, @Body(new Zod(freeHoursSchema)) dto: z.infer<typeof freeHoursSchema>) {
    const d = await this.doctor(u);
    return this.prisma.freeHours.create({ data: { ...dto, doctorId: d.id } });
  }

  @Delete('free-hours/:id')
  async removeFreeHours(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const d = await this.doctor(u);
    await this.prisma.freeHours.updateMany({ where: { id, doctorId: d.id }, data: { active: false } });
    return { ok: true };
  }

  /** Clinics with an empty chair that this doctor could request to join. */
  @Get('open-slots')
  openSlots(@Query('regionId') regionId?: string) {
    return this.prisma.openSlot.findMany({
      where: { active: true, clinic: { verification: 'APPROVED', active: true, ...(regionId ? { area: { regionId } } : {}) } },
      include: { clinic: { select: { id: true, code: true, name: true, addressLine: true, area: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

@Module({ controllers: [DoctorController] })
export class DoctorModule {}
