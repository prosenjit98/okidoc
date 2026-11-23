'use client';

import { DAY_SHORT, hoursProblems, MAX_RANGES_PER_DAY, rangesForDay, WEEK_ORDER, weeklyHoursText, type HoursRange } from '@okidoc/shared';
import { Input } from './ui';

const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Default for a newly opened day and for new clinics. */
export const DEFAULT_HOURS: HoursRange[] = [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '09:00', close: '21:00' }));

/** A closing time of 00:00 means "till midnight". */
const toClose = (v: string) => (v === '00:00' ? '24:00' : v);
const fromClose = (v: string) => (v === '24:00' ? '00:00' : v);

/** Problems with the hours, including incomplete times (empty = OK to save). */
export function hoursErrors(hours: HoursRange[]): string[] {
  if (!hours.length) return ['Open at least one day'];
  const bad = hours.filter((r) => !HM.test(r.open) || !(HM.test(r.close) || r.close === '24:00'));
  return bad.length ? ['Fill in every opening and closing time'] : hoursProblems(hours);
}

/**
 * CLN-01a weekly opening hours: each day closed or up to 3 time ranges (e.g. 7–9 AM and 5–8 PM).
 * Patients see a summary and "Open now"; doctor sittings outside these hours get a warning.
 */
export function HoursEditor({ value, onChange }: { value: HoursRange[]; onChange: (v: HoursRange[]) => void }) {
  const others = (day: number) => value.filter((r) => r.day !== day);
  const setDay = (day: number, ranges: Omit<HoursRange, 'day'>[]) => onChange([...others(day), ...ranges.map((r) => ({ ...r, day }))]);
  const errors = hoursErrors(value);
  const summary = errors.length ? '' : weeklyHoursText(value);

  return (
    <div>
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
        {WEEK_ORDER.map((day, idx) => {
          const ranges = rangesForDay(value, day);
          const open = ranges.length > 0;
          const next = WEEK_ORDER[idx + 1];
          return (
            <div key={day} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
              <label className="flex w-36 shrink-0 cursor-pointer items-center gap-2 pt-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-teal-600"
                  checked={open}
                  onChange={(e) => setDay(day, e.target.checked ? [{ open: '09:00', close: '21:00' }] : [])}
                />
                {DAY_FULL[day]}
              </label>
              <div className="min-w-0 flex-1 space-y-2">
                {!open && <p className="pt-2 text-sm text-slate-400">Closed</p>}
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input type="time" className="w-32" value={r.open} aria-label={`${DAY_FULL[day]} opens`} onChange={(e) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} />
                    <span className="text-slate-400">to</span>
                    <Input type="time" className="w-32" value={fromClose(r.close)} aria-label={`${DAY_FULL[day]} closes`} onChange={(e) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, close: toClose(e.target.value) } : x)))} />
                    <button type="button" title="Remove these hours" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setDay(day, ranges.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 pt-1.5 text-xs font-bold">
                {open && ranges.length < MAX_RANGES_PER_DAY && (
                  <button type="button" className="text-teal-700 hover:underline" onClick={() => setDay(day, [...ranges, { open: '17:00', close: '20:00' }])}>
                    + Add hours
                  </button>
                )}
                {next !== undefined && (
                  <button type="button" className="text-slate-500 hover:text-teal-700 hover:underline" onClick={() => setDay(next, ranges)}>
                    Copy to {DAY_SHORT[next]} ↓
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {errors.length > 0 ? (
        <p className="mt-2 text-sm font-semibold text-rose-600">{errors[0]}</p>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          Patients see: <span className="font-semibold text-slate-700">{summary || 'Closed every day'}</span>. A closing time of 12:00 AM means open till midnight.
        </p>
      )}
    </div>
  );
}
