import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  addDays,
  bookingActionSchema,
  clinicAddDoctorSchema,
  clinicPaymentSettingsSchema,
  clinicSchema,
  ownChamberSchema,
  sittingsFromHours,
  clinicUpdateSchema,
  instanceActionSchema,
  liftBlockSchema,
  linkUpdateSchema,
  newAreaSchema,
  openSlotSchema,
  PaymentMode,
  sittingSchema,
  sittingSetSchema,
  staffSchema,
  walkInSchema,
  tidyPlace,
} from '@okidoc/shared';
import { randomInt } from 'node:crypto';
import type { Response } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { AuthUser, CurrentUser, isAdmin, loadAuthUser, Roles, verifyAccessToken } from '../../common/auth';
import { AppError, bad, conflict, forbidden, must, Zod } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { findRegion, findSameArea, regionFor } from '../../common/areas';
import { clinicHoursData, sittingOutsideHours } from '../../common/hours';
import { saveSittingSet } from '../../common/sitting-set';
import { AuditService } from '../../common/settings.service';
import { config } from '../../config';
import { AuthModule } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { hashSecret } from '../auth/crypto';
import { NoShowService } from '../noshow/noshow.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService, PaymentConfigService } from '../platform/platform.services';
import { QueueService } from '../queue/queue.service';
import { RealtimeService } from '../realtime/realtime.gateway';
import { BonusService } from '../reports/bonus.service';
import { EarningsService } from '../reports/earnings.service';
import { SchedulingService, todayIST } from '../scheduling/scheduling.service';
import { StorageService, UploadedFile as StoredFile } from '../storage/storage.service';
import { ClinicAccessService } from './clinic-access.service';

/** WEB_CONSOLE entitlement: browser clients send `x-okidoc-client: web`. */
@Injectable()
export class WebConsoleGuard implements CanActivate {
  constructor(
    private readonly entitlements: EntitlementsService,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const clinicId = req.params?.id;
    if (req.headers['x-okidoc-client'] !== 'web' || !clinicId) return true;
    const claims = verifyAccessToken(String(req.headers.authorization ?? '').replace('Bearer ', ''));
    const user = claims ? await loadAuthUser(this.prisma, claims) : null;
    if (user && isAdmin(user)) return true;
    if (!(await this.entitlements.has(clinicId, 'WEB_CONSOLE'))) {
      throw new AppError(403, 'FEATURE_LOCKED', 'Web console is not enabled for your clinic. Use the Okidoc app or contact Okidoc.', { feature: 'WEB_CONSOLE' });
    }
    return true;
  }
}

/** "  salt   lake " → "Salt Lake"; mixed-case input ("DumDum Road") is kept as typed. */
const genCode = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'OK-' + Array.from({ length: 5 }, () => a[randomInt(0, a.length)]).join('');
};

