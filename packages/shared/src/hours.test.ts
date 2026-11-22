import { describe, expect, it } from 'vitest';
import { daysOutsideHours, formatHourShort, hoursProblems, openStatus, weeklyHoursLines, weeklyHoursText, type HoursRange } from './hours';
import { istDateTime } from './rules';
import { clinicSchema, weeklyHoursSchema } from './schemas';

// Mon–Wed 10 AM–10 PM, Thu closed, Fri–Sat 7–9 AM, Sun 7 AM–1 PM (dates below: 2026-11-23 is a Monday).
const H: HoursRange[] = [
  ...[1, 2, 3].map((day) => ({ day, open: '10:00', close: '22:00' })),
  ...[5, 6].map((day) => ({ day, open: '07:00', close: '09:00' })),
  { day: 0, open: '07:00', close: '13:00' },
];
const at = (date: string, hm: string) => istDateTime(date, hm);

describe('CLN-01a clinic opening hours', () => {
  it('formats short times', () => {
    expect(formatHourShort('10:00')).toBe('10 AM');
    expect(formatHourShort('18:30')).toBe('6:30 PM');
    expect(formatHourShort('12:00')).toBe('12 PM');
    expect(formatHourShort('24:00')).toBe('Midnight');
  });

  it('groups days with the same hours, Monday first', () => {
    expect(weeklyHoursLines(H)).toEqual([
      { days: 'Mon–Wed', hours: '10 AM – 10 PM' },
      { days: 'Thu', hours: 'Closed' },
      { days: 'Fri–Sat', hours: '7 AM – 9 AM' },
      { days: 'Sun', hours: '7 AM – 1 PM' },
    ]);
    expect(weeklyHoursText(H)).toBe('Mon–Wed 10 AM – 10 PM · Thu Closed · Fri–Sat 7 AM – 9 AM · Sun 7 AM – 1 PM');
    expect(weeklyHoursText([])).toBe('');
  });

  it('shows split hours on one day', () => {
    const split = [
      { day: 1, open: '17:00', close: '20:00' },
      { day: 1, open: '07:00', close: '09:00' },
    ];
    expect(weeklyHoursLines(split)[0]).toEqual({ days: 'Mon', hours: '7 AM – 9 AM, 5 PM – 8 PM' });
  });

  it('knows whether the clinic is open now', () => {
    expect(openStatus(H, at('2026-11-23', '11:00'))).toEqual({ open: true, text: 'Open now · closes 10 PM' });
    expect(openStatus(H, at('2026-11-23', '08:00'))).toEqual({ open: false, text: 'Closed · opens 10 AM' });
    expect(openStatus(H, at('2026-11-25', '22:30'))).toEqual({ open: false, text: 'Closed · opens Fri 7 AM' }); // Wed night, Thu closed
    expect(openStatus(H, at('2026-11-28', '10:00'))).toEqual({ open: false, text: 'Closed · opens tomorrow 7 AM' }); // Sat after 9
    expect(openStatus([], at('2026-11-23', '11:00'))).toBeNull();
  });

  it('handles open till midnight and past it', () => {
    const late = [
      { day: 1, open: '18:00', close: '24:00' },
      { day: 2, open: '00:00', close: '02:00' },
    ];
    expect(openStatus(late, at('2026-11-23', '23:00'))?.text).toBe('Open now · closes 2 AM');
    expect(openStatus([{ day: 1, open: '18:00', close: '24:00' }], at('2026-11-23', '23:00'))?.text).toBe('Open now · till midnight');
  });

  it('finds sitting days outside the opening hours', () => {
    expect(daysOutsideHours(H, [1, 3], '17:00', '20:00')).toEqual([]);
    expect(daysOutsideHours(H, [1, 4, 5], '17:00', '20:00')).toEqual([4, 5]); // Thu closed, Fri only 7–9 AM
    expect(daysOutsideHours([], [4], '17:00', '20:00')).toEqual([]); // no structured hours → no warning
  });

  it('rejects bad ranges', () => {
    expect(hoursProblems([{ day: 1, open: '10:00', close: '09:00' }])).toEqual(['Mon: closing time must be after opening time']);
    expect(hoursProblems([{ day: 1, open: '10:00', close: '13:00' }, { day: 1, open: '12:00', close: '14:00' }])).toEqual(['Mon: time ranges overlap']);
    expect(weeklyHoursSchema.safeParse(H).success).toBe(true);
    expect(weeklyHoursSchema.safeParse([{ day: 1, open: '10:00', close: '25:00' }]).success).toBe(false);
    expect(clinicSchema.shape.weeklyHours.safeParse(null).success).toBe(true);
  });
});