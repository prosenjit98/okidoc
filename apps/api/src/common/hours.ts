import { daysOutsideHours, istWeekday, weeklyHoursText, type HoursRange } from '@okidoc/shared';
import { Prisma } from '@prisma/client';

/**
 * Clinic create/update data for opening hours (CLN-01a). Structured hours also regenerate the plain-text
 * `openingHours`, so every screen that shows the text stays correct. `null` or `[]` clears the structured hours
 * and keeps whatever text was sent.
 */
export function clinicHoursData(weeklyHours: HoursRange[] | null | undefined): { weeklyHours?: Prisma.InputJsonValue | typeof Prisma.DbNull; openingHours?: string } {
  if (weeklyHours === undefined) return {};
  if (!weeklyHours?.length) return { weeklyHours: Prisma.DbNull };
  const clean = weeklyHours.map(({ day, open, close }) => ({ day, open, close }));
  return { weeklyHours: clean, openingHours: weeklyHoursText(clean).slice(0, 200) };
}

/** Weekdays on which a sitting is outside the clinic's opening hours (empty when the clinic has none set). */
export function sittingOutsideHours(
  weeklyHours: Prisma.JsonValue | null | undefined,
  s: { weekdays: number[]; startTime: string; endTime: string; recurrence?: string; specificDates?: string[] },
): number[] {
  if (!Array.isArray(weeklyHours) || !weeklyHours.length) return [];
  const days = s.recurrence === 'SPECIFIC_DATES' && s.specificDates?.length ? [...new Set(s.specificDates.map(istWeekday))] : s.weekdays;
  return daysOutsideHours(weeklyHours as unknown as HoursRange[], days, s.startTime, s.endTime);
}