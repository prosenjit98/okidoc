import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { useApi } from './hooks';
import { useRoom } from './socket';
import type { Entitlements } from './types';

export interface ClinicInfo {
  id: string;
  code: string;
  name: string;
  type: string;
  addressLine: string;
  areaId: string;
  pin: string;
  phone?: string | null;
  about?: string | null;
  openingHours?: string | null;
  weeklyHours?: import('@okidoc/shared').HoursRange[] | null;
  photos: string[];
  drugLicenceNo?: string | null;
  verification: string;
  verificationNote?: string | null;
  bookingWindowHours?: number | null;
  cutoffMinutes?: number | null;
  lateRejoinAfter?: number;
  payoutUpi?: string | null;
  payoutAccount?: string | null;
  payoutIfsc?: string | null;
  myRole: 'CLINIC_OWNER' | 'QUEUE_MANAGER';
  approvedDoctors: number;
  /** Names of doctors who have not yet answered this clinic's request. */
  pendingDoctors?: string[];
  entitlements: Entitlements;
  area: { name: string; regionId: string };
}

/** Active clinic for the clinic console, with role and entitlements (ADM-02). Refreshes on entitlement changes. */
export function useClinic() {
  const { clinicId } = useAuth();
  const qc = useQueryClient();
  const q = useApi<ClinicInfo>(['clinic-info', clinicId], clinicId ? `/clinic/${clinicId}` : null);
  useRoom(clinicId ? `clinic:${clinicId}` : null, ['entitlements:changed', 'roster:changed'], () => qc.invalidateQueries({ queryKey: ['clinic-info', clinicId] }));
  const c = q.data;
  return {
    clinicId,
    clinic: c,
    loading: q.isLoading,
    error: q.error,
    refetch: q.refetch,
    isOwner: c?.myRole === 'CLINIC_OWNER',
    has: (feature: string) => !!c?.entitlements.features[feature],
  };
}
