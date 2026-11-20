import { Injectable } from '@nestjs/common';
import {
  ADMIN_ROLES,
  AuthResult,
  AuthTokens,
  LoginInput,
  MeUser,
  QuickLoginInput,
  QuickLoginSetupInput,
  Role,
  SignupInput,
  normalizeIndianPhone,
} from '@okidoc/shared';
import jwt from 'jsonwebtoken';
import { signAccessToken } from '../../common/auth';
import { AppError, bad, conflict, unauthorized } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { RateLimiter, SettingsService } from '../../common/settings.service';
import { config } from '../../config';
import { backupCode, hashSecret, normalizeBackupCode, randomToken, sha256, verifySecret } from './crypto';
import { OtpService } from './otp.service';

interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  platform: 'android' | 'ios' | 'web';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly limiter: RateLimiter,
    private readonly settings: SettingsService,
  ) {}

  // ------------------------------------------------------------------ views

  async me(userId: string): Promise<MeUser> {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { roles: true, doctor: { select: { id: true } } } });
    return {
      id: u.id,
      phone: u.phone,
      name: u.name,
      email: u.email,
      language: u.language,
      roles: [...new Set(u.roles.map((r) => r.role as Role))],
      gender: u.gender,
      birthYear: u.birthYear,
      areaId: u.areaId,
      doctorId: u.doctor?.id ?? null,
      clinicIds: [...new Set(u.roles.filter((r) => r.clinicId).map((r) => r.clinicId!))],
      notifyPrefs: (u.notifyPrefs as Record<string, boolean>) ?? {},
      turnNearThreshold: u.turnNearThreshold ?? undefined,
    };
  }

  // ------------------------------------------------------------------ sign-up

  async signup(dto: SignupInput, client: 'mobile' | 'web' = 'mobile'): Promise<Omit<AuthResult, 'user'> & { user?: MeUser }> {
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing?.phoneVerifiedAt) throw conflict('ACCOUNT_EXISTS', 'An account with this number already exists. Please log in.');
    const passwordHash = await hashSecret(dto.password);
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { name: dto.name, language: dto.language, credential: { upsert: { create: { passwordHash }, update: { passwordHash } } } },
        })
      : await this.prisma.user.create({
          data: { phone: dto.phone, name: dto.name, language: dto.language, credential: { create: { passwordHash } } },
        });
    await this.ensureRole(user.id, dto.role);
    const challenge = await this.otp.issue(dto.phone, 'SIGNUP', user.id, { client });
    return challenge;
  }

  async ensureRole(userId: string, role: Role, clinicId: string | null = null) {
    const has = await this.prisma.roleAssignment.findFirst({ where: { userId, role, clinicId } });
    if (!has) await this.prisma.roleAssignment.create({ data: { userId, role, clinicId } });
    if (role === 'DOCTOR') {
      await this.prisma.doctor.upsert({ where: { userId }, create: { userId }, update: {} });
    }
  }

  /** Verify an OTP challenge: completes sign-up (→ quick-login setup) or admin 2FA (→ web session). */
  async verifyOtp(challengeToken: string, code: string): Promise<AuthResult> {
    const c = await this.prisma.otpChallenge.findUnique({ where: { id: challengeToken } });
    if (!c) throw bad('OTP_INVALID', 'This code is no longer valid.');
    if (c.purpose === 'SIGNUP') {
      await this.otp.consume(challengeToken, code, 'SIGNUP');
      const code10 = backupCode();
      const user = await this.prisma.user.update({
        where: { id: c.userId! },
        data: { phoneVerifiedAt: new Date(), credential: { update: { backupCodeHash: await hashSecret(normalizeBackupCode(code10)) } } },
      });
      const me = await this.me(user.id);
      const client = (c.payload as { client?: string } | null)?.client ?? 'mobile';
      if (client === 'web') {
        return { user: me, tokens: await this.issueSession(user.id, { deviceId: `web-${randomToken(9)}`, platform: 'web', deviceName: 'Browser' }), backupCode: code10 };
      }
      return { user: me, setupToken: this.signSetupToken(user.id), backupCode: code10 };
    }
    if (c.purpose === 'LOGIN_2FA') {
      await this.otp.consume(challengeToken, code, 'LOGIN_2FA');
      const me = await this.me(c.userId!);
      return { user: me, tokens: await this.issueSession(c.userId!, { deviceId: `web-${randomToken(9)}`, platform: 'web', deviceName: 'Browser' }) };
    }
    throw bad('OTP_INVALID', 'Use the reset-password screen for this code.');
  }

  // ------------------------------------------------------------------ login

  private async checkPassword(userWhere: { phone?: string; email?: string }, password: string) {
    const key = `login:${userWhere.phone ?? userWhere.email}`;
    if (!this.limiter.allow(key, 10, 15 * 60_000)) throw new AppError(429, 'LOGIN_RATE_LIMIT', 'Too many attempts. Try again in 15 minutes.');
    const user = await this.prisma.user.findFirst({ where: { ...userWhere, status: { not: 'DELETED' } }, include: { credential: true, roles: true } });
    const ok = user && (await verifySecret(user.credential?.passwordHash, password));
    if (!user || !ok) throw unauthorized('Wrong phone number or password', 'BAD_CREDENTIALS');
    if (user.status === 'BLOCKED') throw new AppError(403, 'ACCOUNT_BLOCKED', 'This account has been suspended. Contact Okidoc support.');
    return user;
  }

  /** Mobile full login (AUTH-08): phone + password, then quick login must be set up again. */
  async login(dto: LoginInput): Promise<AuthResult> {
    const user = await this.checkPassword({ phone: dto.phone }, dto.password);
    if (!user.phoneVerifiedAt) {
      const ch = await this.otp.issue(user.phone, 'SIGNUP', user.id, { client: dto.client });
      return { user: await this.me(user.id), ...ch };
    }
    if (dto.client === 'web') return this.webSessionOr2fa(user.id, user.phone, user.roles.map((r) => r.role as Role));
    if (dto.device) {
      await this.prisma.device.updateMany({
        where: { userId: user.id, deviceId: dto.device.deviceId },
        data: { quickLoginMethod: null, passcodeHash: null, deviceSecretHash: null, refreshTokenHash: null, failedAttempts: 0 },
      });
    }
    return { user: await this.me(user.id), setupToken: this.signSetupToken(user.id) };
  }

  /** Web console / admin portal login (AUTH-14): phone or email + password; admins always get OTP 2FA. */
  async webLogin(identifier: string, password: string): Promise<AuthResult> {
    const phone = normalizeIndianPhone(identifier);
    const user = await this.checkPassword(phone ? { phone } : { email: identifier.toLowerCase() }, password);
    if (!user.phoneVerifiedAt) {
      const ch = await this.otp.issue(user.phone, 'SIGNUP', user.id, { client: 'web' });
      return { user: await this.me(user.id), ...ch };
    }
    return this.webSessionOr2fa(user.id, user.phone, user.roles.map((r) => r.role as Role));
  }

  private async webSessionOr2fa(userId: string, phone: string, roles: Role[]): Promise<AuthResult> {
    const me = await this.me(userId);
    if (roles.some((r) => ADMIN_ROLES.includes(r))) {
      const ch = await this.otp.issue(phone, 'LOGIN_2FA', userId);
      return { user: me, ...ch };
    }
    return { user: me, tokens: await this.issueSession(userId, { deviceId: `web-${randomToken(9)}`, platform: 'web', deviceName: 'Browser' }) };
  }

  // ------------------------------------------------------------------ quick login (AUTH-06/07)

  private signSetupToken(userId: string) {
    return jwt.sign({ sub: userId, typ: 'setup' }, config.jwtSetupSecret, { expiresIn: 15 * 60 });
  }

  private verifySetupToken(token: string): string {
    try {
      const c = jwt.verify(token, config.jwtSetupSecret) as { sub: string; typ: string };
      if (c.typ !== 'setup') throw new Error();
      return c.sub;
    } catch {
      throw unauthorized('Setup session expired. Please log in again.', 'SETUP_EXPIRED');
    }
  }

  async setupQuickLogin(dto: QuickLoginSetupInput): Promise<AuthResult> {
    const userId = this.verifySetupToken(dto.setupToken);
    const deviceSecret = dto.method === 'BIOMETRIC' ? randomToken(32) : undefined;
    const data = {
      name: dto.device.deviceName,
      platform: dto.device.platform,
      quickLoginMethod: dto.method,
      passcodeHash: dto.passcode ? await hashSecret(dto.passcode) : null,
      deviceSecretHash: deviceSecret ? sha256(deviceSecret) : null,
      failedAttempts: 0,
      revokedAt: null,
    };
    await this.prisma.device.upsert({
      where: { userId_deviceId: { userId, deviceId: dto.device.deviceId } },
      create: { userId, deviceId: dto.device.deviceId, ...data },
      update: data,
    });
    const tokens = await this.issueSession(userId, dto.device);
    return { user: await this.me(userId), tokens, deviceSecret };
  }

  async quickLogin(dto: QuickLoginInput): Promise<AuthResult> {
    const device = await this.prisma.device.findUnique({ where: { userId_deviceId: { userId: dto.userId, deviceId: dto.deviceId } }, include: { user: true } });
    if (!device || device.revokedAt || !device.quickLoginMethod) {
      throw unauthorized('Please log in with your phone number and password.', 'FULL_LOGIN_REQUIRED');
    }
    if (device.user.status !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_BLOCKED', 'This account has been suspended. Contact Okidoc support.');
    const rules = await this.settings.rules();
    let ok = false;
    if (dto.method === 'PASSCODE') ok = await verifySecret(device.passcodeHash, dto.passcode!);
    else ok = !!device.deviceSecretHash && sha256(dto.deviceSecret!) === device.deviceSecretHash;
    if (!ok) {
      const attempts = device.failedAttempts + 1;
      if (attempts >= rules.passcodeMaxAttempts) {
        await this.prisma.device.update({
          where: { id: device.id },
          data: { failedAttempts: attempts, quickLoginMethod: null, passcodeHash: null, deviceSecretHash: null, refreshTokenHash: null },
        });
        throw unauthorized('Too many wrong attempts. Log in with your phone number and password.', 'QUICK_LOGIN_LOCKED');
      }
      await this.prisma.device.update({ where: { id: device.id }, data: { failedAttempts: attempts } });
      throw unauthorized(`Wrong passcode. ${rules.passcodeMaxAttempts - attempts} attempts left.`, 'BAD_PASSCODE');
    }
    await this.prisma.device.update({ where: { id: device.id }, data: { failedAttempts: 0 } });
    const tokens = await this.issueSession(device.userId, { deviceId: device.deviceId, platform: device.platform as DeviceInfo['platform'] });
    return { user: await this.me(device.userId), tokens };
  }

  // ------------------------------------------------------------------ sessions

  async issueSession(userId: string, d: DeviceInfo): Promise<AuthTokens> {
    const device = await this.prisma.device.upsert({
      where: { userId_deviceId: { userId, deviceId: d.deviceId } },
      create: { userId, deviceId: d.deviceId, name: d.deviceName, platform: d.platform },
      update: { lastSeenAt: new Date(), revokedAt: null },
    });
    const secret = randomToken(32);
    await this.prisma.device.update({
      where: { id: device.id },
      data: { refreshTokenHash: sha256(secret), refreshExpiresAt: new Date(Date.now() + config.refreshTtlDays * 86400_000) },
    });
    return { accessToken: signAccessToken(userId, device.id), refreshToken: `${device.id}.${secret}`, expiresIn: config.accessTtlSeconds };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const [deviceRowId, secret] = refreshToken.split('.');
    if (!deviceRowId || !secret) throw unauthorized();
    const device = await this.prisma.device.findUnique({ where: { id: deviceRowId }, include: { user: true } });
    if (
      !device ||
      device.revokedAt ||
      !device.refreshTokenHash ||
      device.refreshTokenHash !== sha256(secret) ||
      !device.refreshExpiresAt ||
      device.refreshExpiresAt < new Date() ||
      device.user.status !== 'ACTIVE'
    ) {
      throw unauthorized('Your session has expired', 'SESSION_EXPIRED');
    }
    return this.issueSession(device.userId, { deviceId: device.deviceId, platform: device.platform as DeviceInfo['platform'] });
  }

  async logout(userId: string, deviceRowId: string | null) {
    if (deviceRowId) {
      await this.prisma.device.updateMany({
        where: { id: deviceRowId, userId },
        data: { refreshTokenHash: null, quickLoginMethod: null, passcodeHash: null, deviceSecretHash: null, pushToken: null, revokedAt: new Date() },
      });
    }
  }

  async revokeAllDevices(userId: string) {
    await this.prisma.device.updateMany({
      where: { userId },
      data: { refreshTokenHash: null, quickLoginMethod: null, passcodeHash: null, deviceSecretHash: null, revokedAt: new Date() },
    });
  }

  // ------------------------------------------------------------------ recovery (AUTH-09/10)

  async forgotPassword(phone: string) {
    const user = await this.prisma.user.findFirst({ where: { phone, status: { not: 'DELETED' } } });
    if (!user) {
      // Same response shape to avoid revealing which numbers are registered.
      return { challengeToken: randomToken(24), otpSentTo: `+91 ${phone.slice(0, 2)}XXXXXX${phone.slice(-2)}` };
    }
    return this.otp.issue(phone, 'RESET', user.id);
  }

  async resetPassword(challengeToken: string, code: string, newPassword: string) {
    const c = await this.otp.consume(challengeToken, code, 'RESET');
    await this.prisma.credential.update({ where: { userId: c.userId! }, data: { passwordHash: await hashSecret(newPassword), passwordChangedAt: new Date() } });
    await this.revokeAllDevices(c.userId!);
    return { ok: true };
  }

  async recoverWithBackup(phone: string, code: string, newPassword: string) {
    if (!this.limiter.allow(`backup:${phone}`, 5, 60 * 60_000)) throw new AppError(429, 'RATE_LIMIT', 'Too many attempts. Try again later.');
    const user = await this.prisma.user.findFirst({ where: { phone, status: { not: 'DELETED' } }, include: { credential: true } });
    const ok = user && (await verifySecret(user.credential?.backupCodeHash, normalizeBackupCode(code)));
    if (!user || !ok) throw unauthorized('Backup code is not valid', 'BAD_BACKUP_CODE');
    const next = backupCode();
    await this.prisma.credential.update({
      where: { userId: user.id },
      data: { passwordHash: await hashSecret(newPassword), backupCodeHash: await hashSecret(normalizeBackupCode(next)), passwordChangedAt: new Date() },
    });
    await this.revokeAllDevices(user.id);
    return { ok: true, backupCode: next };
  }

  async regenerateBackupCode(userId: string) {
    const next = backupCode();
    await this.prisma.credential.update({ where: { userId }, data: { backupCodeHash: await hashSecret(normalizeBackupCode(next)) } });
    return { backupCode: next };
  }

  async changePassword(userId: string, current: string, next: string, keepDeviceRowId: string | null) {
    const cred = await this.prisma.credential.findUnique({ where: { userId } });
    if (!(await verifySecret(cred?.passwordHash, current))) throw bad('BAD_PASSWORD', 'Current password is wrong');
    await this.prisma.credential.update({ where: { userId }, data: { passwordHash: await hashSecret(next), passwordChangedAt: new Date() } });
    await this.prisma.device.updateMany({
      where: { userId, id: { not: keepDeviceRowId ?? '' } },
      data: { refreshTokenHash: null, quickLoginMethod: null, passcodeHash: null, deviceSecretHash: null, revokedAt: new Date() },
    });
    return { ok: true };
  }

  async changePasscode(userId: string, deviceId: string, passcode: string) {
    const d = await this.prisma.device.findUnique({ where: { userId_deviceId: { userId, deviceId } } });
    if (!d || d.revokedAt) throw bad('NO_DEVICE', 'This device is not registered');
    await this.prisma.device.update({
      where: { id: d.id },
      data: { passcodeHash: await hashSecret(passcode), quickLoginMethod: d.quickLoginMethod ?? 'PASSCODE', failedAttempts: 0 },
    });
    return { ok: true };
  }

  async setBiometric(userId: string, deviceId: string, enabled: boolean) {
    const d = await this.prisma.device.findUnique({ where: { userId_deviceId: { userId, deviceId } } });
    if (!d || d.revokedAt) throw bad('NO_DEVICE', 'This device is not registered');
    if (!enabled) {
      if (!d.passcodeHash) throw bad('PASSCODE_REQUIRED', 'Set a passcode before turning off biometric login');
      await this.prisma.device.update({ where: { id: d.id }, data: { deviceSecretHash: null, quickLoginMethod: 'PASSCODE' } });
      return { ok: true };
    }
    const deviceSecret = randomToken(32);
    await this.prisma.device.update({ where: { id: d.id }, data: { deviceSecretHash: sha256(deviceSecret), quickLoginMethod: 'BIOMETRIC' } });
    return { ok: true, deviceSecret };
  }
}
