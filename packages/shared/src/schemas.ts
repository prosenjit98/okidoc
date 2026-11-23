/** Request DTO schemas (zod) shared by API validation and clients. */
import { z } from 'zod';
import {
  ALL_PAYMENT_MODES,
  AD_PLACEMENTS,
  CLINIC_TYPES,
  FEATURE_KEYS,
  INDIAN_STATES,
  LANGUAGES,
  LIMIT_KEYS,
  NOTIFICATION_TYPES,
  SIGNUP_ROLES,
} from './constants';
import { hoursProblems } from './hours';
import { normalizeIndianPhone } from './rules';

export const phoneSchema = z
  .string()
  .transform((v, ctx) => {
    const n = normalizeIndianPhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid 10-digit Indian mobile number' });
      return z.NEVER;
    }
    return n;
  });

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a digit');

export const passcodeSchema = z.string().regex(/^\d{4,6}$/, 'Passcode must be 4–6 digits');
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const paymentModeSchema = z.enum(ALL_PAYMENT_MODES as [string, ...string[]]) as z.ZodType<
  'PAY_AT_CLINIC' | 'ONLINE_BOOKING_FEE' | 'ONLINE_FULL'
>;
export const languageSchema = z.enum(LANGUAGES);
export const deviceSchema = z.object({
  deviceId: z.string().min(8).max(128),
  deviceName: z.string().max(100).optional(),
  platform: z.enum(['android', 'ios', 'web']).default('android'),
});

// ---------------- Auth ----------------
export const signupSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
  name: z.string().min(1).max(100),
  role: z.enum(SIGNUP_ROLES),
  language: languageSchema.default('bn'),
  consent: z.literal(true, { errorMap: () => ({ message: 'Consent is required' }) }),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const verifyOtpSchema = z.object({ challengeToken: z.string(), code: z.string().regex(/^\d{6}$/) });
export const resendOtpSchema = z.object({ challengeToken: z.string() });

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1),
  client: z.enum(['mobile', 'web']).default('mobile'),
  device: deviceSchema.optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const emailLoginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
});

export const quickLoginSetupSchema = z
  .object({
    setupToken: z.string(),
    device: deviceSchema,
    method: z.enum(['PASSCODE', 'BIOMETRIC']),
    passcode: passcodeSchema.optional(),
  })
  .refine((v) => v.method === 'BIOMETRIC' || !!v.passcode, { message: 'Passcode required', path: ['passcode'] });
export type QuickLoginSetupInput = z.infer<typeof quickLoginSetupSchema>;

export const quickLoginSchema = z
  .object({
    userId: z.string().min(1),
    deviceId: z.string().min(8),
    method: z.enum(['PASSCODE', 'BIOMETRIC']),
    passcode: passcodeSchema.optional(),
    deviceSecret: z.string().optional(),
  })
  .refine((v) => (v.method === 'PASSCODE' ? !!v.passcode : !!v.deviceSecret), { message: 'Credential required' });
export type QuickLoginInput = z.infer<typeof quickLoginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string() });
export const forgotPasswordSchema = z.object({ phone: phoneSchema });
export const resetPasswordSchema = z.object({
  challengeToken: z.string(),
  code: z.string().regex(/^\d{6}$/),
  newPassword: passwordSchema,
});
export const backupRecoverSchema = z.object({
  phone: phoneSchema,
  backupCode: z.string().min(10).max(14),
  newPassword: passwordSchema,
});
export const changePasswordSchema = z.object({ currentPassword: z.string(), newPassword: passwordSchema });
export const changePasscodeSchema = z.object({ deviceId: z.string(), newPasscode: passcodeSchema });
export const biometricToggleSchema = z.object({ deviceId: z.string(), enabled: z.boolean() });
export const addRoleSchema = z.object({ role: z.enum(SIGNUP_ROLES) });
export const pushTokenSchema = z.object({ deviceId: z.string(), pushToken: z.string() });

