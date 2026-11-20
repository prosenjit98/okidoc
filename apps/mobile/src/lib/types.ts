import type { QueueBookingView, QueueSnapshot } from '@okidoc/shared';

/** Staff view of one sitting instance (doctor & clinic console). */
export interface StaffView {
  snapshot: QueueSnapshot;
  doctor: { id: string; name: string };
  clinic: { id: string; name: string; lateRejoinAfter?: number };
  bookings: QueueBookingView[];
  tiles: { total: number; online: number; walkIn: number; present: number; late: number; cancelled: number };
  specialties?: string[];
  linkId?: string;
}

export interface SittingRow {
  id: string;
  linkId: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  recurrence: string;
  maxPatients?: number | null;
  specificDates: string[];
}

export interface Earnings {
  from: string;
  to: string;
  totals: { visits: number; gross: number; clinicShare: number; doctorShare: number; commission: number; collectedOnline: number; collectedAtClinic: number; uncollected: number };
  chambers: { linkId: string; clinicName: string; doctorName: string; fee: number; clinicSplitPercent: number; visits: number; gross: number; clinicShare: number; doctorShare: number }[];
  sittings: { instanceId: string; date: string; startTime: string; endTime: string; clinicName: string; doctorName: string; visits: number; gross: number; clinicShare: number; doctorShare: number }[];
}

export interface Entitlements {
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  planCode: string | null;
}
