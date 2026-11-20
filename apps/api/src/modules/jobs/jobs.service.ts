import { Injectable, Logger, Module } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { addDays, istDateString, istDateTime } from '@okidoc/shared';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QueueService } from '../queue/queue.service';
import { SubscriptionsModule, SubscriptionsService } from '../subscriptions/subscriptions.module';
import { todayIST } from '../scheduling/scheduling.service';

/**
 * In-process scheduled jobs. With several API nodes, run jobs on one node only (JOBS_ENABLED=true there),
 * or move them to BullMQ + Redis.
 */
@Injectable()
export class JobsService {
  private readonly log = new Logger('Jobs');
  private readonly enabled = process.env.JOBS_ENABLED !== 'false';
  private running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly notifications: NotificationsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  private async once(name: string, fn: () => Promise<void>) {
    if (!this.enabled || this.running.has(name)) return;
    this.running.add(name);
    try {
      await fn();
    } catch (e) {
      this.log.error(`${name} failed: ${e instanceof Error ? e.stack : String(e)}`);
    } finally {
      this.running.delete(name);
    }
  }

  /** PAY-05: release unpaid holds. */
  @Cron(CronExpression.EVERY_MINUTE)
  expireHolds() {
    return this.once('expireHolds', async () => {
      const expired = await this.prisma.booking.findMany({ where: { status: 'PENDING_PAYMENT', holdExpiresAt: { lt: new Date() } }, select: { id: true, instanceId: true } });
      for (const b of expired) {
        await this.prisma.booking.update({
          where: { id: b.id },
          data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'SYSTEM', cancelReason: 'Payment not completed in time' },
        });
        await this.queue.changed(b.instanceId);
      }
    });
  }

  /** PRD §8 reminder ~1 hour before the sitting. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  reminders() {
    return this.once('reminders', async () => {
      const now = Date.now();
      const bookings = await this.prisma.booking.findMany({
        where: { status: 'BOOKED', reminderSentAt: null, patientUserId: { not: null }, instance: { date: { in: [todayIST(), addDays(todayIST(), 1)] }, status: { in: ['SCHEDULED', 'ONLINE'] } } },
        include: { instance: { include: { sitting: { include: { link: { include: { clinic: true, doctor: { include: { user: true } } } } } } } } },
      });
      for (const b of bookings) {
        const start = istDateTime(b.instance.date, b.instance.startTime).getTime();
        const mins = (start - now) / 60_000;
        if (mins > 75 || mins < 0) continue;
        await this.prisma.booking.update({ where: { id: b.id }, data: { reminderSentAt: new Date() } });
        await this.notifications.notify(b.patientUserId!, 'REMINDER', {
          vars: { token: b.tokenNo, doctor: `Dr. ${b.instance.sitting.link.doctor.user.name}`, clinic: b.instance.sitting.link.clinic.name, time: b.instance.startTime },
          data: { bookingId: b.id },
        });
      }
    });
  }

  /** Close sittings 60 minutes after their end time (runs the no-show sweep, BR-07). */
  @Cron(CronExpression.EVERY_10_MINUTES)
  autoEnd() {
    return this.once('autoEnd', async () => {
      const today = todayIST();
      const open = await this.prisma.sittingInstance.findMany({ where: { status: { in: ['SCHEDULED', 'ONLINE', 'PAUSED'] }, date: { lte: today } } });
      for (const i of open) {
        const end = istDateTime(i.date, i.endTime).getTime() + (i.delayMinutes + 60) * 60_000;
        if (end > Date.now()) continue;
        const count = await this.prisma.booking.count({ where: { instanceId: i.id } });
        if (!count) {
          await this.prisma.sittingInstance.update({ where: { id: i.id }, data: { status: 'ENDED', endedAt: new Date() } });
          continue;
        }
        this.log.log(`Auto-ending sitting ${i.id} (${i.date} ${i.startTime}-${i.endTime})`);
        await this.queue.endInstance(i.id, null);
      }
    });
  }

  /** MON-04 billing cycle, 02:00 IST daily. */
  @Cron('0 30 20 * * *')
  billing() {
    return this.once('billing', () => this.subscriptions.runBillingCycle());
  }

  /** Housekeeping: old OTP challenges. */
  @Cron(CronExpression.EVERY_HOUR)
  cleanup() {
    return this.once('cleanup', async () => {
      await this.prisma.otpChallenge.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } } });
      this.log.debug(`cleanup done ${istDateString(new Date())}`);
    });
  }
}

@Module({ imports: [SubscriptionsModule], providers: [JobsService] })
export class JobsModule {}