@Controller()
@UseGuards(WebConsoleGuard)
export class ClinicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClinicAccessService,
    private readonly entitlements: EntitlementsService,
    private readonly paymentConfig: PaymentConfigService,
    private readonly scheduling: SchedulingService,
    private readonly queue: QueueService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly earnings: EarningsService,
    private readonly noShows: NoShowService,
    private readonly bonus: BonusService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  // ================================================================== registration & profile

  /** CLN-01 */
  @Roles('CLINIC_OWNER')
  @Post('clinics/register')
  register(@CurrentUser() u: AuthUser, @Body(new Zod(clinicSchema)) dto: z.infer<typeof clinicSchema>) {
    return this.createClinic(u, dto);
  }

  /**
   * A doctor sets up their own chamber in one step: the clinic is registered with them as owner and they are
   * on its roster straight away (approved link, nothing to accept), so they can add sittings right after.
   */
  @Roles('DOCTOR')
  @Post('clinics/own-chamber')
  async ownChamber(@CurrentUser() u: AuthUser, @Body(new Zod(ownChamberSchema)) dto: z.infer<typeof ownChamberSchema>) {
    const doctor = must(await this.prisma.doctor.findUnique({ where: { userId: u.id } }), 'Doctor profile');
    const { consultationFee, sittings: sent, ...clinicDto } = dto;
    // The doctor's sitting times: as edited on the form, or a copy of the chamber's opening hours.
    const sittings: z.infer<typeof sittingSchema>[] = sent ?? sittingsFromHours(dto.weeklyHours).map((s) => ({ ...s, recurrence: 'WEEKLY' as const }));
    if (sittings.some((s) => s.endTime <= s.startTime)) throw bad('BAD_TIME', 'Each sitting must end after it starts');
    const clinic = await this.createClinic(u, clinicDto);
    const link = await this.prisma.clinicDoctorLink.create({
      data: { clinicId: clinic.id, doctorId: doctor.id, status: 'APPROVED', initiatedBy: 'DOCTOR', consultationFee, respondedAt: new Date() },
    });
    // The chamber exists now, so a plan limit must not fail the request (a retry would register a second chamber):
    // save the sittings that fit and report the rest.
    let created = 0;
    for (const s of sittings) {
      try {
        await this.entitlements.requireWithinLimit(clinic.id, 'MAX_SITTINGS', created);
      } catch {
        break;
      }
      await this.prisma.sitting.create({ data: { ...s, linkId: link.id, specificDates: s.specificDates ?? [], validFrom: s.validFrom ?? todayIST(), createdById: u.id } });
      created++;
    }
    return { clinic, linkId: link.id, sittings: created, sittingsSkipped: sittings.length - created };
  }

  private async createClinic(u: AuthUser, dto: z.infer<typeof clinicSchema>) {
    must(await this.prisma.area.findUnique({ where: { id: dto.areaId } }), 'Area');
    let code = genCode();
    while (await this.prisma.clinic.findUnique({ where: { code } })) code = genCode();
    const { weeklyHours, ...rest } = dto;
    const clinic = await this.prisma.clinic.create({ data: { ...rest, ...clinicHoursData(weeklyHours), code, ownerId: u.id, verification: 'PENDING' } });
    await this.auth.ensureRole(u.id, 'CLINIC_OWNER', clinic.id);
    await this.audit.log(u.id, 'CLINIC_REGISTERED', 'Clinic', clinic.id, undefined, { name: clinic.name, code });
    return clinic;
  }

  /**
   * A clinic whose locality is not in the area list adds it (anywhere in India). An existing area with the same
   * name and PIN in that district is reused, so patients see one entry. Okidoc admins can rename or merge later.
   */
  // Doctors too: setting up their own chamber uses the same area picker.
  @Roles('CLINIC_OWNER', 'DOCTOR')
  @Post('areas')
  async addArea(@CurrentUser() u: AuthUser, @Body(new Zod(newAreaSchema)) dto: z.infer<typeof newAreaSchema>) {
    const name = tidyPlace(dto.name);
    const district = tidyPlace(dto.district);
    let region = await findRegion(this.prisma, dto.state, district);
    const existing = region && (await findSameArea(this.prisma, region.id, dto.pin, name));
    if (existing) return existing;
    const since = new Date(Date.now() - 86_400_000);
    if ((await this.prisma.auditLog.count({ where: { actorId: u.id, action: 'AREA_ADDED', createdAt: { gte: since } } })) >= 5) {
      throw new AppError(429, 'TOO_MANY_AREAS', 'You have added several areas today. Please pick one from the list, or contact Okidoc support.');
    }
    region ??= await regionFor(this.prisma, dto.state, district);
    const area = await this.prisma.area.create({ data: { regionId: region.id, name, pin: dto.pin }, include: { region: true } });
    await this.audit.log(u.id, 'AREA_ADDED', 'Area', area.id, undefined, { name, pin: dto.pin, district, state: dto.state });
    return area;
  }

  @Get('clinic/mine')
  async mine(@CurrentUser() u: AuthUser) {
    const ids = [...new Set(u.assignments.filter((a) => a.clinicId).map((a) => a.clinicId!))];
    const clinics = await this.prisma.clinic.findMany({ where: { OR: [{ id: { in: ids } }, { ownerId: u.id }] }, include: { area: true } });
    return Promise.all(
      clinics.map(async (c) => ({
        ...c,
        myRole: c.ownerId === u.id || u.assignments.some((a) => a.role === 'CLINIC_OWNER' && a.clinicId === c.id) ? 'CLINIC_OWNER' : 'QUEUE_MANAGER',
        entitlements: await this.entitlements.forClinic(c.id),
      })),
    );
  }

  @Get('clinic/:id')
  async get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const { clinic, isOwner } = await this.access.check(u, id, 'staff');
    const [doctors, pending, plan] = await Promise.all([
      this.prisma.clinicDoctorLink.count({ where: { clinicId: id, status: 'APPROVED' } }),
      this.prisma.clinicDoctorLink.findMany({
        where: { clinicId: id, status: 'PENDING', initiatedBy: 'CLINIC' },
        select: { doctor: { select: { user: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.entitlements.forClinic(id),
    ]);
    return {
      ...clinic,
      myRole: isOwner ? 'CLINIC_OWNER' : 'QUEUE_MANAGER',
      approvedDoctors: doctors,
      // Requests the clinic sent that no doctor has answered yet: the empty console says who it is waiting for.
      pendingDoctors: pending.map((l) => l.doctor.user.name),
      entitlements: plan,
    };
  }

  /** PAT-16: the clinic sees its rating, the star breakdown and recent patient comments (first names only). */
  @Get('clinic/:id/reviews')
  async reviews(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const { clinic } = await this.access.check(u, id, 'owner');
    const [rows, dist] = await Promise.all([
      this.prisma.review.findMany({
        where: { clinicId: id, hidden: false },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { user: { select: { name: true } }, doctor: { select: { user: { select: { name: true } } } } },
      }),
      this.prisma.review.groupBy({ by: ['clinicRating'], where: { clinicId: id, hidden: false, clinicRating: { not: null } }, _count: true }),
    ]);
    const breakdown = Object.fromEntries([5, 4, 3, 2, 1].map((n) => [n, dist.find((d) => d.clinicRating === n)?._count ?? 0]));
    return {
      ratingAvg: clinic.ratingAvg,
      ratingCount: clinic.ratingCount,
      breakdown,
      reviews: rows.map((r) => ({
        id: r.id,
        clinicRating: r.clinicRating,
        doctorRating: r.rating,
        doctor: r.doctor.user.name,
        comment: r.comment,
        by: r.user.name.split(' ')[0],
        createdAt: r.createdAt,
      })),
    };
  }

  @Patch('clinic/:id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(clinicUpdateSchema)) dto: z.infer<typeof clinicUpdateSchema>) {
    const { clinic } = await this.access.check(u, id, 'owner');
    const { weeklyHours, ...rest } = dto;
    const updated = await this.prisma.clinic.update({ where: { id }, data: { ...rest, ...clinicHoursData(weeklyHours) } });
    await this.audit.log(u.id, 'CLINIC_UPDATED', 'Clinic', id, clinic, updated);
    return updated;
  }

  @Post('clinic/:id/photos')
  @UseInterceptors(FileInterceptor('file'))
  async addPhoto(@CurrentUser() u: AuthUser, @Param('id') id: string, @UploadedFile() file: StoredFile) {
    const { clinic } = await this.access.check(u, id, 'owner');
    if (clinic.photos.length >= 8) throw bad('PHOTO_LIMIT', 'You can add up to 8 photos');
    const key = await this.storage.save(file, 'clinics', 'public', { maxMb: 5, imagesOnly: true });
    return this.prisma.clinic.update({ where: { id }, data: { photos: { push: this.storage.publicUrl(key) } } });
  }

  @Delete('clinic/:id/photos')
  async removePhoto(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('url') url: string) {
    const { clinic } = await this.access.check(u, id, 'owner');
    return this.prisma.clinic.update({ where: { id }, data: { photos: clinic.photos.filter((p) => p !== url) } });
  }

  @Get('clinic/:id/entitlements')
  async ent(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.check(u, id, 'staff');
    return this.entitlements.forClinic(id);
  }

  // ================================================================== roster (CLN-03..07)

  @Get('clinic/:id/doctors')
  async roster(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('q') q?: string) {
    await this.access.check(u, id, 'staff');
    const links = await this.prisma.clinicDoctorLink.findMany({
      where: {
        clinicId: id,
        status: { not: 'REMOVED' },
        ...(q
          ? {
              doctor: {
                OR: [
                  { user: { name: { contains: q, mode: 'insensitive' } } },
                  { specialties: { some: { name: { contains: q, mode: 'insensitive' } } } },
                ],
              },
            }
          : {}),
      },
      include: {
        doctor: { include: { user: { select: { name: true, phone: true } }, specialties: { select: { name: true } } } },
        sittings: { where: { active: true }, orderBy: { startTime: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const approved = links.filter((l) => l.status === 'APPROVED');
    const scheduled = approved.filter((l) => l.sittings.length).length;
    const activeDays = new Set(approved.flatMap((l) => l.sittings.flatMap((s) => s.weekdays))).size;
    const view = (l: (typeof links)[number]) => ({
      linkId: l.id,
      status: l.status,
      initiatedBy: l.initiatedBy,
      declineReason: l.declineReason,
      consultationFee: l.consultationFee,
      clinicSplitPercent: l.clinicSplitPercent,
      walkInEvery: l.walkInEvery,
      avgConsultMinutes: l.avgConsultMinutes,
      doctor: {
        id: l.doctor.id,
        name: l.doctor.user.name,
        degrees: l.doctor.degrees,
        specialties: l.doctor.specialties.map((s) => s.name),
        verification: l.doctor.verification,
        photoUrl: l.doctor.photoUrl,
      },
      sittings: l.sittings,
    });
    return {
      summary: { doctors: approved.length, scheduled, activeDays },
      requests: links.filter((l) => l.status === 'PENDING' || l.status === 'DECLINED').map(view),
      doctors: approved.map(view),
    };
  }

  @Get('clinic/:id/doctors/search')
  async searchDoctors(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('q') q = '') {
    await this.access.check(u, id, 'owner');
    if (q.trim().length < 2) return [];
    const digits = q.replace(/\D/g, '');
    const doctors = await this.prisma.doctor.findMany({
      where: {
        OR: [
          { user: { name: { contains: q, mode: 'insensitive' } } },
          { registrationNo: { contains: q, mode: 'insensitive' } },
          ...(digits.length >= 6 ? [{ user: { phone: { contains: digits } } }] : []),
        ],
        user: { status: 'ACTIVE' },
      },
      include: { user: { select: { name: true } }, specialties: { select: { name: true } } },
      take: 20,
    });
    return doctors.map((d) => ({ id: d.id, name: d.user.name, degrees: d.degrees, specialties: d.specialties.map((s) => s.name), verification: d.verification, photoUrl: d.photoUrl }));
  }

  @Post('clinic/:id/doctors')
  async addDoctor(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(clinicAddDoctorSchema)) dto: z.infer<typeof clinicAddDoctorSchema>) {
    const { clinic } = await this.access.check(u, id, 'owner');
    const count = await this.prisma.clinicDoctorLink.count({ where: { clinicId: id, status: { in: ['APPROVED', 'PENDING'] } } });
    await this.entitlements.requireWithinLimit(id, 'MAX_DOCTORS', count);
    let doctorId = dto.doctorId;
    if (!doctorId && dto.invitePhone) {
      const existing = await this.prisma.user.findUnique({ where: { phone: dto.invitePhone }, include: { doctor: true } });
      if (existing?.doctor) doctorId = existing.doctor.id;
      else {
        await this.notifications.textPhone(
          dto.invitePhone,
          `${clinic.name} invites you to sit on Okidoc. Install the Okidoc app, sign up as a Doctor and use clinic code ${clinic.code} to connect.`,
        );
        return { invited: true, phone: dto.invitePhone };
      }
    }
    const doctor = must(await this.prisma.doctor.findUnique({ where: { id: doctorId! }, include: { user: true } }), 'Doctor');
    const existing = await this.prisma.clinicDoctorLink.findUnique({ where: { clinicId_doctorId: { clinicId: id, doctorId: doctor.id } } });
    if (existing && ['APPROVED', 'PENDING'].includes(existing.status)) throw conflict('ALREADY_LINKED', 'This doctor is already on your roster or has a pending request');
    // The owner adding themselves (a doctor running their own chamber) is approved at once: no request to accept.
    const self = doctor.userId === u.id;
    const data = {
      status: self ? ('APPROVED' as const) : ('PENDING' as const),
      initiatedBy: 'CLINIC',
      consultationFee: dto.consultationFee,
      clinicSplitPercent: dto.clinicSplitPercent,
      declineReason: null,
      respondedAt: self ? new Date() : null,
    };
    const link = existing
      ? await this.prisma.clinicDoctorLink.update({ where: { id: existing.id }, data })
      : await this.prisma.clinicDoctorLink.create({ data: { ...data, clinicId: id, doctorId: doctor.id } });
    if (self) {
      this.realtime.emitClinic(id, 'roster:changed', { clinicId: id });
      return { ...link, approved: true };
    }
    await this.notifications.notify(doctor.userId, 'LINK_REQUEST', {
      title: 'New chamber request',
      body: `${clinic.name} wants to add you to their chamber roster.`,
      data: { linkId: link.id, clinicId: id },
    });
    this.realtime.emitClinic(id, 'roster:changed', { clinicId: id });
    return link;
  }

  @HttpCode(200)
  @Post('clinic/:id/links/:linkId/respond')
  async respondLink(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('linkId') linkId: string, @Body(new Zod(z.object({ accept: z.boolean(), reason: z.string().max(200).optional() }))) dto: { accept: boolean; reason?: string }) {
    await this.access.check(u, id, 'owner');
    const link = must(await this.prisma.clinicDoctorLink.findFirst({ where: { id: linkId, clinicId: id }, include: { doctor: true } }), 'Request');
    if (link.status !== 'PENDING' || link.initiatedBy !== 'DOCTOR') throw bad('BAD_STATE', 'There is nothing to respond to');
    if (dto.accept) {
      const count = await this.prisma.clinicDoctorLink.count({ where: { clinicId: id, status: 'APPROVED' } });
      await this.entitlements.requireWithinLimit(id, 'MAX_DOCTORS', count);
    }
    const updated = await this.prisma.clinicDoctorLink.update({
      where: { id: linkId },
      data: { status: dto.accept ? 'APPROVED' : 'DECLINED', declineReason: dto.accept ? null : dto.reason ?? null, respondedAt: new Date() },
    });
    await this.notifications.notify(link.doctor.userId, 'LINK_RESPONSE', {
      title: dto.accept ? 'Chamber request accepted' : 'Chamber request declined',
      body: dto.accept ? 'You can now add your sittings at this clinic.' : dto.reason ?? 'The clinic declined your request.',
      data: { clinicId: id },
    });
    this.realtime.emitClinic(id, 'roster:changed', { clinicId: id });
    return updated;
  }

  @Patch('clinic/:id/links/:linkId')
  async updateLink(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('linkId') linkId: string, @Body(new Zod(linkUpdateSchema)) dto: z.infer<typeof linkUpdateSchema>) {
    await this.access.check(u, id, 'owner');
    const before = must(await this.prisma.clinicDoctorLink.findFirst({ where: { id: linkId, clinicId: id } }), 'Doctor');
    const updated = await this.prisma.clinicDoctorLink.update({ where: { id: linkId }, data: dto });
    await this.audit.log(u.id, 'LINK_UPDATED', 'ClinicDoctorLink', linkId, before, updated);
    this.realtime.emitClinic(id, 'roster:changed', { clinicId: id });
    return updated;
  }

  @Delete('clinic/:id/links/:linkId')
  async removeLink(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('linkId') linkId: string) {
    await this.access.check(u, id, 'owner');
    const link = must(await this.prisma.clinicDoctorLink.findFirst({ where: { id: linkId, clinicId: id } }), 'Doctor');
    await this.prisma.clinicDoctorLink.update({ where: { id: linkId }, data: { status: 'REMOVED' } });
    await this.prisma.sitting.updateMany({ where: { linkId }, data: { active: false, validTo: todayIST() } });
    const future = await this.prisma.sittingInstance.findMany({ where: { sitting: { linkId }, date: { gte: todayIST() }, status: { in: ['SCHEDULED'] } } });
    for (const i of future) await this.queue.cancelInstance(i.id, u.id, 'Doctor no longer sits at this clinic', 'CLINIC');
    await this.audit.log(u.id, 'LINK_REMOVED', 'ClinicDoctorLink', linkId, link);
    this.realtime.emitClinic(id, 'roster:changed', { clinicId: id });
    return { ok: true };
  }

  /** Day-by-day sitting editor: add several sittings at once, or edit one (keeping its bookings) and add others. */
  @Post('clinic/:id/links/:linkId/sittings/set')
  async setSittings(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('linkId') linkId: string, @Body(new Zod(sittingSetSchema)) dto: z.infer<typeof sittingSetSchema>) {
    await this.access.check(u, id, 'owner');
    const link = must(await this.prisma.clinicDoctorLink.findFirst({ where: { id: linkId, clinicId: id }, include: { doctor: true, clinic: true } }), 'Doctor');
    if (link.status !== 'APPROVED') throw bad('LINK_NOT_APPROVED', 'The doctor has not accepted yet');
    const r = await saveSittingSet(this.prisma, this.entitlements, { clinicId: id, linkId, editId: dto.id, sittings: dto.sittings, userId: u.id, weeklyHours: link.clinic.weeklyHours });
    // A doctor running their own chamber doesn't need to be told about their own change.
    if (link.doctor.userId !== u.id) {
      await this.notifications.notify(link.doctor.userId, 'SITTING_CHANGED', {
        title: r.updated ? 'Sitting changed' : 'New sitting added',
        body: `${link.clinic.name} ${r.updated ? 'changed your sittings' : `added ${r.created > 1 ? `${r.created} sittings` : 'a sitting'}`}. Review it in My schedule.`,
        data: { clinicId: id },
      });
    }
    this.realtime.emitClinic(id, 'roster:changed', { clinicId: id });
    return r;
  }

  @Post('clinic/:id/links/:linkId/sittings')
  async addSitting(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('linkId') linkId: string, @Body(new Zod(sittingSchema)) dto: z.infer<typeof sittingSchema>) {
    await this.access.check(u, id, 'owner');
    const link = must(await this.prisma.clinicDoctorLink.findFirst({ where: { id: linkId, clinicId: id }, include: { doctor: true, clinic: true } }), 'Doctor');
    if (link.status !== 'APPROVED') throw bad('LINK_NOT_APPROVED', 'The doctor has not accepted yet');
    if (dto.endTime <= dto.startTime) throw bad('BAD_TIME', 'End time must be after start time');
    const count = await this.prisma.sitting.count({ where: { link: { clinicId: id }, active: true } });
    await this.entitlements.requireWithinLimit(id, 'MAX_SITTINGS', count);
    const s = await this.prisma.sitting.create({ data: { ...dto, linkId, specificDates: dto.specificDates ?? [], validFrom: dto.validFrom ?? todayIST(), createdById: u.id } });
    await this.notifications.notify(link.doctor.userId, 'SITTING_CHANGED', {
      title: 'New sitting added',
      body: `${link.clinic.name} added a sitting ${dto.startTime}–${dto.endTime}. Review it in My schedule.`,
      data: { clinicId: id },
    });
    this.realtime.emitClinic(id, 'roster:changed', { clinicId: id });
    // Saved either way; the console warns when the sitting is outside the clinic's opening hours.
    return { ...s, outsideHours: sittingOutsideHours(link.clinic.weeklyHours, s) };
  }

  @Patch('clinic/:id/sittings/:sid')
  async editSitting(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('sid') sid: string, @Body(new Zod(sittingSchema.partial())) dto: Partial<z.infer<typeof sittingSchema>>) {
    await this.access.check(u, id, 'owner');
    const s = must(await this.prisma.sitting.findFirst({ where: { id: sid, link: { clinicId: id } }, include: { link: { include: { doctor: true, clinic: { select: { weeklyHours: true } } } } } }), 'Sitting');
    const updated = await this.prisma.sitting.update({ where: { id: sid }, data: dto });
    await this.notifications.notify(s.link.doctor.userId, 'SITTING_CHANGED', { title: 'Sitting changed', body: 'A clinic changed one of your sittings.', data: { clinicId: id } });
    this.realtime.emitClinic(id, 'roster:changed', { clinicId: id });
    return { ...updated, outsideHours: sittingOutsideHours(s.link.clinic.weeklyHours, updated) };
  }

  @Delete('clinic/:id/sittings/:sid')
  async removeSitting(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('sid') sid: string) {
    await this.access.check(u, id, 'owner');
    must(await this.prisma.sitting.findFirst({ where: { id: sid, link: { clinicId: id } } }), 'Sitting');
    await this.prisma.sitting.update({ where: { id: sid }, data: { active: false, validTo: todayIST() } });
    this.realtime.emitClinic(id, 'roster:changed', { clinicId: id });
    return { ok: true };
  }

  // ================================================================== queue console (CLN-08..14)

  @Get('clinic/:id/queue')
  async queueToday(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('date') date?: string) {
    await this.access.check(u, id, 'staff');
    const day = date ?? todayIST();
    const items = await this.scheduling.clinicInstancesForDate(id, day);
    const doctors = [];
    for (const it of items) {
      const v = await this.queue.staffView(it.instance.id);
      doctors.push({ ...v, specialties: it.doctor.specialties.map((s) => s.name), linkId: it.link.id });
    }
    return { date: day, serverTime: new Date().toISOString(), doctors };
  }

  @Get('clinic/:id/instances/:iid')
  async instance(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('iid') iid: string) {
    await this.access.check(u, id, 'staff');
    const v = await this.queue.staffView(iid);
    if (v.clinic.id !== id) throw forbidden();
    return v;
  }

  private async assertInstance(id: string, iid: string) {
    const ctx = await this.queue.ctx(iid);
    if (ctx.sitting.link.clinicId !== id) throw forbidden();
    return ctx;
  }

  @HttpCode(200)
  @Post('clinic/:id/instances/:iid/action')
  async instanceAction(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('iid') iid: string, @Body(new Zod(instanceActionSchema)) dto: z.infer<typeof instanceActionSchema>) {
    await this.access.check(u, id, 'staff');
    await this.assertInstance(id, iid);
    await this.queue.instanceAction(iid, dto.action, u.id, dto);
    return this.queue.staffView(iid);
  }

  @HttpCode(200)
  @Post('clinic/:id/bookings/:bid/action')
  async bookingAction(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('bid') bid: string, @Body(new Zod(bookingActionSchema)) dto: z.infer<typeof bookingActionSchema>) {
    await this.access.check(u, id, 'staff');
    const b = must(await this.prisma.booking.findUnique({ where: { id: bid } }), 'Booking');
    await this.assertInstance(id, b.instanceId);
    await this.queue.bookingAction(bid, dto.action, u.id, dto);
    return this.queue.staffView(b.instanceId);
  }

  @Post('clinic/:id/instances/:iid/walk-ins')
  async walkIn(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('iid') iid: string, @Body(new Zod(walkInSchema)) dto: z.infer<typeof walkInSchema>) {
    await this.access.check(u, id, 'staff', 'WALK_IN');
    await this.assertInstance(id, iid);
    const booking = await this.queue.addWalkIn(iid, dto, u.id);
    return { booking, view: await this.queue.staffView(iid) };
  }

  /** CLN-13 offline sync: walk-ins captured without network, idempotent by clientRef. */
  @HttpCode(200)
  @Post('clinic/:id/walk-ins/sync')
  async syncWalkIns(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body(new Zod(z.object({ items: z.array(walkInSchema.extend({ instanceId: z.string(), clientRef: z.string() })).max(200) })))
    dto: { items: { instanceId: string; name: string; phone?: string; clientRef: string }[] },
  ) {
    await this.access.check(u, id, 'staff', 'WALK_IN');
    const results = [];
    for (const it of dto.items) {
      try {
        await this.assertInstance(id, it.instanceId);
        const b = await this.queue.addWalkIn(it.instanceId, it, u.id, 'OFFLINE');
        results.push({ clientRef: it.clientRef, ok: true, tokenNo: b.tokenNo, bookingId: b.id });
      } catch (e: any) {
        results.push({ clientRef: it.clientRef, ok: false, error: e?.response?.message ?? 'Failed' });
      }
    }
    return { results };
  }

  // ================================================================== payments (CLN-19, PAY-03)

  @Get('clinic/:id/payment-settings')
  async paymentSettings(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const { clinic } = await this.access.check(u, id, 'owner');
    const regionId = clinic.area.regionId;
    const resolved = await this.paymentConfig.resolve({ clinicId: id, regionId });
    const rows = await this.paymentConfig.rows({ clinicId: id, regionId });
    const clinicRow = rows.find((r) => r.scope === 'CLINIC');
    const links = await this.prisma.clinicDoctorLink.findMany({
      where: { clinicId: id, status: 'APPROVED' },
      include: { doctor: { include: { user: { select: { name: true } } } }, sittings: { where: { active: true } } },
    });
    const overrides = await this.prisma.paymentConfig.findMany({
      where: { OR: [{ scope: 'DOCTOR', scopeId: { in: links.map((l) => l.id) } }, { scope: 'SITTING', scopeId: { in: links.flatMap((l) => l.sittings.map((s) => s.id)) } }] },
    });
    const locked = rows.find((r) => ['PLATFORM', 'REGION', 'CLINIC'].includes(r.scope) && r.locked);
    return {
      effectiveMode: resolved.mode,
      allowedModes: resolved.allowedModes,
      lockedBy: locked?.scope ?? null,
      clinicSelectedMode: clinicRow?.selectedMode ?? null,
      fees: {
        bookingFeeEnabled: resolved.fees.bookingFeeEnabled,
        bookingFeePaise: resolved.fees.bookingFeePaise,
        commissionEnabled: resolved.fees.commissionEnabled,
        commissionPercent: resolved.fees.commissionPercent,
        commissionFlatPaise: resolved.fees.commissionFlatPaise,
        refundFullMinutes: resolved.refundMinutes,
      },
      doctors: links.map((l) => ({
        linkId: l.id,
        doctorName: l.doctor.user.name,
        consultationFee: l.consultationFee,
        clinicSplitPercent: l.clinicSplitPercent,
        mode: overrides.find((o) => o.scope === 'DOCTOR' && o.scopeId === l.id)?.selectedMode ?? null,
        sittings: l.sittings.map((s) => ({
          sittingId: s.id,
          weekdays: s.weekdays,
          startTime: s.startTime,
          endTime: s.endTime,
          mode: overrides.find((o) => o.scope === 'SITTING' && o.scopeId === s.id)?.selectedMode ?? null,
        })),
      })),
      payout: { upi: clinic.payoutUpi, account: clinic.payoutAccount, ifsc: clinic.payoutIfsc },
    };
  }

  @Put('clinic/:id/payment-settings')
  async savePaymentSettings(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(clinicPaymentSettingsSchema)) dto: z.infer<typeof clinicPaymentSettingsSchema>) {
    const { clinic } = await this.access.check(u, id, 'owner');
    const regionId = clinic.area.regionId;
    const upsert = async (scope: string, scopeId: string, mode: PaymentMode | null) => {
      await this.paymentConfig.assertClinicMayChoose(id, regionId, mode);
      await this.prisma.paymentConfig.upsert({
        where: { scope_scopeId: { scope, scopeId } },
        create: { scope, scopeId, selectedMode: mode, updatedById: u.id },
        update: { selectedMode: mode, updatedById: u.id },
      });
    };
    if (dto.defaultMode !== undefined) await upsert('CLINIC', id, dto.defaultMode ?? null);
    const linkIds = new Set((await this.prisma.clinicDoctorLink.findMany({ where: { clinicId: id }, select: { id: true } })).map((l) => l.id));
    for (const o of dto.doctorOverrides ?? []) {
      if (!linkIds.has(o.linkId)) throw forbidden();
      await upsert('DOCTOR', o.linkId, o.mode);
    }
    for (const o of dto.sittingOverrides ?? []) {
      const s = await this.prisma.sitting.findFirst({ where: { id: o.sittingId, link: { clinicId: id } } });
      if (!s) throw forbidden();
      await upsert('SITTING', o.sittingId, o.mode);
    }
    await this.audit.log(u.id, 'CLINIC_PAYMENT_SETTINGS', 'Clinic', id, undefined, dto);
    return this.paymentSettings(u, id);
  }

  // ================================================================== staff (CLN-16)

  @Get('clinic/:id/staff')
  async staff(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.check(u, id, 'owner');
    const rows = await this.prisma.roleAssignment.findMany({ where: { clinicId: id, role: 'QUEUE_MANAGER' }, include: { user: { select: { id: true, name: true, phone: true, status: true } } } });
    return rows.map((r) => ({ assignmentId: r.id, ...r.user, since: r.createdAt }));
  }

  @Post('clinic/:id/staff')
  async addStaff(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(staffSchema)) dto: z.infer<typeof staffSchema>) {
    await this.access.check(u, id, 'owner', 'QUEUE_MANAGER');
    const count = await this.prisma.roleAssignment.count({ where: { clinicId: id, role: 'QUEUE_MANAGER' } });
    await this.entitlements.requireWithinLimit(id, 'MAX_QUEUE_MANAGERS', count);
    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { phone: dto.phone, name: dto.name, phoneVerifiedAt: new Date(), credential: { create: { passwordHash: await hashSecret(dto.password) } } },
      });
    }
    await this.auth.ensureRole(user.id, 'QUEUE_MANAGER', id);
    await this.notifications.textPhone(dto.phone, `You have been added as Queue Manager on Okidoc. Log in with this phone number${user.createdAt > new Date(Date.now() - 60_000) ? ' and the password given by your clinic' : ''}.`);
    await this.audit.log(u.id, 'STAFF_ADDED', 'Clinic', id, undefined, { userId: user.id });
    return { ok: true, userId: user.id };
  }

  @Delete('clinic/:id/staff/:assignmentId')
  async removeStaff(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('assignmentId') aid: string) {
    await this.access.check(u, id, 'owner');
    await this.prisma.roleAssignment.deleteMany({ where: { id: aid, clinicId: id, role: 'QUEUE_MANAGER' } });
    await this.audit.log(u.id, 'STAFF_REMOVED', 'Clinic', id, undefined, { assignmentId: aid });
    return { ok: true };
  }

  // ================================================================== register, earnings, blocks (CLN-15/17/27)

  @Get('clinic/:id/register')
  async registerBook(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('doctorId') doctorId?: string,
    @Query('q') q?: string,
    @Query('format') format?: string,
  ) {
    await this.access.check(u, id, 'staff', 'RECORDS');
    const toDate = to ?? todayIST();
    const fromDate = from ?? addDays(toDate, -6);
    const rows = await this.prisma.booking.findMany({
      where: {
        status: { not: 'PENDING_PAYMENT' },
        instance: { date: { gte: fromDate, lte: toDate }, sitting: { link: { clinicId: id, ...(doctorId ? { doctorId } : {}) } } },
        ...(q ? { OR: [{ patientName: { contains: q, mode: 'insensitive' } }, { patientPhone: { contains: q } }] } : {}),
      },
      include: { instance: { include: { sitting: { include: { link: { include: { doctor: { include: { user: { select: { name: true } } } } } } } } } } },
      orderBy: [{ instance: { date: 'desc' } }, { tokenNo: 'asc' }],
      take: 2000,
    });
    const items = rows.map((b) => ({
      date: b.instance.date,
      sitting: `${b.instance.startTime}-${b.instance.endTime}`,
      doctor: b.instance.sitting.link.doctor.user.name,
      token: b.tokenNo,
      patient: b.patientName,
      phone: b.patientPhone ?? '',
      source: b.source,
      status: b.status,
      paymentMode: b.paymentMode,
      fee: b.consultationFee,
      paid: b.paidOnline > 0 ? 'ONLINE' : b.paidAtClinic ? `CLINIC_${b.paidVia ?? ''}` : '',
    }));
    if (format === 'csv') {
      res.setHeader('content-type', 'text/csv; charset=utf-8');
      res.setHeader('content-disposition', `attachment; filename="okidoc-register-${fromDate}-to-${toDate}.csv"`);
      const head = Object.keys(items[0] ?? { date: '' });
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      return [head.join(','), ...items.map((i) => head.map((h) => esc((i as any)[h])).join(','))].join('\n');
    }
    return { from: fromDate, to: toDate, items };
  }

  @Get('clinic/:id/earnings')
  async earningsReport(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    await this.access.check(u, id, 'owner', 'EARNINGS');
    return this.earnings.compute({ clinicId: id }, from, to);
  }

  @Get('clinic/:id/blocks')
  async blocks(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.check(u, id, 'owner');
    const rows = await this.prisma.patientBlock.findMany({ where: { clinicId: id, scope: 'CLINIC' }, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    return rows.map((b) => ({ ...b, phone: `XXXXXX${b.phone.slice(-4)}`, patientName: b.user?.name ?? 'Patient' }));
  }

  @HttpCode(200)
  @Post('clinic/:id/blocks/:bid/lift')
  async liftBlock(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('bid') bid: string, @Body(new Zod(liftBlockSchema)) dto: z.infer<typeof liftBlockSchema>) {
    await this.access.check(u, id, 'owner');
    return this.noShows.lift(bid, u.id, dto.reason, id);
  }

  // ================================================================== poster, open slots, bonuses

  /** CLN-24 Today's doctors poster data with clinic QR (deep link). */
  @Get('clinic/:id/poster')
  async poster(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('date') date?: string) {
    const { clinic } = await this.access.check(u, id, 'staff', 'DOCTORS_POSTER');
    const day = date ?? todayIST();
    const items = await this.scheduling.clinicInstancesForDate(id, day);
    const url = `${config.publicBaseUrl.replace(/\/$/, '')}/c/${clinic.code}`;
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#0B2A3A', light: '#FFFFFF' } });
    return {
      clinic: { name: clinic.name, code: clinic.code, address: clinic.addressLine, area: clinic.area.name, phone: clinic.phone },
      date: day,
      doctors: items
        .filter((i) => i.instance.status !== 'CANCELLED')
        .map((i) => ({ name: i.doctor.user.name, specialties: i.doctor.specialties.map((s) => s.name), startTime: i.instance.startTime, endTime: i.instance.endTime })),
      url,
      qrDataUrl: qr,
    };
  }

  @Get('clinic/:id/open-slots')
  async openSlots(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.check(u, id, 'owner', 'OPEN_SLOTS');
    return this.prisma.openSlot.findMany({ where: { clinicId: id, active: true }, orderBy: { createdAt: 'desc' } });
  }

  @Post('clinic/:id/open-slots')
  async addOpenSlot(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(openSlotSchema)) dto: z.infer<typeof openSlotSchema>) {
    await this.access.check(u, id, 'owner', 'OPEN_SLOTS');
    return this.prisma.openSlot.create({ data: { ...dto, specialtyIds: dto.specialtyIds ?? [], clinicId: id } });
  }

  @Delete('clinic/:id/open-slots/:sid')
  async removeOpenSlot(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('sid') sid: string) {
    await this.access.check(u, id, 'owner', 'OPEN_SLOTS');
    await this.prisma.openSlot.updateMany({ where: { id: sid, clinicId: id }, data: { active: false } });
    return { ok: true };
  }

  /** Doctors' posted free hours near this clinic (DOC-12 ↔ CLN-25). */
  @Get('clinic/:id/free-hours')
  async freeHours(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const { clinic } = await this.access.check(u, id, 'owner', 'OPEN_SLOTS');
    const areaIds = (await this.prisma.area.findMany({ where: { regionId: clinic.area.regionId }, select: { id: true } })).map((a) => a.id);
    const rows = await this.prisma.freeHours.findMany({
      where: { active: true, OR: [{ areaId: null }, { areaId: { in: areaIds } }], doctor: { verification: 'APPROVED' } },
      include: { doctor: { include: { user: { select: { name: true } }, specialties: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      weekdays: r.weekdays,
      startTime: r.startTime,
      endTime: r.endTime,
      note: r.note,
      doctor: { id: r.doctor.id, name: r.doctor.user.name, degrees: r.doctor.degrees, specialties: r.doctor.specialties.map((s) => s.name) },
    }));
  }

  @Get('clinic/:id/bonuses')
  async bonuses(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.access.check(u, id, 'owner', 'BONUSES');
    return this.bonus.forClinic(id);
  }
}

@Module({ imports: [AuthModule], controllers: [ClinicController], providers: [WebConsoleGuard] })
export class ClinicModule {}
