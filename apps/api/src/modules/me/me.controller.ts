import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Query } from '@nestjs/common';
import {
  addRoleSchema,
  biometricToggleSchema,
  changePasscodeSchema,
  changePasswordSchema,
  familyMemberSchema,
  pushTokenSchema,
  updateMeSchema,
} from '@okidoc/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/auth';
import { bad, must, Zod } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/settings.service';
import { AuthModule } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { NoShowService } from '../noshow/noshow.service';

@Controller('me')
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly noShows: NoShowService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  me(@CurrentUser() u: AuthUser) {
    return this.auth.me(u.id);
  }

  @Patch()
  async update(@CurrentUser() u: AuthUser, @Body(new Zod(updateMeSchema)) dto: z.infer<typeof updateMeSchema>) {
    await this.prisma.user.update({
      where: { id: u.id },
      data: { ...dto, email: dto.email === undefined ? undefined : dto.email?.toLowerCase() ?? null, notifyPrefs: dto.notifyPrefs ?? undefined },
    });
    return this.auth.me(u.id);
  }

  /** AUTH-13: add another role to the same phone number. */
  @Post('roles')
  async addRole(@CurrentUser() u: AuthUser, @Body(new Zod(addRoleSchema)) dto: z.infer<typeof addRoleSchema>) {
    await this.auth.ensureRole(u.id, dto.role);
    return this.auth.me(u.id);
  }

  // ---------------- security (AUTH-11)

  @HttpCode(200)
  @Post('password')
  password(@CurrentUser() u: AuthUser, @Body(new Zod(changePasswordSchema)) dto: z.infer<typeof changePasswordSchema>) {
    return this.auth.changePassword(u.id, dto.currentPassword, dto.newPassword, u.deviceRowId);
  }

  @HttpCode(200)
  @Post('passcode')
  passcode(@CurrentUser() u: AuthUser, @Body(new Zod(changePasscodeSchema)) dto: z.infer<typeof changePasscodeSchema>) {
    return this.auth.changePasscode(u.id, dto.deviceId, dto.newPasscode);
  }

  @HttpCode(200)
  @Post('biometric')
  biometric(@CurrentUser() u: AuthUser, @Body(new Zod(biometricToggleSchema)) dto: z.infer<typeof biometricToggleSchema>) {
    return this.auth.setBiometric(u.id, dto.deviceId, dto.enabled);
  }

  @HttpCode(200)
  @Post('backup-code')
  backup(@CurrentUser() u: AuthUser) {
    return this.auth.regenerateBackupCode(u.id);
  }

  @Get('devices')
  async devices(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.device.findMany({ where: { userId: u.id, revokedAt: null }, orderBy: { lastSeenAt: 'desc' } });
    return rows.map((d) => ({
      id: d.id,
      deviceId: d.deviceId,
      name: d.name,
      platform: d.platform,
      quickLoginMethod: d.quickLoginMethod,
      hasPasscode: !!d.passcodeHash,
      lastSeenAt: d.lastSeenAt,
      current: d.id === u.deviceRowId,
    }));
  }

  @Delete('devices/:id')
  async revokeDevice(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.prisma.device.updateMany({
      where: { id, userId: u.id },
      data: { revokedAt: new Date(), refreshTokenHash: null, quickLoginMethod: null, passcodeHash: null, deviceSecretHash: null, pushToken: null },
    });
    return { ok: true };
  }

  @HttpCode(200)
  @Post('push-token')
  async pushToken(@CurrentUser() u: AuthUser, @Body(new Zod(pushTokenSchema)) dto: z.infer<typeof pushTokenSchema>) {
    await this.prisma.device.updateMany({ where: { userId: u.id, deviceId: dto.deviceId }, data: { pushToken: dto.pushToken } });
    return { ok: true };
  }

  // ---------------- family (BR-15)

  @Get('family')
  family(@CurrentUser() u: AuthUser) {
    return this.prisma.familyMember.findMany({ where: { ownerId: u.id, deletedAt: null }, orderBy: { createdAt: 'asc' } });
  }

  @Post('family')
  async addFamily(@CurrentUser() u: AuthUser, @Body(new Zod(familyMemberSchema)) dto: z.infer<typeof familyMemberSchema>) {
    const count = await this.prisma.familyMember.count({ where: { ownerId: u.id, deletedAt: null } });
    if (count >= 10) throw bad('FAMILY_LIMIT', 'You can save up to 10 family members');
    return this.prisma.familyMember.create({ data: { ...dto, ownerId: u.id } });
  }

  @Patch('family/:id')
  async editFamily(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(familyMemberSchema.partial())) dto: Partial<z.infer<typeof familyMemberSchema>>) {
    must(await this.prisma.familyMember.findFirst({ where: { id, ownerId: u.id, deletedAt: null } }), 'Family member');
    return this.prisma.familyMember.update({ where: { id }, data: dto });
  }

  @Delete('family/:id')
  async removeFamily(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.prisma.familyMember.updateMany({ where: { id, ownerId: u.id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  // ---------------- no-show standing (PAT-19)

  @Get('standing')
  standing(@CurrentUser() u: AuthUser) {
    return this.noShows.standing(u.id);
  }

  // ---------------- data export & deletion (DPDP, CLN-22, PAT-18)

  @Get('export')
  async export(@CurrentUser() u: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: u.id },
      include: {
        family: true,
        bookings: { include: { instance: true } },
        records: { where: { deletedAt: null }, select: { id: true, title: true, type: true, recordDate: true, createdAt: true } },
        reviews: true,
        notifications: { take: 200, orderBy: { createdAt: 'desc' } },
      },
    });
    const { ...data } = user;
    return { exportedAt: new Date().toISOString(), data };
  }

  /**
   * Account deletion. Personal data is anonymised; the phone number is released for a new sign-up,
   * but no-show blocks stay attached to the phone number (BR-07b) and are applied to a new account.
   */
  @Delete()
  async remove(@CurrentUser() u: AuthUser) {
    const ownsClinic = await this.prisma.clinic.count({ where: { ownerId: u.id, active: true } });
    if (ownsClinic) throw bad('OWNS_CLINIC', 'Transfer or close your clinic before deleting your account. Contact Okidoc support.');
    await this.auth.revokeAllDevices(u.id);
    await this.prisma.user.update({
      where: { id: u.id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        phone: `deleted:${u.id}`,
        email: null,
        name: 'Deleted user',
        gender: null,
        birthYear: null,
        notifyPrefs: undefined,
      },
    });
    await this.prisma.record.updateMany({ where: { ownerId: u.id }, data: { deletedAt: new Date() } });
    await this.prisma.familyMember.updateMany({ where: { ownerId: u.id }, data: { deletedAt: new Date() } });
    await this.audit.log(u.id, 'ACCOUNT_DELETED', 'User', u.id);
    return { ok: true };
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() u: AuthUser, @Query('before') before?: string) {
    const items = await this.prisma.notification.findMany({
      where: { userId: u.id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unread = await this.prisma.notification.count({ where: { userId: u.id, readAt: null } });
    return { items, unread };
  }

  @HttpCode(200)
  @Post(':id/read')
  async read(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId: u.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  @HttpCode(200)
  @Post('read-all')
  async readAll(@CurrentUser() u: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }
}

@Module({ imports: [AuthModule], controllers: [MeController, NotificationsController] })
export class MeModule {}
