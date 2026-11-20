# Okidoc

> **Know your queue. Skip the wait.**: clinic queue and doctor booking for India. The pilot runs in West Bengal.

This repo contains the MVP and Phase 1.5 scope from [docs/PRD.md](docs/PRD.md).

| Part | Path | Stack |
|---|---|---|
| API | `apps/api` | Node.js 22, NestJS 11, Prisma 6, PostgreSQL, Socket.IO |
| Web (admin portal + clinic console) | `apps/web` | Next.js 15 (App Router), React 19, Tailwind 4, TanStack Query |
| Mobile app (patient, doctor, clinic) | `apps/mobile` | Bare React Native (React Native CLI, no Expo), React Navigation |
| Shared rules, types, i18n | `packages/shared` | TypeScript, zod, vitest |

## Quick start (local development, Windows/macOS/Linux)

Prerequisite: Node.js 22 or later. You don't need Docker or a separately installed PostgreSQL or Redis.

```bash
npm install                      # all workspaces
npm run build:shared             # compile packages/shared

# 1. Database: embedded PostgreSQL on port 5433 (keep this terminal open)
npm run db:start

# 2. Schema + demo data (new terminal)
cp apps/api/.env.example apps/api/.env     # dev defaults: mock payments, console SMS, OTP echo
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run db:seed

# 3. API → http://localhost:4000/api/v1
npm run dev:api

# 4. Web → http://localhost:3000   (admin portal /admin, clinic console /console)
npm run dev:web

# 5. Mobile (bare React Native) — needs JDK 17 + Android Studio / Android SDK (Xcode + CocoaPods for iOS)
npm run dev:mobile               # Metro on port 8088
npx react-native run-android --port 8088   # from apps/mobile; iOS: cd ios && pod install && npx react-native run-ios --port 8088
```

Full mobile setup is in [apps/mobile/README.md](apps/mobile/README.md). It covers the Firebase config files, Razorpay and AdMob keys, and the API URL.

Mobile devices need to reach the API:
- **Android emulator:** use `http://10.0.2.2:4000`.
- **Physical phone:** use your PC's LAN IP, for example `http://192.168.1.20:4000`.

How to set the URL is described in [apps/mobile/README.md](apps/mobile/README.md).

### Demo accounts (seeded, development only)

| Role | Login | Password |
|---|---|---|
| Okidoc super-admin (web; the OTP 2FA code is shown on screen in dev) | `admin@okidoc.local` or `9000000001` | `Admin@1234` |
| Clinic owner (Sanjeevani Pharmacy Chamber, Barasat Health Clinic) | `9000000101` | `Clinic@1234` |
| Clinic owner (Ranaghat, Shyambazar, Matri) | `9000000102` | `Clinic@1234` |
| Queue Manager (Sanjeevani) | `9000000111` | `Queue@1234` |
| Doctor (Dr. Ananya Ghosh; also 9000000202–207) | `9000000201` | `Doctor@1234` |
| Unverified doctor (verification queue) | `9000000208` | `Doctor@1234` |
| Patient (Riya Das, with family member) | `9000000301` | `Patient@123` |

With `OTP_DEV_ECHO=true`:
- OTP codes come back in API responses (`devOtp`) and are also printed in the API log.
- The mock payment gateway is on, so online checkout can be simulated from the app or the console.

## Tests and verification

```bash
npm test                                   # shared business-rule unit tests (vitest)
node apps/api/scripts/smoke.mjs            # 120-step end-to-end API test against a running API + seed
npm run typecheck                          # all workspaces
npm run build -w @okidoc/web               # production build of the web app
```

The smoke test drives these flows through the real HTTP API:
- **Auth:** sign-up → OTP → passcode and biometric quick login → refresh-token rotation.
- **Patient:** discovery and search (Bengali and transliterated), booking rules, then the clinic queue (go online, walk-in, call next, Queue Manager limits).
- **No-show blocking:** 3 misses at one clinic → clinic block. Then admin 2FA → lift block.
- **Payments:** entitlement and payment-mode resolution, ONLINE_FULL checkout, refund, admin lock.
- **Monetization:** feature locks, revenue switches, ads.
- **Other:** Assistant red flags, doctor schedule, poster QR, notifications.

