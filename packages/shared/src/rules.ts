/**
 * Pure business rules from the PRD (§7). No I/O — used by the API and mirrored in clients.
 * Money is always integer paise.
 */
import {
  ALL_PAYMENT_MODES,
  CONFIG_SCOPES,
  ConfigScope,
  FEATURE_KEYS,
  FeatureKey,
  LIMIT_KEYS,
  LimitKey,
  PaymentMode,
  REVENUE_STREAM_DEFAULTS,
  RevenueStream,
  CancelActor,
  DEFAULT_RULES,
} from './constants';

// ---------------------------------------------------------------------------
// BR-09 Payment mode resolution
// ---------------------------------------------------------------------------

export interface PaymentConfigLayer {
  scope: ConfigScope;
  /** Only meaningful on admin scopes (PLATFORM / REGION / CLINIC-by-admin). Narrows the allowed list. */
  allowedModes?: PaymentMode[] | null;
  /** Selected mode at this layer (admin default, clinic choice, doctor or sitting override). */
  selectedMode?: PaymentMode | null;
  /** Admin lock: narrower layers cannot change the selection. */
  locked?: boolean;
}

export interface ResolvedPaymentMode {
  mode: PaymentMode;
  allowedModes: PaymentMode[];
  decidedBy: ConfigScope;
  lockedBy: ConfigScope | null;
}

/**
 * Resolve the effective payment mode for a booking.
 * - allowed modes = intersection of every layer's allowedModes (and the clinic's entitlements)
 * - most specific selection wins, unless a broader layer is locked
 * - result must always be an allowed mode; falls back to PAY_AT_CLINIC, then the first allowed mode
 */
export function resolvePaymentMode(
  layers: PaymentConfigLayer[],
  entitledModes: PaymentMode[] = ALL_PAYMENT_MODES,
): ResolvedPaymentMode {
  const ordered = [...layers].sort((a, b) => CONFIG_SCOPES.indexOf(a.scope) - CONFIG_SCOPES.indexOf(b.scope));
  let allowed: PaymentMode[] = ALL_PAYMENT_MODES.filter((m) => entitledModes.includes(m));
  for (const l of ordered) {
    if (l.allowedModes && l.allowedModes.length) allowed = allowed.filter((m) => l.allowedModes!.includes(m));
  }
  if (!allowed.length) allowed = ['PAY_AT_CLINIC'];

  let mode: PaymentMode | null = null;
  let decidedBy: ConfigScope = 'PLATFORM';
  let lockedBy: ConfigScope | null = null;
  for (const l of ordered) {
    if (lockedBy) break;
    if (l.selectedMode && allowed.includes(l.selectedMode)) {
      mode = l.selectedMode;
      decidedBy = l.scope;
    }
    if (l.locked) lockedBy = l.scope;
  }
  if (!mode) {
    mode = allowed.includes('PAY_AT_CLINIC') ? 'PAY_AT_CLINIC' : allowed[0];
  }
  return { mode, allowedModes: allowed, decidedBy, lockedBy };
}

/** Modes a clinic is entitled to (ADM-02 payment features). PAY_AT_CLINIC is always available. */
export function entitledPaymentModes(features: Partial<Record<FeatureKey, boolean>>): PaymentMode[] {
  const modes: PaymentMode[] = ['PAY_AT_CLINIC'];
  if (features.PAYMENT_ONLINE_BOOKING_FEE) modes.push('ONLINE_BOOKING_FEE');
  if (features.PAYMENT_ONLINE_FULL) modes.push('ONLINE_FULL');
  return modes;
}

// ---------------------------------------------------------------------------
// Fees, commission & ledger (PAY-05, PAY-08, BR-10)
// ---------------------------------------------------------------------------

export interface FeeRules {
  /** Booking fee in paise (applies only when BOOKING_FEE stream is enabled). */
  bookingFeePaise: number;
  bookingFeeEnabled: boolean;
  /** Commission percentage of consultation fee (0–100) when COMMISSION stream is enabled. */
  commissionPercent: number;
  commissionFlatPaise: number;
  commissionEnabled: boolean;
  /** GST % on the booking fee. */
  taxPercent: number;
}

export interface FeeBreakdown {
  consultationFee: number;
  bookingFee: number;
  tax: number;
  payableNow: number;
  payableAtClinic: number;
  total: number;
}

