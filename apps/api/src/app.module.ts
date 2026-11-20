import { Controller, Get, Module, Param, Res } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import type { Response } from 'express';
import { AuthGuard, Public } from './common/auth';
import { AllExceptionsFilter } from './common/http';
import { PrismaModule } from './common/prisma.service';
import { CommonModule } from './common/settings.service';
import { AdminModule } from './modules/admin/admin-ops.controller';
import { AdsModule } from './modules/ads/ads.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { AuthModule } from './modules/auth/auth.controller';
import { BookingsModule } from './modules/bookings/bookings.controller';
import { CatalogModule } from './modules/catalog/catalog.controller';
import { ClinicAccessModule } from './modules/clinic/clinic-access.service';
import { ClinicModule } from './modules/clinic/clinic.controller';
import { DoctorModule } from './modules/doctor/doctor.controller';
import { JobsModule } from './modules/jobs/jobs.service';
import { MeModule } from './modules/me/me.controller';
import { NoShowModule } from './modules/noshow/noshow.service';
import { NotificationsModule } from './modules/notifications/notifications.service';
import { PaymentsModule } from './modules/payments/payments.module';
import { PlatformModule } from './modules/platform/platform.services';
import { QueueModule } from './modules/queue/queue.service';
import { RealtimeModule } from './modules/realtime/realtime.gateway';
import { RecordsModule } from './modules/records/records.module';
import { BonusModule } from './modules/reports/bonus.service';
import { ReportsModule } from './modules/reports/earnings.service';
import { SchedulingModule } from './modules/scheduling/scheduling.service';
import { StorageModule } from './modules/storage/storage.service';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SupportModule } from './modules/support/support.module';

/** Short link printed in the clinic QR poster: /c/OK-XXXXX → app deep link (with web fallback). */
@Public()
@Controller('c')
class ShortLinkController {
  @Get(':code')
  open(@Param('code') code: string, @Res() res: Response) {
    const safe = code.replace(/[^A-Z0-9-]/gi, '').toUpperCase();
    res.type('html').send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Okidoc · ${safe}</title><body style="font-family:sans-serif;text-align:center;padding:40px">
<h2>Open in Okidoc</h2><p>Clinic code <b>${safe}</b></p>
<p><a href="okidoc://clinic/${safe}" style="background:#14B8A6;color:#fff;padding:12px 20px;border-radius:24px;text-decoration:none">Open the app</a></p>
<p style="color:#666">Don't have Okidoc? Install it from the Play Store, then scan again.</p>
<script>location.href="okidoc://clinic/${safe}"</script></body>`);
  }
}

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    RealtimeModule,
    NotificationsModule,
    StorageModule,
    PlatformModule,
    PaymentsModule,
    SchedulingModule,
    NoShowModule,
    QueueModule,
    ReportsModule,
    BonusModule,
    ClinicAccessModule,
    AuthModule,
    MeModule,
    CatalogModule,
    BookingsModule,
    DoctorModule,
    ClinicModule,
    SubscriptionsModule,
    AdsModule,
    RecordsModule,
    SupportModule,
    AssistantModule,
    AdminModule,
    JobsModule,
  ],
  controllers: [ShortLinkController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
