import { Global, Injectable, Module } from '@nestjs/common';
import { FeatureKey } from '@okidoc/shared';
import { AuthUser, isAdmin } from '../../common/auth';
import { forbidden, must } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { EntitlementsService } from '../platform/platform.services';

export type ClinicAccessLevel = 'owner' | 'staff';

/** Clinic-scoped authorisation: owners do everything; Queue Managers only queue/walk-in work (CLN-16). */
@Injectable()
export class ClinicAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async check(user: AuthUser, clinicId: string, level: ClinicAccessLevel, feature?: FeatureKey) {
    const clinic = must(await this.prisma.clinic.findUnique({ where: { id: clinicId }, include: { area: true } }), 'Clinic');
    const admin = isAdmin(user);
    const isOwner = clinic.ownerId === user.id || user.assignments.some((a) => a.role === 'CLINIC_OWNER' && a.clinicId === clinicId);
    const isStaff = isOwner || user.assignments.some((a) => a.role === 'QUEUE_MANAGER' && a.clinicId === clinicId);
    if (!admin) {
      if (level === 'owner' && !isOwner) throw forbidden('Only the clinic owner can do this');
      if (level === 'staff' && !isStaff) throw forbidden('You are not staff at this clinic');
      if (!clinic.active) throw forbidden('This clinic is inactive. Contact Okidoc.', 'CLINIC_INACTIVE');
    }
    if (feature && !admin) await this.entitlements.require(clinicId, feature);
    return { clinic, isOwner: isOwner || admin, isAdmin: admin };
  }
}

@Global()
@Module({ providers: [ClinicAccessService], exports: [ClinicAccessService] })
export class ClinicAccessModule {}
