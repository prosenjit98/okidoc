/** API response shapes shared with clients. */
import type { BookingStatus, BookingSource, DoctorPresenceStatus, PaymentMode, Role, SittingStatus } from './constants';
import type { FeeBreakdown } from './rules';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MeUser {
  id: string;
  phone: string;
  name: string;
  email?: string | null;
  language: string;
  roles: Role[];
  gender?: string | null;
  birthYear?: number | null;
  areaId?: string | null;
  doctorId?: string | null;
  clinicIds: string[];
  notifyPrefs?: Record<string, boolean>;
  turnNearThreshold?: number;
}

export interface AuthResult {
  user: MeUser;
  tokens?: AuthTokens;
  /** Mobile: quick-login setup required before tokens are issued. */
  setupToken?: string;
  /** OTP challenge (sign-up verification, admin 2FA, password reset). */
  challengeToken?: string;
  otpSentTo?: string;
  /** Present only when OTP_DEV_ECHO=true (local development). */
  devOtp?: string;
  /** Returned once when biometric quick login is set up. Store in secure (biometric-protected) storage. */
  deviceSecret?: string;
  /** Returned once at sign-up (AUTH-10). */
  backupCode?: string;
}

export interface QueueBookingView {
  id: string;
  tokenNo: number;
  status: BookingStatus;
  source: BookingSource;
  patientName: string;
  phone?: string | null;
  paymentMode: PaymentMode;
  paidAtClinic?: boolean;
  calledAt?: string | null;
  presentAt?: string | null;
  /** Patient tapped "I'm here" in the app (staff confirm with Arrived). */
  checkInAt?: string | null;
  /** Late patient who has come back; rejoins after `rejoinAfter` more patients. */
  recalledAt?: string | null;
  rejoinAfter?: number | null;
  /** "YYYY-MM-DD HH:mm" of the sitting this booking was moved from. */
  movedFrom?: string | null;
}

export interface QueueSnapshot {
  instanceId: string;
  sittingId: string;
  date: string;
  status: SittingStatus;
  presence: DoctorPresenceStatus;
  delayMinutes: number;
  bookingsOpen: boolean;
  startTime: string;
  endTime: string;
  nowServing: number | null;
  waiting: number;
  completed: number;
  avgConsultMinutes: number;
  updatedAt: string;
}

export interface PatientLiveView extends QueueSnapshot {
  bookingId: string;
  myToken: number;
  myStatus: BookingStatus;
  patientsAhead: number;
  etaFrom: string | null;
  etaTo: string | null;
  doctorName: string;
  clinicName: string;
  /** Missed-turn support (BR-06a). */
  checkInAt: string | null;
  lateRejoinAfter: number;
  rejoined: boolean;
  canMove: boolean;
  movedFrom: string | null;
  /** BR-12a: patients can cancel only until the sitting starts; after that a missed visit is marked absent. */
  canCancel: boolean;
  cancelUntil: string;
}

export interface SlotView {
  sittingId: string;
  date: string;
  startTime: string;
  endTime: string;
  clinicId: string;
  clinicName: string;
  clinicArea: string;
  status: SittingStatus;
  bookable: string;
  booked: number;
  maxPatients: number | null;
  consultationFee: number;
  label: string;
}

export interface QuoteView {
  bookable: string;
  paymentMode: PaymentMode;
  allowedModes: PaymentMode[];
  lockedBy: string | null;
  breakdown: FeeBreakdown;
  blocked: null | { scope: 'CLINIC' | 'PLATFORM'; reason: string };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