export function computeFeeBreakdown(consultationFeePaise: number, mode: PaymentMode, rules: FeeRules): FeeBreakdown {
  const bookingFee = rules.bookingFeeEnabled && mode !== 'PAY_AT_CLINIC' ? Math.max(0, rules.bookingFeePaise) : 0;
  const tax = Math.round((bookingFee * Math.max(0, rules.taxPercent)) / 100);
  let payableNow = 0;
  let payableAtClinic = 0;
  if (mode === 'PAY_AT_CLINIC') payableAtClinic = consultationFeePaise;
  else if (mode === 'ONLINE_BOOKING_FEE') {
    payableNow = bookingFee + tax;
    payableAtClinic = consultationFeePaise;
  } else {
    payableNow = consultationFeePaise + bookingFee + tax;
  }
  return {
    consultationFee: consultationFeePaise,
    bookingFee,
    tax,
    payableNow,
    payableAtClinic,
    total: payableNow + payableAtClinic,
  };
}

export interface ShareSplit {
  commission: number;
  clinicShare: number;
  doctorShare: number;
}

/** BR-10. clinicSplitPercent = clinic's share of the consultation fee (rest goes to doctor). */
export function computeShares(consultationFeePaise: number, clinicSplitPercent: number, rules: FeeRules): ShareSplit {
  const commission = rules.commissionEnabled
    ? Math.min(
        consultationFeePaise,
        Math.round((consultationFeePaise * Math.max(0, rules.commissionPercent)) / 100) + Math.max(0, rules.commissionFlatPaise),
      )
    : 0;
  const split = Math.min(100, Math.max(0, clinicSplitPercent));
  const clinicShare = Math.round(((consultationFeePaise - commission) * split) / 100);
  const doctorShare = consultationFeePaise - commission - clinicShare;
  return { commission, clinicShare, doctorShare };
}

// ---------------------------------------------------------------------------
// BR-12 Refunds
// ---------------------------------------------------------------------------

export interface RefundInput {
  actor: CancelActor | 'NO_SHOW';
  minutesBeforeSitting: number;
  paidPaise: number;
  bookingFeePaise: number;
  taxPaise: number;
  patientFullRefundMinutes?: number;
}

export function computeRefund(i: RefundInput): { amount: number; reason: string } {
  const window = i.patientFullRefundMinutes ?? DEFAULT_RULES.patientFullRefundMinutes;
  if (i.paidPaise <= 0) return { amount: 0, reason: 'Nothing was paid online' };
  if (i.actor === 'DOCTOR' || i.actor === 'CLINIC' || i.actor === 'SYSTEM' || i.actor === 'ADMIN') {
    return { amount: i.paidPaise, reason: 'Cancelled by clinic/doctor — full refund' };
  }
  if (i.actor === 'NO_SHOW') return { amount: 0, reason: 'No-show — not refundable' };
  if (i.minutesBeforeSitting >= window) {
    return {
      amount: Math.max(0, i.paidPaise - i.bookingFeePaise - i.taxPaise),
      reason: `Cancelled ≥ ${window / 60} h before — refund minus booking fee`,
    };
  }
  return { amount: 0, reason: `Cancelled < ${window / 60} h before — not refundable` };
}

// ---------------------------------------------------------------------------
// BR-07 No-show blocking
// ---------------------------------------------------------------------------

export interface NoShowThresholds {
  perClinic: number;
  total: number;
}

export interface NoShowEvaluation {
  clinicCount: number;
  totalCount: number;
  blockClinic: boolean;
  blockPlatform: boolean;
  /** One away from a block (PAT-19 warning). */
  warnClinic: boolean;
  warnPlatform: boolean;
}

export function evaluateNoShows(
  clinicCount: number,
  totalCount: number,
  t: NoShowThresholds = { perClinic: DEFAULT_RULES.noShowPerClinicLimit, total: DEFAULT_RULES.noShowTotalLimit },
): NoShowEvaluation {
  return {
    clinicCount,
    totalCount,
    blockClinic: clinicCount >= t.perClinic,
    blockPlatform: totalCount >= t.total,
    warnClinic: clinicCount === t.perClinic - 1,
    warnPlatform: totalCount === t.total - 1,
  };
}

/** BR-07a: does this booking count towards no-show limits? */
export function countsAsNoShow(b: { paymentMode: PaymentMode; source: string; corrected?: boolean }): boolean {
  return b.paymentMode === 'PAY_AT_CLINIC' && b.source === 'ONLINE' && !b.corrected;
}

// ---------------------------------------------------------------------------
// BR-03 / BR-04 booking window & cut-off
// ---------------------------------------------------------------------------

export function effectiveBookingWindowHours(doctorDefaultHours: number | null | undefined, clinicHours: number | null | undefined): number {
  return clinicHours ?? doctorDefaultHours ?? DEFAULT_RULES.defaultBookingWindowHours;
}

export type BookabilityReason = 'OK' | 'TOO_EARLY' | 'CUTOFF_PASSED' | 'FULL' | 'ENDED' | 'CANCELLED';

