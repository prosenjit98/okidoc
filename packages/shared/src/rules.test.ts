import { describe, expect, it } from 'vitest';
import {
  patientCanCancel,
  aheadOfReturned,
  lateRejoinDue,
  checkBookable,
  computeFeeBreakdown,
  computeRefund,
  computeShares,
  estimateTurn,
  evaluateNoShows,
  isRevenueStreamEnabled,
  istDateTime,
  istDateString,
  nextTokenNumber,
  normalizeIndianPhone,
  resolveEntitlements,
  resolvePaymentMode,
  countsAsNoShow,
} from './rules';

const noFees = {
  bookingFeePaise: 2000,
  bookingFeeEnabled: false,
  commissionPercent: 10,
  commissionFlatPaise: 0,
  commissionEnabled: false,
  taxPercent: 18,
};

describe('BR-09 payment mode resolution', () => {
  it('defaults to pay at clinic', () => {
    expect(resolvePaymentMode([]).mode).toBe('PAY_AT_CLINIC');
  });
  it('most specific selection wins', () => {
    const r = resolvePaymentMode([
      { scope: 'PLATFORM', selectedMode: 'PAY_AT_CLINIC' },
      { scope: 'CLINIC', selectedMode: 'ONLINE_BOOKING_FEE' },
      { scope: 'SITTING', selectedMode: 'ONLINE_FULL' },
    ]);
    expect(r.mode).toBe('ONLINE_FULL');
    expect(r.decidedBy).toBe('SITTING');
  });
  it('selection must be allowed', () => {
    const r = resolvePaymentMode([
      { scope: 'PLATFORM', allowedModes: ['PAY_AT_CLINIC', 'ONLINE_BOOKING_FEE'] },
      { scope: 'DOCTOR', selectedMode: 'ONLINE_FULL' },
    ]);
    expect(r.mode).toBe('PAY_AT_CLINIC');
    expect(r.allowedModes).toEqual(['PAY_AT_CLINIC', 'ONLINE_BOOKING_FEE']);
  });
  it('admin lock stops narrower overrides', () => {
    const r = resolvePaymentMode([
      { scope: 'REGION', selectedMode: 'ONLINE_BOOKING_FEE', locked: true },
      { scope: 'CLINIC', selectedMode: 'PAY_AT_CLINIC' },
    ]);
    expect(r.mode).toBe('ONLINE_BOOKING_FEE');
    expect(r.lockedBy).toBe('REGION');
  });
  it('respects clinic entitlements', () => {
    const r = resolvePaymentMode([{ scope: 'CLINIC', selectedMode: 'ONLINE_FULL' }], ['PAY_AT_CLINIC']);
    expect(r.mode).toBe('PAY_AT_CLINIC');
  });
});

describe('fees & shares', () => {
  it('pay at clinic charges nothing now', () => {
    const b = computeFeeBreakdown(30000, 'PAY_AT_CLINIC', noFees);
    expect(b).toMatchObject({ payableNow: 0, payableAtClinic: 30000, bookingFee: 0 });
  });
  it('booking fee only when stream enabled', () => {
    expect(computeFeeBreakdown(30000, 'ONLINE_BOOKING_FEE', noFees).payableNow).toBe(0);
    const b = computeFeeBreakdown(30000, 'ONLINE_BOOKING_FEE', { ...noFees, bookingFeeEnabled: true });
    expect(b).toMatchObject({ bookingFee: 2000, tax: 360, payableNow: 2360, payableAtClinic: 30000 });
  });
  it('full online', () => {
    const b = computeFeeBreakdown(30000, 'ONLINE_FULL', noFees);
    expect(b).toMatchObject({ payableNow: 30000, payableAtClinic: 0 });
  });
  it('no commission at launch', () => {
    expect(computeShares(50000, 20, noFees)).toEqual({ commission: 0, clinicShare: 10000, doctorShare: 40000 });
    expect(computeShares(50000, 20, { ...noFees, commissionEnabled: true }).commission).toBe(5000);
  });
});

