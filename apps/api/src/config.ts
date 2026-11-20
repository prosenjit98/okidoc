import 'dotenv/config';

function num(v: string | undefined, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : d;
}

const isProd = process.env.NODE_ENV === 'production';

function secret(name: string, devDefault: string) {
  const v = process.env[name];
  if (!v || v.startsWith('change-me')) {
    if (isProd) throw new Error(`${name} must be set in production`);
    return devDefault;
  }
  return v;
}

export const config = {
  isProd,
  port: num(process.env.PORT, 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:8081')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000',
  jwtAccessSecret: secret('JWT_ACCESS_SECRET', 'dev-access-secret-okidoc'),
  jwtSetupSecret: secret('JWT_SETUP_SECRET', 'dev-setup-secret-okidoc'),
  accessTtlSeconds: num(process.env.ACCESS_TOKEN_TTL_SECONDS, 900),
  refreshTtlDays: num(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
  otpDevEcho: !isProd && process.env.OTP_DEV_ECHO === 'true',
  smsProvider: process.env.SMS_PROVIDER ?? 'console',
  pushProvider: process.env.PUSH_PROVIDER ?? 'expo',
  /** Firebase service account (JSON string or path to the .json file) for FCM HTTP v1 push. */
  fcmServiceAccountJson: process.env.FCM_SERVICE_ACCOUNT_JSON ?? '',
  paymentGateway: (process.env.PAYMENT_GATEWAY ?? 'mock') as 'mock' | 'razorpay',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
  },
  storageDir: process.env.STORAGE_DIR ?? './uploads',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  assistantModel: process.env.ASSISTANT_MODEL ?? 'claude-opus-5-5',
};
