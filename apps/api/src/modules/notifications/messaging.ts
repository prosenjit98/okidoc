import { Injectable, Logger } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import { config } from '../../config';

/** SMS / WhatsApp provider abstraction. `console` logs messages (development). */
export interface MessagingProvider {
  sendSms(phone: string, text: string): Promise<void>;
  sendWhatsApp(phone: string, template: string, params: Record<string, string>, fallbackText: string): Promise<void>;
}

class ConsoleMessaging implements MessagingProvider {
  private readonly log = new Logger('SMS');
  async sendSms(phone: string, text: string) {
    this.log.log(`→ +91${phone}: ${text}`);
  }
  async sendWhatsApp(phone: string, template: string, _params: Record<string, string>, fallbackText: string) {
    this.log.log(`→ WhatsApp +91${phone} [${template}]: ${fallbackText}`);
  }
}

/** MSG91 (SMS + WhatsApp). Configure MSG91_AUTH_KEY; template IDs are DLT-registered in production. */
class Msg91Messaging implements MessagingProvider {
  private readonly log = new Logger('MSG91');
  async sendSms(phone: string, text: string) {
    const res = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: process.env.MSG91_AUTH_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({
        template_id: process.env.MSG91_TEMPLATE_GENERIC,
        short_url: '0',
        recipients: [{ mobiles: `91${phone}`, message: text }],
      }),
    });
    if (!res.ok) this.log.warn(`SMS failed ${res.status}`);
  }
  async sendWhatsApp(phone: string, template: string, params: Record<string, string>, fallbackText: string) {
    // WhatsApp templates must be pre-approved; fall back to SMS when not configured.
    if (!process.env.MSG91_WHATSAPP_NUMBER) return this.sendSms(phone, fallbackText);
    const res = await fetch('https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: { authkey: process.env.MSG91_AUTH_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({
        integrated_number: process.env.MSG91_WHATSAPP_NUMBER,
        content_type: 'template',
        payload: {
          to: `91${phone}`,
          type: 'template',
          template: { name: template, language: { code: 'en', policy: 'deterministic' }, components: params },
        },
      }),
    });
    if (!res.ok) this.log.warn(`WhatsApp failed ${res.status}`);
  }
}

@Injectable()
export class MessagingService implements MessagingProvider {
  private readonly impl: MessagingProvider = config.smsProvider === 'msg91' ? new Msg91Messaging() : new ConsoleMessaging();
  sendSms(phone: string, text: string) {
    return this.impl.sendSms(phone, text).catch(() => undefined);
  }
  sendWhatsApp(phone: string, template: string, params: Record<string, string>, fallbackText: string) {
    return this.impl.sendWhatsApp(phone, template, params, fallbackText).catch(() => undefined);
  }
}

/**
 * Push delivery (PRD §8). Tokens are routed by prefix:
 *   - `fcm:<token>`             → Firebase Cloud Messaging HTTP v1 (bare React Native app). Needs FCM_SERVICE_ACCOUNT_JSON.
 *   - `ExponentPushToken[...]`  → Expo push service (kept for compatibility with older Expo builds).
 * Without credentials the message is only logged; in-app notifications are unaffected.
 */
@Injectable()
export class PushService {
  private readonly log = new Logger('Push');
  private fcmToken: { value: string; exp: number } | null = null;
  private serviceAccount: { project_id: string; client_email: string; private_key: string } | null | undefined;

  async send(tokens: string[], title: string, body: string, data: Record<string, unknown>) {
    const fcm = tokens.filter((t) => t.startsWith('fcm:')).map((t) => t.slice(4));
    const expo = tokens.filter((t) => t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'));
    await Promise.all([fcm.length ? this.sendFcm(fcm, title, body, data) : null, expo.length ? this.sendExpo(expo, title, body, data) : null]);
  }

  private async sendExpo(tokens: string[], title: string, body: string, data: Record<string, unknown>) {
    if (config.pushProvider !== 'expo') {
      this.log.log(`expo push x${tokens.length}: ${title}`);
      return;
    }
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(tokens.map((to) => ({ to, title, body, data, sound: 'default', priority: 'high' }))),
      });
    } catch (e) {
      this.log.warn(`Expo push failed: ${String(e)}`);
    }
  }

  /** FCM_SERVICE_ACCOUNT_JSON = the service-account JSON itself, or a path to the .json file. */
  private account() {
    if (this.serviceAccount !== undefined) return this.serviceAccount;
    const raw = config.fcmServiceAccountJson;
    try {
      const text = !raw ? '' : raw.trim().startsWith('{') ? raw : readFileSync(raw, 'utf8');
      const j = text ? JSON.parse(text) : null;
      this.serviceAccount = j?.project_id && j?.client_email && j?.private_key ? j : null;
    } catch (e) {
      this.log.warn(`FCM_SERVICE_ACCOUNT_JSON could not be read: ${String(e)}`);
      this.serviceAccount = null;
    }
    return this.serviceAccount;
  }

  /** OAuth2 access token for FCM via a self-signed service-account JWT (cached ~55 min). */
  private async accessToken(sa: { client_email: string; private_key: string }) {
    if (this.fcmToken && this.fcmToken.exp > Date.now() + 60_000) return this.fcmToken.value;
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign(
      { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
      sa.private_key,
      { algorithm: 'RS256' },
    );
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    });
    const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !json.access_token) throw new Error(`FCM auth failed: ${json.error ?? res.status}`);
    this.fcmToken = { value: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return json.access_token;
  }

  private async sendFcm(tokens: string[], title: string, body: string, data: Record<string, unknown>) {
    const sa = this.account();
    if (!sa) {
      this.log.log(`fcm push x${tokens.length} (no FCM_SERVICE_ACCOUNT_JSON): ${title}`);
      return;
    }
    try {
      const bearer = await this.accessToken(sa);
      // FCM data values must be strings.
      const strData = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
      await Promise.all(
        tokens.map(async (token) => {
          const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
            method: 'POST',
            headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                data: strData,
                android: { priority: 'HIGH', notification: { sound: 'default' } },
                apns: { payload: { aps: { sound: 'default' } } },
              },
            }),
          });
          if (!res.ok) this.log.warn(`FCM send failed (${res.status}) for token …${token.slice(-6)}`);
        }),
      );
    } catch (e) {
      this.log.warn(`FCM push failed: ${String(e)}`);
    }
  }
}
