import { Controller, Get, Injectable, Module, Param, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Public } from '../../common/auth';
import { must } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { SchedulingService, todayIST } from '../scheduling/scheduling.service';

const doctorCardInclude = {
  user: { select: { name: true } },
  specialties: { select: { id: true, slug: true, name: true, patientName: true, nameBn: true, nameHi: true } },
  links: { where: { status: 'APPROVED' as const, clinic: { verification: 'APPROVED' as const, active: true } }, select: { clinicId: true } },
} satisfies Prisma.DoctorInclude;

type DoctorRow = Prisma.DoctorGetPayload<{ include: typeof doctorCardInclude }>;

export const doctorCard = (d: DoctorRow) => ({
  id: d.id,
  name: d.user.name,
  photoUrl: d.photoUrl,
  degrees: d.degrees,
  experienceYears: d.experienceYears,
  specialties: d.specialties,
  ratingAvg: d.ratingAvg,
  ratingCount: d.ratingCount,
  verified: d.verification === 'APPROVED',
  chambers: d.links.length,
});

const clinicCardSelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  photos: true,
  addressLine: true,
  lat: true,
  lng: true,
  ratingAvg: true,
  ratingCount: true,
  area: { select: { id: true, name: true, nameBn: true, region: { select: { district: true } } } },
} satisfies Prisma.ClinicSelect;