export function checkBookable(args: {
  now: Date;
  sittingStart: Date;
  sittingEnd: Date;
  windowHours: number;
  cutoffMinutes: number;
  bookedCount: number;
  maxPatients?: number | null;
  status: string;
}): BookabilityReason {
  if (args.status === 'CANCELLED') return 'CANCELLED';
  if (args.status === 'ENDED') return 'ENDED';
  const openFrom = args.sittingStart.getTime() - args.windowHours * 3600_000;
  if (args.now.getTime() < openFrom) return 'TOO_EARLY';
  const cutoff = args.sittingEnd.getTime() - args.cutoffMinutes * 60_000;
  if (args.now.getTime() >= cutoff) return 'CUTOFF_PASSED';
  if (args.maxPatients != null && args.bookedCount >= args.maxPatients) return 'FULL';
  return 'OK';
}

// ---------------------------------------------------------------------------
// BR-01 Token numbering
// ---------------------------------------------------------------------------

/**
 * Next token for a sitting instance. When `walkInEvery` (k) is set, every k-th number is reserved for walk-ins.
 * Online gets the smallest free non-reserved number; walk-ins get the smallest free reserved number above
 * `nowServing`, else the next free number.
 */
export function nextTokenNumber(used: number[], source: 'ONLINE' | 'WALK_IN' | 'OFFLINE', walkInEvery?: number | null, nowServing = 0): number {
  const set = new Set(used);
  const max = used.length ? Math.max(...used) : 0;
  if (!walkInEvery || walkInEvery < 2) return max + 1;
  const k = walkInEvery;
  if (source === 'ONLINE') {
    for (let t = 1; ; t++) if (!set.has(t) && t % k !== 0) return t;
  }
  for (let t = Math.max(k, Math.ceil((nowServing + 1) / k) * k); t <= max + k; t += k) if (!set.has(t)) return t;
  for (let t = nowServing + 1; ; t++) if (!set.has(t)) return t;
}

// ---------------------------------------------------------------------------
// BR-06a Missed turn: late patients who come back
// ---------------------------------------------------------------------------

/** Default number of patients a returning late patient waits behind (clinic setting `lateRejoinAfter`). */
export const DEFAULT_LATE_REJOIN_AFTER = 2;

/**
 * A late patient who arrives rejoins after `rejoinAfter` more patients have been called since they came back
 * (0 = straight after the current patient). If nobody else is waiting they are seen at once.
 */
export function lateRejoinDue(rejoinAfter: number | null | undefined, calledSinceReturn: number, othersWaiting = 1): boolean {
  if (othersWaiting <= 0) return true;
  return calledSinceReturn >= Math.max(0, rejoinAfter ?? 0);
}

/** How many patients are ahead of a returned late patient. */
export function aheadOfReturned(args: { rejoinAfter: number | null | undefined; calledSinceReturn: number; othersWaiting: number; returnedEarlier: number }): number {
  const left = Math.max(0, (args.rejoinAfter ?? 0) - args.calledSinceReturn);
  return args.returnedEarlier + Math.min(left, Math.max(0, args.othersWaiting));
}

// ---------------------------------------------------------------------------
// BR-12a Patient cancellation window
// ---------------------------------------------------------------------------

/**
 * A patient may cancel only until the doctor's sitting starts (scheduled start time, or earlier if the doctor
 * is already online). After that the booking stays; if they do not visit it is marked absent when the sitting
 * ends. An unpaid hold (PENDING_PAYMENT) can always be dropped while the sitting is not over.
 */
export function patientCanCancel(args: { now: Date; sittingStart: Date; sittingEnd: Date; sittingStatus: string; bookingStatus: string }): boolean {
  if (['ENDED', 'CANCELLED'].includes(args.sittingStatus) || args.now.getTime() >= args.sittingEnd.getTime()) return false;
  if (args.bookingStatus === 'PENDING_PAYMENT') return true;
  if (!['BOOKED', 'PRESENT', 'LATE'].includes(args.bookingStatus)) return false;
  const started = args.now.getTime() >= args.sittingStart.getTime() || args.sittingStatus === 'ONLINE' || args.sittingStatus === 'PAUSED';
  return !started;
}

// ---------------------------------------------------------------------------
// BR-08 ETA
// ---------------------------------------------------------------------------