describe('BR-12 refunds', () => {
  const base = { paidPaise: 32360, bookingFeePaise: 2000, taxPaise: 360 };
  it('doctor cancel = full', () => expect(computeRefund({ ...base, actor: 'DOCTOR', minutesBeforeSitting: 5 }).amount).toBe(32360));
  it('patient early = minus booking fee', () =>
    expect(computeRefund({ ...base, actor: 'PATIENT', minutesBeforeSitting: 200 }).amount).toBe(30000));
  it('patient late = none', () => expect(computeRefund({ ...base, actor: 'PATIENT', minutesBeforeSitting: 30 }).amount).toBe(0));
  it('no-show = none', () => expect(computeRefund({ ...base, actor: 'NO_SHOW', minutesBeforeSitting: 0 }).amount).toBe(0));
});

describe('BR-07 no-show blocking', () => {
  it('blocks at 3 per clinic', () => {
    expect(evaluateNoShows(2, 2)).toMatchObject({ blockClinic: false, warnClinic: true });
    expect(evaluateNoShows(3, 3)).toMatchObject({ blockClinic: true, blockPlatform: false });
  });
  it('blocks platform at 7 total', () => {
    expect(evaluateNoShows(1, 6)).toMatchObject({ blockPlatform: false, warnPlatform: true });
    expect(evaluateNoShows(1, 7)).toMatchObject({ blockPlatform: true });
  });
  it('only pay-at-clinic online bookings count', () => {
    expect(countsAsNoShow({ paymentMode: 'PAY_AT_CLINIC', source: 'ONLINE' })).toBe(true);
    expect(countsAsNoShow({ paymentMode: 'ONLINE_FULL', source: 'ONLINE' })).toBe(false);
    expect(countsAsNoShow({ paymentMode: 'PAY_AT_CLINIC', source: 'WALK_IN' })).toBe(false);
    expect(countsAsNoShow({ paymentMode: 'PAY_AT_CLINIC', source: 'ONLINE', corrected: true })).toBe(false);
  });
});

describe('BR-01 tokens', () => {
  it('sequential without reservation', () => expect(nextTokenNumber([1, 2, 3], 'WALK_IN')).toBe(4));
  it('reserves every 3rd for walk-ins', () => {
    expect(nextTokenNumber([1, 2], 'ONLINE', 3)).toBe(4);
    expect(nextTokenNumber([1, 2, 4], 'WALK_IN', 3)).toBe(3);
    expect(nextTokenNumber([1, 2, 3, 4], 'WALK_IN', 3, 0)).toBe(6);
  });
});

describe('booking window', () => {
  const start = new Date('2026-11-20T12:30:00Z');
  const end = new Date('2026-11-20T14:30:00Z');
  const common = { sittingStart: start, sittingEnd: end, windowHours: 24, cutoffMinutes: 30, bookedCount: 0, status: 'SCHEDULED' };
  it('too early / ok / cutoff / full', () => {
    expect(checkBookable({ ...common, now: new Date('2026-11-18T12:00:00Z') })).toBe('TOO_EARLY');
    expect(checkBookable({ ...common, now: new Date('2026-11-20T10:00:00Z') })).toBe('OK');
    expect(checkBookable({ ...common, now: new Date('2026-11-20T14:10:00Z') })).toBe('CUTOFF_PASSED');
    expect(checkBookable({ ...common, now: new Date('2026-11-20T10:00:00Z'), bookedCount: 5, maxPatients: 5 })).toBe('FULL');
  });
});