/** Public review row: the reviewer is shown by first name only. */
const publicReview = (r: { comment: string | null; createdAt: Date; user: { name: string } }, stars: number | null) => ({
  rating: stars,
  comment: r.comment,
  createdAt: r.createdAt,
  by: r.user.name.split(' ')[0],
});

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
  ) {}

  private visibleClinic = { verification: 'APPROVED' as const, active: true };
  private visibleDoctor = { verification: 'APPROVED' as const };

  private async areaScope(areaId?: string) {
    if (!areaId) return {};
    const area = await this.prisma.area.findUnique({ where: { id: areaId } });
    return area ? { area: { regionId: area.regionId } } : {};
  }

  async summary(areaId?: string) {
    const scope = await this.areaScope(areaId);
    const [clinics, doctors] = await Promise.all([
      this.prisma.clinic.count({ where: { ...this.visibleClinic, ...scope } }),
      this.prisma.doctor.count({
        where: { ...this.visibleDoctor, links: { some: { status: 'APPROVED', clinic: { ...this.visibleClinic, ...scope } } } },
      }),
    ]);
    return { clinics, doctors };
  }

  /** PAT-05 home rails. */
  async home(areaId?: string, specialty?: string) {
    const scope = await this.areaScope(areaId);
    const today = todayIST();
    const specFilter = specialty ? { doctor: { specialties: { some: { slug: specialty } } } } : {};
    const instances = await this.prisma.sittingInstance.findMany({
      where: {
        date: today,
        status: { in: ['SCHEDULED', 'ONLINE', 'PAUSED'] },
        sitting: { link: { status: 'APPROVED', clinic: { ...this.visibleClinic, ...scope }, ...specFilter } },
      },
      include: {
        sitting: { include: { link: { include: { clinic: { select: clinicCardSelect }, doctor: { include: doctorCardInclude } } } } },
        _count: { select: { bookings: { where: { status: { in: ['BOOKED', 'PRESENT', 'LATE', 'SKIPPED'] } } } } },
      },
      orderBy: { startTime: 'asc' },
    });
    // Make sure today's sittings exist as instances so the rails are accurate.
    if (!instances.length) {
      const clinics = await this.prisma.clinic.findMany({ where: { ...this.visibleClinic, ...scope }, select: { id: true }, take: 50 });
      for (const c of clinics) await this.scheduling.clinicInstancesForDate(c.id, today);
    }
    const rows = instances.length
      ? instances
      : await this.prisma.sittingInstance.findMany({
          where: {
            date: today,
            status: { in: ['SCHEDULED', 'ONLINE', 'PAUSED'] },
            sitting: { link: { status: 'APPROVED', clinic: { ...this.visibleClinic, ...scope }, ...specFilter } },
          },
          include: {
            sitting: { include: { link: { include: { clinic: { select: clinicCardSelect }, doctor: { include: doctorCardInclude } } } } },
            _count: { select: { bookings: { where: { status: { in: ['BOOKED', 'PRESENT', 'LATE', 'SKIPPED'] } } } } },
          },
          orderBy: { startTime: 'asc' },
        });
    const card = (i: (typeof rows)[number]) => ({
      instanceId: i.id,
      sittingId: i.sittingId,
      date: i.date,
      startTime: i.startTime,
      endTime: i.endTime,
      status: i.status,
      presence: i.presence,
      nowServing: i.nowServingToken,
      waiting: i._count.bookings,
      doctor: doctorCard(i.sitting.link.doctor),
      clinic: i.sitting.link.clinic,
    });
    const liveNow = rows.filter((r) => r.status === 'ONLINE' || r.status === 'PAUSED').map(card);
    const availableLater = rows.filter((r) => r.status === 'SCHEDULED').map(card);
    const clinicsNear = await this.clinics({ areaId, limit: 10 });
    return { liveNow, availableLater, clinicsNear };
  }

  async clinics(f: { areaId?: string; type?: string; limit?: number }) {
    const scope = await this.areaScope(f.areaId);
    const clinics = await this.prisma.clinic.findMany({
      where: { ...this.visibleClinic, ...scope, ...(f.type ? { type: f.type } : {}) },
      select: clinicCardSelect,
      take: f.limit ?? 50,
      orderBy: { name: 'asc' },
    });
    const today = todayIST();
    const counts = await this.prisma.sittingInstance.groupBy({
      by: ['sittingId'],
      where: { date: today, status: { not: 'CANCELLED' }, sitting: { link: { clinicId: { in: clinics.map((c) => c.id) } } } },
    });
    const sittingClinics = counts.length
      ? await this.prisma.sitting.findMany({ where: { id: { in: counts.map((c) => c.sittingId) } }, select: { link: { select: { clinicId: true } } } })
      : [];
    return clinics
      .map((c) => ({ ...c, doctorsToday: sittingClinics.filter((s) => s.link.clinicId === c.id).length }))
      // Clinics in the chosen area first, then by doctors sitting today.
      .sort((a, b) => Number(b.area.id === f.areaId) - Number(a.area.id === f.areaId) || b.doctorsToday - a.doctorsToday);
  }

  async clinicDetail(where: { id?: string; code?: string }) {
    const c = must(
      await this.prisma.clinic.findFirst({
        where: { ...where, ...this.visibleClinic },
        select: {
          ...clinicCardSelect,
          about: true,
          phone: true,
          openingHours: true,
          pin: true,
          links: { where: { status: 'APPROVED', doctor: this.visibleDoctor }, include: { doctor: { include: doctorCardInclude } } },
          reviews: {
            where: { hidden: false, clinicRating: { not: null } },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { clinicRating: true, comment: true, createdAt: true, user: { select: { name: true } } },
          },
        },
      }),
      'Clinic',
    );
    const slots = await this.scheduling.slots({ clinicId: c.id }, 7);
    const { links, reviews, ...clinic } = c;
    return {
      ...clinic,
      doctors: links.map((l) => ({ ...doctorCard(l.doctor), consultationFee: l.consultationFee })),
      reviews: reviews.map((r) => publicReview(r, r.clinicRating)),
      slots,
    };
  }

  async doctorDetail(id: string) {
    const d = must(
      await this.prisma.doctor.findFirst({
        where: { id, ...this.visibleDoctor },
        include: {
          ...doctorCardInclude,
          reviews: { where: { hidden: false, rating: { not: null } }, orderBy: { createdAt: 'desc' }, take: 10, select: { rating: true, comment: true, createdAt: true, user: { select: { name: true } } } },
        },
      }),
      'Doctor',
    );
    return {
      ...doctorCard(d),
      about: d.about,
      council: d.council,
      registrationNo: d.registrationNo,
      languagesSpoken: d.languagesSpoken,
      reviews: d.reviews.map((r) => publicReview(r, r.rating)),
    };
  }

  /** PAT-02 universal search: doctor, specialty, problem/symptom, clinic, area or PIN. */
  async search(q: string, areaId?: string) {
    const term = q.trim();
    if (term.length < 2) return { doctors: [], clinics: [], specialties: [], areas: [] };
    const scope = await this.areaScope(areaId);
    const lower = term.toLowerCase();
    const words = lower.split(/\s+/).filter((w) => w.length > 1);
    const ci = { contains: term, mode: 'insensitive' as const };
    const specialties = await this.prisma.specialty.findMany({
      where: {
        active: true,
        OR: [{ name: ci }, { patientName: ci }, { nameBn: ci }, { nameHi: ci }, { slug: ci }, { keywords: { hasSome: [lower, ...words] } }],
      },
      take: 6,
    });
    const isPin = /^\d{6}$/.test(term);
    const [doctors, clinics, areas] = await Promise.all([
      this.prisma.doctor.findMany({
        where: {
          ...this.visibleDoctor,
          links: { some: { status: 'APPROVED', clinic: { ...this.visibleClinic, ...scope } } },
          OR: [{ user: { name: ci } }, { degrees: ci }, ...(specialties.length ? [{ specialties: { some: { id: { in: specialties.map((s) => s.id) } } } }] : [])],
        },
        include: doctorCardInclude,
        take: 20,
      }),
      this.prisma.clinic.findMany({
        where: {
          ...this.visibleClinic,
          OR: [{ name: ci }, { addressLine: ci }, { area: { name: ci } }, ...(isPin ? [{ pin: term }] : []), { code: { equals: term.toUpperCase() } }],
        },
        select: clinicCardSelect,
        take: 20,
      }),
      this.prisma.area.findMany({
        where: { active: true, OR: [{ name: ci }, { nameBn: ci }, ...(isPin ? [{ pin: term }] : [])] },
        include: { region: true },
        take: 8,
      }),
    ]);
    return { doctors: doctors.map(doctorCard), clinics, specialties, areas };
  }
}

