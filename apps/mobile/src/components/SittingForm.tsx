import { sittingsFromHours, type HoursRange } from '@okidoc/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { cleanHours, HoursEditor, hoursErrors } from './HoursEditor';
import { Button, Chip, Input, T } from './ui';
import type { SittingRow } from '@/lib/types';

/** One sitting per distinct time range, as sent to the `/sittings/set` endpoints. */
export interface SittingValues {
  weekdays: number[];
  startTime: string;
  endTime: string;
  recurrence: 'WEEKLY' | 'ALTERNATE_WEEKS';
  maxPatients: number | null;
}

/** A sitting → its rows in the day-by-day editor. */
const toHours = (s?: Partial<SittingRow>): HoursRange[] => (s?.weekdays ?? []).map((day) => ({ day, open: s!.startTime!, close: s!.endTime! }));

/**
 * Shared sitting editor (DOC-03, CLN-06), day by day like the clinic's opening hours: each day off or up to 3 time
 * ranges. Days with the same time range are saved as one sitting; editing a sitting keeps it (and its bookings) for
 * its matching range and adds the others as new sittings.
 */
export function SittingForm({
  initial,
  defaultHours,
  onSave,
  onDelete,
  saving,
}: {
  initial?: Partial<SittingRow>;
  /** Starting times for a new sitting, e.g. the clinic's opening hours. */
  defaultHours?: HoursRange[] | null;
  onSave: (v: SittingValues[]) => void;
  onDelete?: () => void;
  saving?: boolean;
}) {
  const [hours, setHours] = useState<HoursRange[]>(() => (initial?.weekdays?.length ? toHours(initial) : (defaultHours ?? [])));
  const [recurrence, setRecurrence] = useState<'WEEKLY' | 'ALTERNATE_WEEKS'>((initial?.recurrence as 'WEEKLY') ?? 'WEEKLY');
  const [max, setMax] = useState(initial?.maxPatients ? String(initial.maxPatients) : '');
  const groups = hours.length && !hoursErrors(hours).length ? sittingsFromHours(cleanHours(hours)) : [];
  const editing = !!initial?.id;
  return (
    <View>
      <HoursEditor
        label="Sitting times"
        value={hours}
        onChange={setHours}
        onText="Sitting"
        offText="Off"
        emptyText="Turn on the days you sit here and set the times."
        note={
          groups.length > 1
            ? `Saved as ${groups.length} sittings (one per time).${editing ? ' This sitting keeps its bookings.' : ''} Use 24-hour time.`
            : 'Use 24-hour time, e.g. 18:30. Add a second time for a split day.'
        }
      />
      <T variant="label" style={{ marginBottom: 6 }}>
        Repeats
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Every week" active={recurrence === 'WEEKLY'} onPress={() => setRecurrence('WEEKLY')} />
        <Chip label="Alternate weeks" active={recurrence === 'ALTERNATE_WEEKS'} onPress={() => setRecurrence('ALTERNATE_WEEKS')} />
      </View>
      <Input label="Maximum patients (optional)" value={max} onChangeText={(v) => setMax(v.replace(/\D/g, ''))} keyboardType="number-pad" />
      <Button
        title={groups.length > 1 ? `Save ${groups.length} sittings` : 'Save sitting'}
        disabled={!groups.length}
        loading={saving}
        onPress={() => onSave(groups.map((g) => ({ ...g, recurrence, maxPatients: max ? Number(max) : null })))}
      />
      {onDelete && <Button title="Remove sitting" tone="outline" style={{ marginTop: 10 }} onPress={onDelete} />}
    </View>
  );
}