export const updateMeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().nullable(),
  language: languageSchema.optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  birthYear: z.number().int().min(1900).max(2100).optional().nullable(),
  areaId: z.string().optional().nullable(),
  notifyPrefs: z.record(z.string(), z.boolean()).optional(),
  turnNearThreshold: z.number().int().min(1).max(20).optional(),
});

// ---------------- Patient ----------------
export const familyMemberSchema = z.object({
  name: z.string().min(1).max(100),
  relation: z.string().min(1).max(40),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  birthYear: z.number().int().min(1900).max(2100).optional().nullable(),
});

export const bookingQuoteSchema = z.object({ sittingId: z.string(), date: dateStr, memberId: z.string().optional().nullable() });
export const createBookingSchema = bookingQuoteSchema.extend({
  note: z.string().max(300).optional(),
  sharedRecordIds: z.array(z.string()).max(10).optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export const cancelBookingSchema = z.object({ reason: z.string().max(200).optional() });
export const confirmPaymentSchema = z.object({
  gatewayOrderId: z.string(),
  gatewayPaymentId: z.string(),
  signature: z.string(),
});
/** PAT-16: rate the doctor (`rating`), the clinic (`clinicRating`), or both, after a completed visit. */
const stars = z.number().int().min(1).max(5);
export const reviewSchema = z
  .object({ rating: stars.optional(), clinicRating: stars.optional(), comment: z.string().trim().max(500).optional() })
  .refine((v) => v.rating != null || v.clinicRating != null, { message: 'Rate the doctor, the clinic, or both' });
export const assistantSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(20),
  language: languageSchema.optional(),
});
export const recordMetaSchema = z.object({
  title: z.string().min(1).max(120),
  type: z.enum(['PRESCRIPTION', 'REPORT', 'IMAGE', 'OTHER']).default('OTHER'),
  memberId: z.string().optional().nullable(),
  doctorName: z.string().max(100).optional().nullable(),
  recordDate: dateStr.optional(),
});