describe('misc', () => {
  it('ETA uses avg', () => {
    const now = new Date('2026-11-20T12:00:00Z');
    const r = estimateTurn({ now, sittingStart: now, patientsAhead: 5, avgConsultMinutes: 10, doctorOnline: true });
    expect(r.minutes).toBe(40);
  });
  it('entitlements overrides', () => {
    const e = resolveEntitlements({ WALK_IN: true }, { MAX_DOCTORS: 3 }, [
      { key: 'WALK_IN', enabled: false },
      { key: 'MAX_DOCTORS', limit: 10 },
    ]);
    expect(e.features.WALK_IN).toBe(false);
    expect(e.limits.MAX_DOCTORS).toBe(10);
  });
  it('revenue switches', () => {
    expect(isRevenueStreamEnabled([], 'ADS')).toBe(true);
    expect(isRevenueStreamEnabled([], 'COMMISSION')).toBe(false);
    const layers = [
      { stream: 'CLINIC_SUBSCRIPTION' as const, scope: 'PLATFORM' as const, enabled: false },
      { stream: 'CLINIC_SUBSCRIPTION' as const, scope: 'CLINIC' as const, scopeId: 'c1', enabled: true },
    ];
    expect(isRevenueStreamEnabled(layers, 'CLINIC_SUBSCRIPTION', { clinicId: 'c1' })).toBe(true);
    expect(isRevenueStreamEnabled(layers, 'CLINIC_SUBSCRIPTION', { clinicId: 'c2' })).toBe(false);
  });
  it('phones', () => {
    expect(normalizeIndianPhone('+91 98300 12345')).toBe('9830012345');
    expect(normalizeIndianPhone('12345')).toBeNull();
  });
  it('IST dates', () => {
    expect(istDateTime('2026-11-20', '18:00').toISOString()).toBe('2026-11-20T12:30:00.000Z');
    expect(istDateString(new Date('2026-11-20T20:00:00Z'))).toBe('2026-11-21');
  });
});

describe('BR-06a missed turn', () => {
  it('returned late patient waits for N more calls', () => {
    expect(lateRejoinDue(2, 0)).toBe(false);
    expect(lateRejoinDue(2, 1)).toBe(false);
    expect(lateRejoinDue(2, 2)).toBe(true);
    expect(lateRejoinDue(0, 0)).toBe(true);
    expect(lateRejoinDue(null, 0)).toBe(true);
  });
  it('is seen at once when nobody else waits', () => {
    expect(lateRejoinDue(3, 0, 0)).toBe(true);
  });
  it('counts patients ahead of a returned patient', () => {
    expect(aheadOfReturned({ rejoinAfter: 2, calledSinceReturn: 0, othersWaiting: 5, returnedEarlier: 0 })).toBe(2);
    expect(aheadOfReturned({ rejoinAfter: 2, calledSinceReturn: 1, othersWaiting: 5, returnedEarlier: 1 })).toBe(2);
    expect(aheadOfReturned({ rejoinAfter: 3, calledSinceReturn: 0, othersWaiting: 1, returnedEarlier: 0 })).toBe(1);
    expect(aheadOfReturned({ rejoinAfter: 0, calledSinceReturn: 0, othersWaiting: 4, returnedEarlier: 0 })).toBe(0);
  });
});

describe('BR-12a cancellation window', () => {
  const start = new Date('2026-11-24T13:00:00Z');
  const end = new Date('2026-11-24T15:30:00Z');
  const at = (iso: string, bookingStatus = 'BOOKED', sittingStatus = 'SCHEDULED') => patientCanCancel({ now: new Date(iso), sittingStart: start, sittingEnd: end, sittingStatus, bookingStatus });
  it('can cancel before the sitting starts', () => {
    expect(at('2026-11-24T12:59:00Z')).toBe(true);
  });
  it('cannot cancel once the start time is reached', () => {
    expect(at('2026-11-24T13:00:00Z')).toBe(false);
    expect(at('2026-11-24T14:00:00Z', 'LATE', 'ONLINE')).toBe(false);
  });
  it('cannot cancel once the doctor is online, even before the start time', () => {
    expect(at('2026-11-24T12:40:00Z', 'BOOKED', 'ONLINE')).toBe(false);
  });
  it('an unpaid hold can be dropped until the sitting ends', () => {
    expect(at('2026-11-24T14:00:00Z', 'PENDING_PAYMENT', 'ONLINE')).toBe(true);
    expect(at('2026-11-24T15:31:00Z', 'PENDING_PAYMENT', 'ONLINE')).toBe(false);
  });
  it('closed bookings cannot be cancelled', () => {
    expect(at('2026-11-24T10:00:00Z', 'SERVED')).toBe(false);
    expect(at('2026-11-24T10:00:00Z', 'BOOKED', 'CANCELLED')).toBe(false);
  });
});
