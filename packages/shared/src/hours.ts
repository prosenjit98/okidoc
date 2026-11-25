/**
 * Clinic opening hours (CLN-01a): time ranges per weekday, e.g. Mon–Wed 10:00–22:00, Fri–Sat 07:00–09:00.
 * A day with no range is closed. `close` may be "24:00" (open till midnight). Times are IST.
 */
import { hmToMinutes, istDateString, istWeekday, IST_OFFSET_MINUTES } from './rules';

export interface HoursRange {
  /** 0 = Sunday … 6 = Saturday. */
  day: number;
  open: string;
  close: string;
}

/** Display order: Monday first. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const MAX_RANGES_PER_DAY = 3;

/** "10:00" → "10 AM", "18:30" → "6:30 PM", "24:00" → "Midnight". */
export function formatHourShort(hm: string): string {
  const mins = hmToMinutes(hm);
  if (mins === 0 || mins === 1440) return 'Midnight';
  if (mins === 720) return '12 PM';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Ranges for one weekday, earliest first. */
export function rangesForDay(hours: readonly HoursRange[] | null | undefined, day: number): HoursRange[] {
  return (hours ?? []).filter((r) => r.day === day).sort((a, b) => hmToMinutes(a.open) - hmToMinutes(b.open));
}

/** Problems with a set of ranges (empty = valid). Used by the API schema and the editors. */
export function hoursProblems(hours: readonly HoursRange[]): string[] {
  const out: string[] = [];
  for (const day of WEEK_ORDER) {
    const rs = rangesForDay(hours, day);
    if (rs.length > MAX_RANGES_PER_DAY) out.push(`${DAY_SHORT[day]}: at most ${MAX_RANGES_PER_DAY} time ranges`);
    rs.forEach((r, i) => {
      if (hmToMinutes(r.close) <= hmToMinutes(r.open)) out.push(`${DAY_SHORT[day]}: closing time must be after opening time`);
      else if (i > 0 && hmToMinutes(r.open) < hmToMinutes(rs[i - 1].close)) out.push(`${DAY_SHORT[day]}: time ranges overlap`);
    });
  }
  return out;
}

const dayLabel = (r: readonly HoursRange[]) => (r.length ? r.map((x) => `${formatHourShort(x.open)} – ${formatHourShort(x.close)}`).join(', ') : 'Closed');

/**
 * Days with the same hours grouped, Monday first:
 * [{ days: 'Mon–Wed', hours: '10 AM – 10 PM' }, { days: 'Thu', hours: 'Closed' }, …]
 */
export function weeklyHoursLines(hours: readonly HoursRange[] | null | undefined): { days: string; hours: string }[] {
  const lines: { from: number; to: number; hours: string }[] = [];
  for (const day of WEEK_ORDER) {
    const label = dayLabel(rangesForDay(hours, day));
    const last = lines[lines.length - 1];
    if (last && last.hours === label) last.to = day;
    else lines.push({ from: day, to: day, hours: label });
  }
  return lines.map((l) => ({ days: l.from === l.to ? DAY_SHORT[l.from] : `${DAY_SHORT[l.from]}–${DAY_SHORT[l.to]}`, hours: l.hours }));
}

/** One line for lists and the plain-text field: "Mon–Wed 10 AM – 10 PM · Thu Closed · …". */
export function weeklyHoursText(hours: readonly HoursRange[] | null | undefined): string {
  if (!hours?.length) return '';
  return weeklyHoursLines(hours)
    .map((l) => `${l.days} ${l.hours}`)
    .join(' · ');
}

/** Open right now (IST)? With the next change: "Open now · closes 10 PM" / "Closed · opens Fri 7 AM". */
export function openStatus(hours: readonly HoursRange[] | null | undefined, now = new Date()): { open: boolean; text: string } | null {
  if (!hours?.length) return null;
  const today = istDateString(now);
  const t = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  const nowMin = t.getUTCHours() * 60 + t.getUTCMinutes();
  const wd = istWeekday(today);
  const current = rangesForDay(hours, wd).find((r) => hmToMinutes(r.open) <= nowMin && nowMin < hmToMinutes(r.close));
  if (current) {
    // Open past midnight into the next day's first range (e.g. 18:00–24:00 then 00:00–02:00).
    let closes = current.close;
    if (hmToMinutes(closes) === 1440) {
      const next = rangesForDay(hours, (wd + 1) % 7)[0];
      if (next && hmToMinutes(next.open) === 0) closes = next.close;
    }
    return { open: true, text: hmToMinutes(closes) === 1440 ? 'Open now · till midnight' : `Open now · closes ${formatHourShort(closes)}` };
  }
  for (let i = 0; i < 7; i++) {
    const day = (wd + i) % 7;
    const next = rangesForDay(hours, day).find((r) => i > 0 || hmToMinutes(r.open) > nowMin);
    if (next) {
      const when = i === 0 ? '' : i === 1 ? 'tomorrow ' : `${DAY_SHORT[day]} `;
      return { open: false, text: `Closed · opens ${when}${formatHourShort(next.open)}` };
    }
  }
  return { open: false, text: 'Closed' };
}

/**
 * Weekdays on which a sitting (start–end) is not fully inside the clinic's opening hours.
 * Empty when the clinic has not set structured hours.
 */
export function daysOutsideHours(hours: readonly HoursRange[] | null | undefined, weekdays: readonly number[], startTime: string, endTime: string): number[] {
  if (!hours?.length) return [];
  const s = hmToMinutes(startTime);
  const e = hmToMinutes(endTime);
  return weekdays.filter((d) => !rangesForDay(hours, d).some((r) => hmToMinutes(r.open) <= s && e <= hmToMinutes(r.close)));
}

/** "Thu, Sat" for warnings. */
export const dayList = (days: readonly number[]) => WEEK_ORDER.filter((d) => days.includes(d)).map((d) => DAY_SHORT[d]).join(', ');

/**
 * Own chamber: the doctor's sittings start as a copy of the chamber's opening hours. Days with the same time range
 * become one sitting (Mon–Sat 9–9 → one sitting on six days); a split day (7–9 AM and 5–8 PM) gives two sittings.
 * Sittings end by 23:59, so "till midnight" (24:00) becomes 23:59.
 */
export function sittingsFromHours(hours: readonly HoursRange[] | null | undefined): { weekdays: number[]; startTime: string; endTime: string }[] {
  const groups = new Map<string, number[]>();
  for (const r of hours ?? []) {
    const end = r.close === '24:00' || r.close === '00:00' ? '23:59' : r.close;
    if (hmToMinutes(end) <= hmToMinutes(r.open)) continue;
    const key = `${r.open}-${end}`;
    const days = groups.get(key) ?? [];
    if (!days.includes(r.day)) days.push(r.day);
    groups.set(key, days);
  }
  return [...groups.entries()]
    .map(([key, days]) => {
      const [startTime, endTime] = key.split('-');
      return { weekdays: WEEK_ORDER.filter((d) => days.includes(d)), startTime, endTime };
    })
    .sort((a, b) => hmToMinutes(a.startTime) - hmToMinutes(b.startTime) || ((a.weekdays[0] + 6) % 7) - ((b.weekdays[0] + 6) % 7)); // Monday first
}