// ---------------- Doctor ----------------
export const doctorProfileSchema = z.object({
  registrationNo: z.string().min(3).max(40).optional(),
  council: z.string().min(2).max(80).optional(),
  degrees: z.string().max(200).optional(),
  specialtyIds: z.array(z.string()).max(5).optional(),
  experienceYears: z.number().int().min(0).max(70).optional(),
  about: z.string().max(1500).optional(),
  languagesSpoken: z.array(z.string()).max(8).optional(),
  defaultBookingWindowHours: z.number().int().min(1).max(24 * 30).optional(),
  canRunQueue: z.boolean().optional(),
});
export const sittingSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: hhmm,
  endTime: hhmm,
  recurrence: z.enum(['WEEKLY', 'ALTERNATE_WEEKS', 'SPECIFIC_DATES']).default('WEEKLY'),
  specificDates: z.array(dateStr).optional(),
  anchorDate: dateStr.optional(),
  maxPatients: z.number().int().min(1).max(500).optional().nullable(),
  validFrom: dateStr.optional(),
  validTo: dateStr.optional().nullable(),
});
export type SittingInput = z.infer<typeof sittingSchema>;
export const doctorSittingSchema = sittingSchema.extend({ linkId: z.string() });
export const exceptionSchema = z.object({
  sittingId: z.string().optional().nullable(),
  fromDate: dateStr,
  toDate: dateStr,
  type: z.enum(['OFF', 'CHANGED_TIME']).default('OFF'),
  startTime: hhmm.optional(),
  endTime: hhmm.optional(),
  reason: z.string().max(200).optional(),
});
export const linkRespondSchema = z.object({ accept: z.boolean(), reason: z.string().max(200).optional() });
export const linkRequestByDoctorSchema = z.object({ clinicCode: z.string().min(4).max(12) });
export const presenceSchema = z.object({
  status: z.enum(['NOT_ARRIVED', 'ONLINE', 'ON_BREAK', 'DELAYED']),
  delayMinutes: z.number().int().min(0).max(600).optional(),
});
export const freeHoursSchema = z.object({
  areaId: z.string().optional().nullable(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: hhmm,
  endTime: hhmm,
  note: z.string().max(300).optional(),
});

// ---------------- Clinic ----------------
/** Clinic opening hours: ranges per weekday (no range = closed). `close` may be 24:00 (till midnight). */
export const weeklyHoursSchema = z
  .array(
    z.object({
      day: z.number().int().min(0).max(6),
      open: hhmm,
      close: z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'Use HH:mm'),
    }),
  )
  .max(21)
  .superRefine((rows, ctx) => {
    for (const message of hoursProblems(rows)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  });

/** A locality a clinic adds when it is not in the area list yet (reused if it already exists). */
export const newAreaSchema = z.object({
  name: z.string().trim().min(2).max(60),
  pin: z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code'),
  district: z.string().trim().min(2).max(60),
  state: z.enum(INDIAN_STATES),
});
export type NewAreaInput = z.infer<typeof newAreaSchema>;

export const clinicSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(CLINIC_TYPES),
  addressLine: z.string().min(3).max(300),
  areaId: z.string(),
  pin: z.string().regex(/^\d{6}$/),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  phone: phoneSchema.optional(),
  about: z.string().max(1500).optional(),
  openingHours: z.string().max(200).optional(),
  /** Structured hours; when set, `openingHours` is generated from it. */
  weeklyHours: weeklyHoursSchema.optional().nullable(),
  drugLicenceNo: z.string().max(60).optional().nullable(),
  bookingWindowHours: z.number().int().min(1).max(24 * 30).optional().nullable(),
  cutoffMinutes: z.number().int().min(0).max(600).optional(),
  /** BR-06: a late patient who arrives is seen after this many more patients (0 = right after the current one). */
  lateRejoinAfter: z.number().int().min(0).max(20).optional(),
  payoutUpi: z.string().max(80).optional().nullable(),
  payoutAccount: z.string().max(40).optional().nullable(),
  payoutIfsc: z.string().max(20).optional().nullable(),
});
export type ClinicInput = z.infer<typeof clinicSchema>;
export const clinicUpdateSchema = clinicSchema.partial();
export const clinicAddDoctorSchema = z
  .object({
    doctorId: z.string().optional(),
    invitePhone: phoneSchema.optional(),
    inviteName: z.string().max(100).optional(),
    consultationFee: z.number().int().min(0).max(10_000_00).default(0),
    clinicSplitPercent: z.number().min(0).max(100).default(0),
  })
  .refine((v) => v.doctorId || v.invitePhone, { message: 'Choose a doctor or enter a phone number to invite' });
