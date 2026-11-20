import { Body, Controller, HttpCode, Module, Post, Query } from '@nestjs/common';
import {
  backupRecoverSchema,
  emailLoginSchema,
  forgotPasswordSchema,
  loginSchema,
  quickLoginSchema,
  quickLoginSetupSchema,
  refreshSchema,
  resendOtpSchema,
  resetPasswordSchema,
  signupSchema,
  verifyOtpSchema,
} from '@okidoc/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Public } from '../../common/auth';
import { Zod } from '../../common/http';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
  ) {}

  /** AUTH-04: phone + password sign-up → OTP challenge. `?client=web` for console sign-up. */
  @Public()
  @Post('signup')
  signup(@Body(new Zod(signupSchema)) dto: z.infer<typeof signupSchema>, @Query('client') client?: string) {
    return this.auth.signup(dto, client === 'web' ? 'web' : 'mobile');
  }

  /** AUTH-05 sign-up verification, or admin 2FA. */
  @Public()
  @HttpCode(200)
  @Post('verify-otp')
  verify(@Body(new Zod(verifyOtpSchema)) dto: z.infer<typeof verifyOtpSchema>) {
    return this.auth.verifyOtp(dto.challengeToken, dto.code);
  }

  @Public()
  @HttpCode(200)
  @Post('otp/resend')
  resend(@Body(new Zod(resendOtpSchema)) dto: z.infer<typeof resendOtpSchema>) {
    return this.otp.resend(dto.challengeToken);
  }

  /** AUTH-08 mobile full login. */
  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body(new Zod(loginSchema)) dto: z.infer<typeof loginSchema>) {
    return this.auth.login(dto);
  }

  /** AUTH-14 web login (phone or email). */
  @Public()
  @HttpCode(200)
  @Post('web/login')
  webLogin(@Body(new Zod(emailLoginSchema)) dto: z.infer<typeof emailLoginSchema>) {
    return this.auth.webLogin(dto.identifier, dto.password);
  }

  /** AUTH-06 passcode / biometric setup after sign-up or full login. */
  @Public()
  @HttpCode(200)
  @Post('quick-login/setup')
  setup(@Body(new Zod(quickLoginSetupSchema)) dto: z.infer<typeof quickLoginSetupSchema>) {
    return this.auth.setupQuickLogin(dto);
  }

  /** AUTH-07 daily login with passcode or biometric-unlocked device secret. */
  @Public()
  @HttpCode(200)
  @Post('quick-login')
  quick(@Body(new Zod(quickLoginSchema)) dto: z.infer<typeof quickLoginSchema>) {
    return this.auth.quickLogin(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body(new Zod(refreshSchema)) dto: z.infer<typeof refreshSchema>) {
    return this.auth.refresh(dto.refreshToken);
  }

  @HttpCode(200)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser) {
    await this.auth.logout(user.id, user.deviceRowId);
    return { ok: true };
  }

  /** AUTH-09 */
  @Public()
  @HttpCode(200)
  @Post('forgot-password')
  forgot(@Body(new Zod(forgotPasswordSchema)) dto: z.infer<typeof forgotPasswordSchema>) {
    return this.auth.forgotPassword(dto.phone);
  }

  @Public()
  @HttpCode(200)
  @Post('reset-password')
  reset(@Body(new Zod(resetPasswordSchema)) dto: z.infer<typeof resetPasswordSchema>) {
    return this.auth.resetPassword(dto.challengeToken, dto.code, dto.newPassword);
  }

  /** AUTH-10 */
  @Public()
  @HttpCode(200)
  @Post('recover')
  recover(@Body(new Zod(backupRecoverSchema)) dto: z.infer<typeof backupRecoverSchema>) {
    return this.auth.recoverWithBackup(dto.phone, dto.backupCode, dto.newPassword);
  }
}

@Module({ controllers: [AuthController], providers: [AuthService, OtpService], exports: [AuthService] })
export class AuthModule {}