## Architecture

```
apps/mobile (RN)  ──┐                 ┌─ PostgreSQL (Prisma)
apps/web (Next.js) ─┼─ HTTPS / WSS ──▶│  apps/api (NestJS)  ── Socket.IO rooms: instance:<id>, clinic:<id>, user:<id>
                    │                 └─ jobs (in-process cron): payment holds, reminders, auto-end + no-show sweep, billing
packages/shared ────┘  pure business rules used by API and clients (payment-mode resolution, no-show blocking,
                       refunds, token numbering, ETA, entitlements, revenue switches, i18n bundles)
```

### Where the PRD rules live

The rules are unit-tested in `packages/shared/src/rules.test.ts`.

| Rule | Code |
|---|---|
| BR-09 payment mode resolution (sitting › doctor › clinic › region › platform, admin locks) | `packages/shared/src/rules.ts` → `resolvePaymentMode`; `apps/api/src/modules/platform/platform.services.ts` |
| BR-07 no-show blocking (3 at one clinic / 7 overall, pay-at-clinic only, lifetime, phone-bound) | `rules.ts` → `evaluateNoShows`, `countsAsNoShow`; `apps/api/src/modules/noshow/noshow.service.ts` |
| BR-12 refunds | `rules.ts` → `computeRefund`; `apps/api/src/modules/payments/payments.service.ts` |
| BR-01 tokens / BR-06 late & recall / BR-08 ETA | `rules.ts`; `apps/api/src/modules/queue/queue.service.ts` |
| ADM-02 entitlements / MON-01 revenue switches | `rules.ts`; `platform.services.ts`; clinic API guards (`FEATURE_LOCKED`) |
| AUTH-04..14 phone+password, OTP, passcode and biometric quick login | `apps/api/src/modules/auth/*` |

### Revenue model (pilot defaults, all admin-configurable)

These are set under Admin → Revenue switches.

| Stream | Pilot default |
|---|---|
| In-app ads | **On** |
| Clinic subscriptions | Off ("Free during pilot") |
| Booking fee | Off |
| Commission | Off (0%) |
| Doctor subscriptions | Off |
| Sponsored listings | Off |

## Configuration for production

Everything external sits behind an adapter that defaults to a safe development stand-in. Real providers are configured in `apps/api/.env`.

| Concern | Dev default | Production |
|---|---|---|
| Payments | `PAYMENT_GATEWAY=mock` | `razorpay` with `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`; webhook at `POST /api/v1/payments/webhook/razorpay` |
| SMS / WhatsApp / OTP | `SMS_PROVIDER=console` (logs) | `msg91` with `MSG91_AUTH_KEY`, DLT template IDs, `MSG91_WHATSAPP_NUMBER` |
| Push | Logged only, until Firebase is configured | Firebase Cloud Messaging: add `google-services.json` / `GoogleService-Info.plist` to the app and `FCM_SERVICE_ACCOUNT_JSON` to the API |
| Files | Local `uploads/` | Swap `StorageService` for S3-compatible storage in an India region |
| AI Assistant | Rule-based keyword matcher | Set `ANTHROPIC_API_KEY` (model `ASSISTANT_MODEL`, default `claude-opus-5-5`; `claude-haiku-5-5` is cheaper for this task) |
| Ads | House (sponsored) campaigns + Google test AdMob app/unit IDs | Real AdMob app ID in the native project, unit IDs in Admin → Ads manager |
| Secrets | Dev fallbacks | `JWT_ACCESS_SECRET`, `JWT_SETUP_SECRET` are **required** when `NODE_ENV=production` |
| Scale-out | Single node | Add the Socket.IO Redis adapter and run jobs on one node (`JOBS_ENABLED=false` elsewhere) or move them to BullMQ |

## Source control

Push only to the internal Azure DevOps server (`*.amat.com`). Do not push this code to GitHub, GitLab or Bitbucket.

## Notes

- `.dev-db/` holds the local database. The current cluster is in `.dev-db/data-utf8`. An older, unused `.dev-db/data` folder (created with the wrong text encoding) can be deleted by hand.
- See [docs/PRD.md](docs/PRD.md) §15 for open product questions: plan prices, which districts go first, retention policy, and others.
