/**
 * Domain constants shared by API, web and mobile.
 * String values intentionally match the Prisma enums in apps/api/prisma/schema.prisma.
 */

export const Roles = {
  PATIENT: 'PATIENT',
  DOCTOR: 'DOCTOR',
  CLINIC_OWNER: 'CLINIC_OWNER',
  QUEUE_MANAGER: 'QUEUE_MANAGER',
  ADMIN_SUPER: 'ADMIN_SUPER',
  ADMIN_OPS: 'ADMIN_OPS',
  ADMIN_FINANCE: 'ADMIN_FINANCE',
  ADMIN_SUPPORT: 'ADMIN_SUPPORT',
} as const;
export type Role = (typeof Roles)[keyof typeof Roles];
export const ADMIN_ROLES: Role[] = ['ADMIN_SUPER', 'ADMIN_OPS', 'ADMIN_FINANCE', 'ADMIN_SUPPORT'];
export const CLINIC_ROLES: Role[] = ['CLINIC_OWNER', 'QUEUE_MANAGER'];
/** Roles a user can pick at sign-up (AUTH-03). */
export const SIGNUP_ROLES = ['PATIENT', 'CLINIC_OWNER', 'DOCTOR'] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export const PaymentModes = {
  PAY_AT_CLINIC: 'PAY_AT_CLINIC',
  ONLINE_BOOKING_FEE: 'ONLINE_BOOKING_FEE',
  ONLINE_FULL: 'ONLINE_FULL',
} as const;
export type PaymentMode = (typeof PaymentModes)[keyof typeof PaymentModes];
export const ALL_PAYMENT_MODES: PaymentMode[] = ['PAY_AT_CLINIC', 'ONLINE_BOOKING_FEE', 'ONLINE_FULL'];

/** Payment-config scopes, broadest first (BR-09). */
export const CONFIG_SCOPES = ['PLATFORM', 'REGION', 'CLINIC', 'DOCTOR', 'SITTING'] as const;
export type ConfigScope = (typeof CONFIG_SCOPES)[number];
/** Scopes only Okidoc admins may configure. */
export const ADMIN_CONFIG_SCOPES: ConfigScope[] = ['PLATFORM', 'REGION', 'CLINIC'];

export const BookingStatuses = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  BOOKED: 'BOOKED',
  PRESENT: 'PRESENT',
  LATE: 'LATE',
  SKIPPED: 'SKIPPED',
  IN_CONSULTATION: 'IN_CONSULTATION',
  SERVED: 'SERVED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
} as const;
export type BookingStatus = (typeof BookingStatuses)[keyof typeof BookingStatuses];
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  'PENDING_PAYMENT',
  'BOOKED',
  'PRESENT',
  'LATE',
  'SKIPPED',
  'IN_CONSULTATION',
];

export const BookingSources = { ONLINE: 'ONLINE', WALK_IN: 'WALK_IN', OFFLINE: 'OFFLINE' } as const;
export type BookingSource = (typeof BookingSources)[keyof typeof BookingSources];

export const SittingStatuses = {
  SCHEDULED: 'SCHEDULED',
  ONLINE: 'ONLINE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
} as const;
export type SittingStatus = (typeof SittingStatuses)[keyof typeof SittingStatuses];

export const DoctorPresence = {
  NOT_ARRIVED: 'NOT_ARRIVED',
  ONLINE: 'ONLINE',
  ON_BREAK: 'ON_BREAK',
  DELAYED: 'DELAYED',
} as const;
export type DoctorPresenceStatus = (typeof DoctorPresence)[keyof typeof DoctorPresence];

export const LinkStatuses = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DECLINED: 'DECLINED',
  REMOVED: 'REMOVED',
} as const;
export type LinkStatus = (typeof LinkStatuses)[keyof typeof LinkStatuses];

export const VerificationStatuses = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  INFO_REQUESTED: 'INFO_REQUESTED',
} as const;
export type VerificationStatus = (typeof VerificationStatuses)[keyof typeof VerificationStatuses];

export const CancelActors = {
  PATIENT: 'PATIENT',
  CLINIC: 'CLINIC',
  DOCTOR: 'DOCTOR',
  SYSTEM: 'SYSTEM',
  ADMIN: 'ADMIN',
} as const;
export type CancelActor = (typeof CancelActors)[keyof typeof CancelActors];

export const RevenueStreams = {
  ADS: 'ADS',
  CLINIC_SUBSCRIPTION: 'CLINIC_SUBSCRIPTION',
  DOCTOR_SUBSCRIPTION: 'DOCTOR_SUBSCRIPTION',
  BOOKING_FEE: 'BOOKING_FEE',
  COMMISSION: 'COMMISSION',
  SPONSORED_LISTINGS: 'SPONSORED_LISTINGS',
} as const;
export type RevenueStream = (typeof RevenueStreams)[keyof typeof RevenueStreams];
/** Pilot defaults (PRD §4.7). */
export const REVENUE_STREAM_DEFAULTS: Record<RevenueStream, boolean> = {
  ADS: true,
  CLINIC_SUBSCRIPTION: false,
  DOCTOR_SUBSCRIPTION: false,
  BOOKING_FEE: false,
  COMMISSION: false,
  SPONSORED_LISTINGS: false,
};