export const linkUpdateSchema = z.object({
  consultationFee: z.number().int().min(0).max(10_000_00).optional(),
  clinicSplitPercent: z.number().min(0).max(100).optional(),
  walkInEvery: z.number().int().min(2).max(10).optional().nullable(),
  avgConsultMinutes: z.number().min(1).max(90).optional().nullable(),
});
export const walkInSchema = z.object({
  name: z.string().min(1).max(100),
  phone: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
  clientRef: z.string().max(64).optional(),
});
export const bookingActionSchema = z.object({
  action: z.enum(['PRESENT', 'LATE', 'SKIP', 'RECALL', 'CALL', 'COMPLETE', 'NO_SHOW', 'UNDO_NO_SHOW', 'PAID_AT_CLINIC', 'CANCEL', 'MOVE_NEXT']),
  paidVia: z.enum(['CASH', 'UPI', 'CARD']).optional(),
  /** CANCEL by the clinic: sent to the patient. */
  reason: z.string().trim().max(200).optional(),
});
export const instanceActionSchema = z.object({
  action: z.enum(['ONLINE', 'OFFLINE', 'PAUSE', 'RESUME', 'END', 'DELAY', 'STOP_BOOKINGS', 'OPEN_BOOKINGS', 'CANCEL', 'CALL_NEXT']),
  delayMinutes: z.number().int().min(0).max(600).optional(),
  reason: z.string().max(200).optional(),
  /** With END: move patients who missed their turn to the doctor's next sitting instead of marking them no-show. */
  moveLate: z.boolean().optional(),
});
export const clinicPaymentSettingsSchema = z.object({
  defaultMode: paymentModeSchema.optional().nullable(),
  doctorOverrides: z.array(z.object({ linkId: z.string(), mode: paymentModeSchema.nullable() })).optional(),
  sittingOverrides: z.array(z.object({ sittingId: z.string(), mode: paymentModeSchema.nullable() })).optional(),
});
export const staffSchema = z.object({ name: z.string().min(1).max(100), phone: phoneSchema, password: passwordSchema });
export const openSlotSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: hhmm,
  endTime: hhmm,
  specialtyIds: z.array(z.string()).optional(),
  note: z.string().max(300).optional(),
});
export const subscribeSchema = z.object({ planId: z.string() });
export const ticketSchema = z.object({
  subject: z.string().min(3).max(150),
  body: z.string().min(3).max(4000),
  category: z.enum(['BOOKING', 'CLINIC', 'ACCOUNT', 'PAYMENT', 'BLOCK_APPEAL', 'OTHER']).default('OTHER'),
  clinicId: z.string().optional(),
  bookingId: z.string().optional(),
});
export const ticketReplySchema = z.object({ body: z.string().min(1).max(4000) });

// ---------------- Admin ----------------
export const verificationDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'INFO_REQUESTED']),
  reason: z.string().max(300).optional(),
});
export const entitlementOverrideSchema = z.object({
  planId: z.string().optional().nullable(),
  overrides: z
    .array(
      z.object({
        key: z.enum([...FEATURE_KEYS, ...LIMIT_KEYS] as [string, ...string[]]),
        enabled: z.boolean().optional().nullable(),
        limit: z.number().int().min(0).optional().nullable(),
      }),
    )
    .default([]),
});
export const planSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(60),
  priceMonthlyPaise: z.number().int().min(0),
  priceYearlyPaise: z.number().int().min(0).optional().nullable(),
  trialDays: z.number().int().min(0).max(365).default(0),
  features: z.record(z.string(), z.boolean()),
  limits: z.record(z.string(), z.number().int().nullable()),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export const paymentConfigSchema = z.object({
  scope: z.enum(['PLATFORM', 'REGION', 'CLINIC']),
  scopeId: z.string().optional().nullable(),
  allowedModes: z.array(paymentModeSchema).optional().nullable(),
  selectedMode: paymentModeSchema.optional().nullable(),
  locked: z.boolean().default(false),
  bookingFeePaise: z.number().int().min(0).optional().nullable(),
  commissionPercent: z.number().min(0).max(100).optional().nullable(),
  commissionFlatPaise: z.number().int().min(0).optional().nullable(),
  taxPercent: z.number().min(0).max(50).optional().nullable(),
  patientFullRefundMinutes: z.number().int().min(0).max(7 * 24 * 60).optional().nullable(),
});
export const revenueSettingSchema = z.object({
  stream: z.enum(['ADS', 'CLINIC_SUBSCRIPTION', 'DOCTOR_SUBSCRIPTION', 'BOOKING_FEE', 'COMMISSION', 'SPONSORED_LISTINGS']),
  scope: z.enum(['PLATFORM', 'REGION', 'CLINIC']),
  scopeId: z.string().optional().nullable(),
  enabled: z.boolean(),
  effectiveFrom: z.string().datetime().optional().nullable(),
});
export const adPlacementSchema = z.object({
  key: z.enum(AD_PLACEMENTS),
  enabled: z.boolean(),
  source: z.enum(['HOUSE', 'ADMOB', 'HOUSE_THEN_ADMOB']).default('HOUSE_THEN_ADMOB'),
  admobUnitAndroid: z.string().max(100).optional().nullable(),
  admobUnitIos: z.string().max(100).optional().nullable(),
  frequencyCapPerDay: z.number().int().min(0).max(100).default(0),
});
export const adCampaignSchema = z.object({
  advertiser: z.string().min(2).max(100),
  title: z.string().min(2).max(80),
  body: z.string().max(200).optional(),
  imageUrl: z.string().url().optional().nullable(),
  ctaLabel: z.string().max(30).optional(),
  ctaUrl: z.string().url().optional().nullable(),
  category: z.string().max(40),
  placements: z.array(z.enum(AD_PLACEMENTS)).min(1),
  areaIds: z.array(z.string()).default([]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  active: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(10),
});
export const ruleSettingsSchema = z.object({
  noShowPerClinicLimit: z.number().int().min(1).max(50).optional(),
  noShowTotalLimit: z.number().int().min(1).max(100).optional(),
  maxActiveBookings: z.number().int().min(1).max(20).optional(),
  defaultConsultMinutes: z.number().int().min(1).max(60).optional(),
  turnNearThreshold: z.number().int().min(1).max(20).optional(),
  paymentHoldMinutes: z.number().int().min(1).max(60).optional(),
  patientFullRefundMinutes: z.number().int().min(0).max(7 * 24 * 60).optional(),
  defaultBookingWindowHours: z.number().int().min(1).max(24 * 30).optional(),
  defaultCutoffMinutes: z.number().int().min(0).max(600).optional(),
  passcodeMaxAttempts: z.number().int().min(3).max(10).optional(),
  clinicCanLiftBlocks: z.boolean().optional(),
  blockedAdCategories: z.array(z.string()).optional(),
});
export const liftBlockSchema = z.object({ reason: z.string().min(3).max(300) });
export const manualRefundSchema = z.object({ amountPaise: z.number().int().min(1), reason: z.string().min(3).max(300) });
export const settlementPaidSchema = z.object({ reference: z.string().min(2).max(100) });
export const bonusCampaignSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  metric: z.enum(['PATIENTS_SERVED', 'DOCTORS_ADDED', 'ONLINE_BOOKINGS']),
  target: z.number().int().min(1),
  rewardPaise: z.number().int().min(0),
  startsAt: dateStr,
  endsAt: dateStr,
  clinicIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});
