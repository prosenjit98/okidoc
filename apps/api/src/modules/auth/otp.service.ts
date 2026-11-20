import { Injectable } from '@nestjs/common';
import { AppError, bad } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { RateLimiter } from '../../common/settings.service';
import { config } from '../../config';
import { MessagingService } from '../notifications/messaging';
import { hashSecret, maskPhone, otpCode, randomToken, verifySecret } from './crypto';

export type OtpPurpose = 'SIGNUP' | 'RESET' | 'LOGIN_2FA';
const TTL_MS = 5 * 60_000;
const RESEND_AFTER_MS = 30_000;
const MAX_RESENDS = 3;
const MAX_ATTEMPTS = 5;

/** One-time passcodes (AUTH-05). Codes are hashed at rest; the challenge token is an unguessable random id. */
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly limiter: RateLimiter,
  ) {}

  async issue(phone: string, purpose: OtpPurpose, userId: string | null, payload?: object) {
    if (!this.limiter.allow(`otp:${phone}`, 6, 60 * 60_000)) {
      throw new AppError(429, 'OTP_RATE_LIMIT', 'Too many codes requested. Please try again in an hour.');
    }
    const code = otpCode();
    const id = randomToken(24);
    await this.prisma.otpChallenge.create({
      data: { id, phone, purpose, userId, codeHash: await hashSecret(code), expiresAt: new Date(Date.now() + TTL_MS), payload: payload ?? undefined },
    });
    await this.messaging.sendSms(phone, `${code} is your Okidoc verification code. It expires in 5 minutes. Do not share it with anyone.`);
    return { challengeToken: id, otpSentTo: maskPhone(phone), devOtp: config.otpDevEcho ? code : undefined };
  }

  async resend(challengeToken: string) {
    const c = await this.prisma.otpChallenge.findUnique({ where: { id: challengeToken } });
    if (!c || c.consumedAt || c.expiresAt < new Date(Date.now() - 30 * 60_000)) throw bad('OTP_INVALID', 'This code request has expired. Start again.');
    if (c.resendCount >= MAX_RESENDS) throw new AppError(429, 'OTP_RESEND_LIMIT', 'You can resend the code only 3 times.');
    const wait = c.lastSentAt.getTime() + RESEND_AFTER_MS - Date.now();
    if (wait > 0) throw new AppError(429, 'OTP_WAIT', `Please wait ${Math.ceil(wait / 1000)} seconds before resending.`);
    const code = otpCode();
    await this.prisma.otpChallenge.update({
      where: { id: c.id },
      data: { codeHash: await hashSecret(code), expiresAt: new Date(Date.now() + TTL_MS), resendCount: { increment: 1 }, lastSentAt: new Date(), attempts: 0 },
    });
    await this.messaging.sendSms(c.phone, `${code} is your Okidoc verification code. It expires in 5 minutes.`);
    return { challengeToken: c.id, otpSentTo: maskPhone(c.phone), devOtp: config.otpDevEcho ? code : undefined };
  }

  /** Verify and consume. Returns the challenge row. */
  async consume(challengeToken: string, code: string, purpose: OtpPurpose) {
    const c = await this.prisma.otpChallenge.findUnique({ where: { id: challengeToken } });
    if (!c || c.purpose !== purpose || c.consumedAt) throw bad('OTP_INVALID', 'This code is no longer valid. Request a new one.');
    if (c.expiresAt < new Date()) throw bad('OTP_EXPIRED', 'The code has expired. Request a new one.');
    if (c.attempts >= MAX_ATTEMPTS) throw new AppError(429, 'OTP_LOCKED', 'Too many wrong attempts. Request a new code.');
    const ok = await verifySecret(c.codeHash, code);
    if (!ok) {
      await this.prisma.otpChallenge.update({ where: { id: c.id }, data: { attempts: { increment: 1 } } });
      throw bad('OTP_WRONG', `Wrong code. ${MAX_ATTEMPTS - c.attempts - 1} attempts left.`);
    }
    return this.prisma.otpChallenge.update({ where: { id: c.id }, data: { consumedAt: new Date() } });
  }
}
