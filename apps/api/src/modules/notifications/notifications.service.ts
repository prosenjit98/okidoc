import { Global, Injectable, Module } from '@nestjs/common';
import type { NotificationType } from '@okidoc/shared';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.gateway';
import { MessagingService, PushService } from './messaging';
import { CRITICAL_TYPES, renderTemplate } from './templates';

export interface NotifyOptions {
  vars?: Record<string, string | number | undefined>;
  data?: Record<string, unknown>;
  /** Override title/body (e.g. admin broadcast). */
  title?: string;
  body?: string;
  /** Force SMS even for non-critical types. */
  sms?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
    private readonly messaging: MessagingService,
  ) {}

  /** In-app + push (+ SMS/WhatsApp for critical types). Never throws. */
  async notify(userId: string, type: NotificationType, opts: NotifyOptions = {}) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true, language: true, status: true, notifyPrefs: true, devices: { where: { revokedAt: null }, select: { pushToken: true } } },
      });
      if (!user || user.status === 'DELETED') return;
      const rendered =
        opts.title && opts.body ? { title: opts.title, body: opts.body } : renderTemplate(type, user.language, opts.vars ?? {}, opts.title ? { title: opts.title, body: opts.body ?? '' } : undefined);
      const n = await this.prisma.notification.create({
        data: { userId, type, title: rendered.title, body: rendered.body, data: (opts.data ?? {}) as object },
      });
      this.realtime.emitUser(userId, 'notification', n);
      const critical = CRITICAL_TYPES.includes(type);
      const prefs = (user.notifyPrefs as Record<string, boolean> | null) ?? {};
      if (critical || prefs[type] !== false) {
        const tokens = user.devices.map((d) => d.pushToken).filter((t): t is string => !!t);
        await this.push.send(tokens, rendered.title, rendered.body, { type, notificationId: n.id, ...(opts.data ?? {}) });
      }
      if ((critical || opts.sms) && /^\d{10}$/.test(user.phone)) {
        await this.messaging.sendWhatsApp(user.phone, type.toLowerCase(), {}, `${rendered.title}: ${rendered.body}`);
      }
      return n;
    } catch {
      return undefined;
    }
  }

  async notifyMany(userIds: string[], type: NotificationType, opts: NotifyOptions = {}) {
    for (const id of [...new Set(userIds)]) await this.notify(id, type, opts);
  }

  /** Text a phone that may not have an account (walk-ins, invites). */
  async textPhone(phone: string, text: string) {
    await this.messaging.sendSms(phone, text);
  }
}

@Global()
@Module({
  providers: [NotificationsService, PushService, MessagingService],
  exports: [NotificationsService, MessagingService],
})
export class NotificationsModule {}