@Public()
@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
  ) {}

  @Get('areas')
  areas(@Query('q') q?: string, @Query('regionId') regionId?: string) {
    const ci = q ? { contains: q, mode: 'insensitive' as const } : undefined;
    return this.prisma.area.findMany({
      where: { active: true, ...(regionId ? { regionId } : {}), ...(ci ? { OR: [{ name: ci }, { nameBn: ci }, { pin: { startsWith: q } }, { region: { district: ci } }] } : {}) },
      include: { region: true },
      orderBy: [{ region: { district: 'asc' } }, { name: 'asc' }],
      take: 200,
    });
  }

  @Get('regions')
  regions() {
    return this.prisma.region.findMany({ orderBy: [{ state: 'asc' }, { district: 'asc' }] });
  }

  @Get('specialties')
  specialties() {
    return this.prisma.specialty.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  @Get('discover/summary')
  summary(@Query('areaId') areaId?: string) {
    return this.catalog.summary(areaId);
  }

  @Get('discover/home')
  home(@Query('areaId') areaId?: string, @Query('specialty') specialty?: string) {
    return this.catalog.home(areaId, specialty);
  }

  @Get('search')
  search(@Query('q') q = '', @Query('areaId') areaId?: string) {
    return this.catalog.search(q, areaId);
  }

  @Get('clinics')
  clinics(@Query('areaId') areaId?: string, @Query('type') type?: string) {
    return this.catalog.clinics({ areaId, type });
  }

  @Get('clinics/by-code/:code')
  byCode(@Param('code') code: string) {
    return this.catalog.clinicDetail({ code: code.toUpperCase() });
  }

  @Get('clinics/:id')
  clinic(@Param('id') id: string) {
    return this.catalog.clinicDetail({ id });
  }

  @Get('doctors/:id')
  doctor(@Param('id') id: string) {
    return this.catalog.doctorDetail(id);
  }

  @Get('doctors/:id/slots')
  slots(@Param('id') id: string, @Query('days') days?: string) {
    return this.scheduling.slots({ doctorId: id }, Math.min(15, Math.max(1, Number(days) || 7)));
  }

  @Get('health')
  health() {
    return { ok: true, time: new Date().toISOString() };
  }
}

@Module({ controllers: [CatalogController], providers: [CatalogService], exports: [CatalogService] })
export class CatalogModule {}