export function estimateTurn(args: {
  now: Date;
  sittingStart: Date;
  patientsAhead: number;
  avgConsultMinutes?: number | null;
  delayMinutes?: number;
  doctorOnline: boolean;
}): { from: Date; to: Date; minutes: number } {
  const avg = args.avgConsultMinutes && args.avgConsultMinutes > 0 ? args.avgConsultMinutes : DEFAULT_RULES.defaultConsultMinutes;
  const base = args.doctorOnline
    ? args.now.getTime()
    : Math.max(args.now.getTime(), args.sittingStart.getTime() + (args.delayMinutes ?? 0) * 60_000);
  const minutes = Math.max(0, args.patientsAhead) * avg;
  const from = new Date(base + minutes * 0.8 * 60_000);
  const to = new Date(base + minutes * 1.2 * 60_000 + 2 * 60_000);
  return { from, to, minutes: Math.round((from.getTime() - args.now.getTime()) / 60_000) };
}

/** Rolling average consult time from served durations (minutes), ignoring outliers. */
export function rollingConsultAverage(durations: number[], fallback = DEFAULT_RULES.defaultConsultMinutes): number {
  const clean = durations.filter((d) => d > 0.5 && d < 90).slice(-20);
  if (clean.length < 3) return fallback;
  return Math.round((clean.reduce((a, b) => a + b, 0) / clean.length) * 10) / 10;
}

// ---------------------------------------------------------------------------
// ADM-02 Entitlements
// ---------------------------------------------------------------------------

export type Entitlements = { features: Record<FeatureKey, boolean>; limits: Record<LimitKey, number | null> };

export function resolveEntitlements(
  planFeatures: Partial<Record<FeatureKey, boolean>>,
  planLimits: Partial<Record<LimitKey, number | null>>,
  overrides: { key: string; enabled?: boolean | null; limit?: number | null }[] = [],
): Entitlements {
  const features = {} as Record<FeatureKey, boolean>;
  for (const k of FEATURE_KEYS) features[k] = !!planFeatures[k];
  const limits = {} as Record<LimitKey, number | null>;
  for (const k of LIMIT_KEYS) limits[k] = planLimits[k] ?? null;
  for (const o of overrides) {
    if ((FEATURE_KEYS as readonly string[]).includes(o.key) && o.enabled != null) features[o.key as FeatureKey] = o.enabled;
    if ((LIMIT_KEYS as readonly string[]).includes(o.key)) limits[o.key as LimitKey] = o.limit ?? null;
  }
  return { features, limits };
}

// ---------------------------------------------------------------------------
// MON-01 Revenue stream switches (most specific scope wins)
// ---------------------------------------------------------------------------

export interface RevenueSettingLayer {
  stream: RevenueStream;
  scope: 'PLATFORM' | 'REGION' | 'CLINIC';
  scopeId?: string | null;
  enabled: boolean;
  effectiveFrom?: Date | string | null;
}

export function isRevenueStreamEnabled(
  layers: RevenueSettingLayer[],
  stream: RevenueStream,
  ctx: { regionId?: string | null; clinicId?: string | null; now?: Date } = {},
): boolean {
  const now = ctx.now ?? new Date();
  const live = layers.filter(
    (l) => l.stream === stream && (!l.effectiveFrom || new Date(l.effectiveFrom).getTime() <= now.getTime()),
  );
  const pick = (scope: RevenueSettingLayer['scope'], id?: string | null) =>
    live.find((l) => l.scope === scope && (scope === 'PLATFORM' || (id && l.scopeId === id)));
  const hit = pick('CLINIC', ctx.clinicId) ?? pick('REGION', ctx.regionId) ?? pick('PLATFORM');
  return hit ? hit.enabled : REVENUE_STREAM_DEFAULTS[stream];
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/** Normalise Indian mobile number to 10 digits, or null if invalid. */
export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const d = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: rupees % 1 === 0 ? 0 : 2 });
}

/** "HH:mm" → minutes after midnight. */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToHm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTime12(hm: string): string {
  const mins = hmToMinutes(hm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

export const IST_OFFSET_MINUTES = 330;

/** Calendar date (YYYY-MM-DD) in IST for an instant. */
export function istDateString(d: Date): string {
  const t = new Date(d.getTime() + IST_OFFSET_MINUTES * 60_000);
  return t.toISOString().slice(0, 10);
}

/** Build a UTC Date from an IST calendar date + "HH:mm". */
export function istDateTime(dateStr: string, hm: string): Date {
  const [y, mo, da] = dateStr.split('-').map(Number);
  const mins = hmToMinutes(hm);
  return new Date(Date.UTC(y, mo - 1, da, 0, mins) - IST_OFFSET_MINUTES * 60_000);
}

/** IST weekday 0=Sun..6=Sat for a YYYY-MM-DD string. */
export function istWeekday(dateStr: string): number {
  const [y, mo, da] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
}

export function addDays(dateStr: string, n: number): string {
  const [y, mo, da] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, da + n)).toISOString().slice(0, 10);
}
