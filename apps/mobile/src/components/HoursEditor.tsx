import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { DAY_SHORT, formatHourShort, hoursProblems, MAX_RANGES_PER_DAY, rangesForDay, WEEK_ORDER, weeklyHoursText, type HoursRange } from '@okidoc/shared';
import { Pressable, Switch, TextInput, View } from 'react-native';
import { C, R } from '@/lib/theme';
import { T } from './ui';

const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Default for new clinics: Mon–Sat 9 AM – 9 PM. */
export const DEFAULT_HOURS: HoursRange[] = [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '09:00', close: '21:00' }));

/** Typed digits → "HH:mm" (24-hour). A closing time of 00:00 or 24:00 means "till midnight". */
const typed = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};
const okOpen = (v: string) => HM.test(v);
const okClose = (v: string) => HM.test(v) || v === '24:00';

/** Problems with the hours, including incomplete times (empty = OK to save). */
export function hoursErrors(hours: HoursRange[]): string[] {
  if (!hours.length) return ['Open at least one day'];
  if (hours.some((r) => !okOpen(r.open) || !okClose(r.close))) return ['Enter every time as 24-hour HH:mm, e.g. 09:00 or 21:30'];
  return hoursProblems(cleanHours(hours));
}
/** Normalise before saving: closing 00:00 = midnight. */
export const cleanHours = (hours: HoursRange[]) => hours.map((r) => ({ ...r, close: r.close === '00:00' ? '24:00' : r.close }));

function TimeBox({ value, onChange, label, close }: { value: string; onChange: (v: string) => void; label: string; close?: boolean }) {
  const bad = value.length === 5 && !(close ? okClose(value) || value === '00:00' : okOpen(value));
  return (
    <View style={{ alignItems: 'center' }}>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(typed(v))}
        keyboardType="number-pad"
        placeholder="HH:mm"
        placeholderTextColor={C.faint}
        accessibilityLabel={label}
        style={{ width: 76, borderWidth: 1, borderColor: bad ? C.bad : C.line, borderRadius: R.sm, paddingVertical: 8, textAlign: 'center', fontSize: 15, fontWeight: '700', color: C.navy900, backgroundColor: C.white }}
      />
      <T variant="small" style={{ marginTop: 2, color: C.muted }}>
        {(close ? okClose(value) || value === '00:00' : okOpen(value)) ? formatHourShort(value === '00:00' && close ? '24:00' : value) : ' '}
      </T>
    </View>
  );
}

/**
 * CLN-01a weekly opening hours: each day closed or up to 3 time ranges (e.g. 7–9 AM and 5–8 PM).
 * Patients see a summary and "Open now"; doctor sittings outside these hours get a warning.
 */
export function HoursEditor({
  value,
  onChange,
  label = 'Opening hours',
  note,
  action,
  onText = 'Open',
  offText = 'Closed',
  emptyText,
}: {
  value: HoursRange[];
  onChange: (v: HoursRange[]) => void;
  label?: string;
  /** Day state words, e.g. "Sitting" / "Off" for a doctor's sitting times. */
  onText?: string;
  offText?: string;
  /** Neutral hint while no day is on (instead of the red "Open at least one day"). */
  emptyText?: string;
  /** Replaces the "Patients see: …" line under the editor. */
  note?: string;
  /** Optional link shown next to the label (e.g. "Same as opening hours"). */
  action?: { title: string; onPress: () => void };
}) {
  const setDay = (day: number, ranges: Omit<HoursRange, 'day'>[]) => onChange([...value.filter((r) => r.day !== day), ...ranges.map((r) => ({ ...r, day }))]);
  const errors = hoursErrors(value);

  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <T variant="label" style={{ flex: 1 }}>
          {label}
        </T>
        {action && (
          <Pressable onPress={action.onPress} hitSlop={6}>
            <T variant="small" style={{ color: C.tealDark, fontWeight: '700' }}>
              {action.title}
            </T>
          </Pressable>
        )}
      </View>
      <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.card, backgroundColor: C.white, overflow: 'hidden' }}>
        {WEEK_ORDER.map((day, idx) => {
          const ranges = rangesForDay(value, day);
          const open = ranges.length > 0;
          const next = WEEK_ORDER[idx + 1];
          return (
            <View key={day} style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: idx ? 1 : 0, borderTopColor: C.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T style={{ flex: 1, fontWeight: '700' }}>{DAY_FULL[day]}</T>
                <T variant="small" style={{ color: open ? C.tealDark : C.muted, marginRight: 6 }}>
                  {open ? onText : offText}
                </T>
                <Switch
                  value={open}
                  onValueChange={(on) => setDay(day, on ? [{ open: '09:00', close: '21:00' }] : [])}
                  trackColor={{ true: C.teal, false: '#CBD5E1' }}
                  thumbColor={C.white}
                  accessibilityLabel={`${DAY_FULL[day]} open`}
                />
              </View>
              {ranges.map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, gap: 8 }}>
                  <TimeBox label={`${DAY_FULL[day]} opens`} value={r.open} onChange={(v) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, open: v } : x)))} />
                  <T style={{ marginTop: 9, color: C.muted }}>to</T>
                  <TimeBox label={`${DAY_FULL[day]} closes`} close value={r.close === '24:00' ? '00:00' : r.close} onChange={(v) => setDay(day, ranges.map((x, j) => (j === i ? { ...x, close: v } : x)))} />
                  <Pressable onPress={() => setDay(day, ranges.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remove these hours" style={{ marginTop: 8, marginLeft: 'auto' }}>
                    <Ionicons name="close-circle-outline" size={22} color={C.muted} />
                  </Pressable>
                </View>
              ))}
              {(open || next !== undefined) && (
                <View style={{ flexDirection: 'row', marginTop: open ? 6 : 2, gap: 16 }}>
                  {open && ranges.length < MAX_RANGES_PER_DAY && (
                    <Pressable onPress={() => setDay(day, [...ranges, { open: '17:00', close: '20:00' }])} hitSlop={6}>
                      <T variant="small" style={{ color: C.tealDark, fontWeight: '700' }}>
                        + Add hours
                      </T>
                    </Pressable>
                  )}
                  {next !== undefined && (
                    <Pressable onPress={() => setDay(next, ranges)} hitSlop={6}>
                      <T variant="small" style={{ color: C.muted, fontWeight: '700' }}>
                        Copy to {DAY_SHORT[next]} ↓
                      </T>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
      {!value.length && emptyText ? (
        <T variant="small" style={{ color: C.muted, marginTop: 6 }}>
          {emptyText}
        </T>
      ) : errors.length ? (
        <T variant="small" style={{ color: C.bad, marginTop: 6, fontWeight: '600' }}>
          {errors[0]}
        </T>
      ) : (
        <T variant="small" style={{ color: C.muted, marginTop: 6 }}>
          {note ?? `Patients see: ${weeklyHoursText(cleanHours(value))}. Use 24-hour time; closing 00:00 = open till midnight.`}
        </T>
      )}
    </View>
  );
}