/** Clinic feature entitlements (ADM-02). Boolean features. */
export const FEATURE_KEYS = [
  'ONLINE_BOOKING',
  'WALK_IN',
  'QUEUE_MANAGER',
  'RECORDS',
  'EARNINGS',
  'PAYMENT_ONLINE_BOOKING_FEE',
  'PAYMENT_ONLINE_FULL',
  'WHATSAPP',
  'DOCTORS_POSTER',
  'OPEN_SLOTS',
  'BONUSES',
  'WEB_CONSOLE',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Numeric limits (ADM-02). `null` = unlimited. */
export const LIMIT_KEYS = ['MAX_DOCTORS', 'MAX_SITTINGS', 'MAX_QUEUE_MANAGERS'] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey | LimitKey, string> = {
  ONLINE_BOOKING: 'Online booking',
  WALK_IN: 'Walk-in entry',
  QUEUE_MANAGER: 'Queue Manager accounts',
  RECORDS: 'Records register',
  EARNINGS: 'Earnings & history',
  PAYMENT_ONLINE_BOOKING_FEE: 'Payment mode: online booking fee',
  PAYMENT_ONLINE_FULL: 'Payment mode: full online prepayment',
  WHATSAPP: 'WhatsApp messaging',
  DOCTORS_POSTER: "Today's doctors poster",
  OPEN_SLOTS: 'Open slots',
  BONUSES: 'Bonuses & Prizes',
  WEB_CONSOLE: 'Web console access',
  MAX_DOCTORS: 'Maximum doctors',
  MAX_SITTINGS: 'Maximum weekly sittings',
  MAX_QUEUE_MANAGERS: 'Maximum Queue Manager accounts',
};

export const CLINIC_TYPES = [
  'PHARMACY_CHAMBER',
  'CLINIC',
  'POLYCLINIC',
  'WOMENS_CLINIC',
  'CHILD_CLINIC',
  'DENTAL_CLINIC',
  'EYE_CLINIC',
  'BONE_JOINT',
] as const;
export type ClinicType = (typeof CLINIC_TYPES)[number];
export const CLINIC_TYPE_LABELS: Record<ClinicType, string> = {
  PHARMACY_CHAMBER: 'Pharmacy chamber',
  CLINIC: 'Clinic',
  POLYCLINIC: 'Polyclinic',
  WOMENS_CLINIC: "Women's clinic",
  CHILD_CLINIC: 'Child clinic',
  DENTAL_CLINIC: 'Dental clinic',
  EYE_CLINIC: 'Eye clinic',
  BONE_JOINT: 'Bone & joint',
};

export const LANGUAGES = ['bn', 'en', 'hi'] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_NAMES: Record<Language, string> = { bn: 'বাংলা', en: 'English', hi: 'हिन्दी' };

export const BOOKING_WINDOW_OPTIONS_HOURS = [24, 72, 168, 360] as const; // 24h, 3d, 7d, 15d

export const AD_PLACEMENTS = ['HOME_BANNER', 'HOME_NATIVE', 'POST_BOOKING_INTERSTITIAL', 'SEARCH_SPONSORED'] as const;
export type AdPlacementKey = (typeof AD_PLACEMENTS)[number];
/** Screens where ads must never render (MON-02). */
export const AD_FREE_SCREENS = ['LIVE_QUEUE', 'CHECKOUT', 'PAYMENT', 'OTP', 'PASSCODE', 'RECORDS'] as const;

export const NOTIFICATION_TYPES = [
  'BOOKING_CONFIRMED',
  'PAYMENT_SUCCESS',
  'REFUND_ISSUED',
  'REMINDER',
  'DOCTOR_ONLINE',
  'TURN_NEAR',
  'YOU_ARE_NEXT',
  'MISSED_TURN',
  'BOOKING_MOVED',
  'DOCTOR_DELAYED',
  'SITTING_CANCELLED',
  'BOOKING_CANCELLED',
  'LINK_REQUEST',
  'LINK_RESPONSE',
  'SITTING_CHANGED',
  'VERIFICATION_RESULT',
  'ENTITLEMENT_CHANGED',
  'RATE_VISIT',
  'BONUS_MILESTONE',
  'NO_SHOW_RECORDED',
  'MARKED_ABSENT',
  'NO_SHOW_WARNING',
  'PATIENT_BLOCKED',
  'BLOCK_LIFTED',
  'SUBSCRIPTION',
  'GENERAL',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Default business-rule values (all admin-configurable via PlatformSetting). */
export const DEFAULT_RULES = {
  noShowPerClinicLimit: 3,
  noShowTotalLimit: 7,
  maxActiveBookings: 3,
  defaultConsultMinutes: 7,
  turnNearThreshold: 3,
  paymentHoldMinutes: 10,
  patientFullRefundMinutes: 120,
  defaultBookingWindowHours: 168,
  defaultCutoffMinutes: 30,
  passcodeMaxAttempts: 5,
  clinicCanLiftBlocks: false,
} as const;
export type RuleSettings = { -readonly [K in keyof typeof DEFAULT_RULES]: (typeof DEFAULT_RULES)[K] extends boolean ? boolean : number };