export const specialtySchema = z.object({
  name: z.string().min(2).max(80),
  patientName: z.string().max(80).optional(),
  nameBn: z.string().max(80).optional(),
  nameHi: z.string().max(80).optional(),
  icon: z.string().max(40).optional(),
  keywords: z.array(z.string()).default([]),
  sortOrder: z.number().int().default(0),
});
/** ADM-10: an area added or edited by an Okidoc admin (one at a time or as a CSV row). */
export const areaSchema = newAreaSchema.extend({
  nameBn: z.string().trim().max(60).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  active: z.boolean().optional(),
});
export type AreaInput = z.infer<typeof areaSchema>;
export const areaEditSchema = areaSchema.partial();
export const AREA_BULK_MAX_ROWS = 2000;
/** CSV rows as text (validated row by row on the server so one bad row does not reject the file). */
export const areaBulkSchema = z.object({
  dryRun: z.boolean(),
  rows: z
    .array(z.object({ line: z.number().int().min(1) }).catchall(z.string().max(200)))
    .min(1)
    .max(AREA_BULK_MAX_ROWS),
});
export const translationSchema = z.object({ language: languageSchema, key: z.string().min(1).max(150), value: z.string().max(2000) });
export const userAdminActionSchema = z.object({
  action: z.enum(['BLOCK', 'UNBLOCK', 'FORCE_LOGOUT', 'RESET_QUICK_LOGIN']),
  reason: z.string().max(300).optional(),
});
export const broadcastSchema = z.object({
  type: z.enum(NOTIFICATION_TYPES).default('GENERAL'),
  title: z.string().max(80),
  body: z.string().max(300),
});
