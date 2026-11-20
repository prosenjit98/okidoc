import { useState } from 'react';
import { View } from 'react-native';
import { isHm, TimeField, WeekdayPicker } from './forms';
import { Button, Chip, Input, T } from './ui';
import type { SittingRow } from '@/lib/types';

export interface SittingValues {
  weekdays: number[];
  startTime: string;
  endTime: string;
  recurrence: 'WEEKLY' | 'ALTERNATE_WEEKS';
  maxPatients: number | null;
}

/** Shared sitting editor (DOC-03, CLN-06). */
export function SittingForm({
  initial,
  onSave,
  onDelete,
  saving,
}: {
  initial?: Partial<SittingRow>;
  onSave: (v: SittingValues) => void;
  onDelete?: () => void;
  saving?: boolean;
}) {
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? []);
  const [startTime, setStart] = useState(initial?.startTime ?? '');
  const [endTime, setEnd] = useState(initial?.endTime ?? '');
  const [recurrence, setRecurrence] = useState<'WEEKLY' | 'ALTERNATE_WEEKS'>((initial?.recurrence as 'WEEKLY') ?? 'WEEKLY');
  const [max, setMax] = useState(initial?.maxPatients ? String(initial.maxPatients) : '');
  const valid = weekdays.length > 0 && isHm(startTime) && isHm(endTime) && endTime > startTime;
  return (
    <View>
      <WeekdayPicker value={weekdays} onChange={setWeekdays} />
      <TimeField label="Start" value={startTime} onChange={setStart} />
      <TimeField label="End" value={endTime} onChange={setEnd} />
      {isHm(startTime) && isHm(endTime) && endTime <= startTime && <T color="#DC2626">End must be after start</T>}
      <T variant="label" style={{ marginBottom: 6 }}>
        Repeats
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Every week" active={recurrence === 'WEEKLY'} onPress={() => setRecurrence('WEEKLY')} />
        <Chip label="Alternate weeks" active={recurrence === 'ALTERNATE_WEEKS'} onPress={() => setRecurrence('ALTERNATE_WEEKS')} />
      </View>
      <Input label="Maximum patients (optional)" value={max} onChangeText={(v) => setMax(v.replace(/\D/g, ''))} keyboardType="number-pad" />
      <Button title="Save sitting" disabled={!valid} loading={saving} onPress={() => onSave({ weekdays, startTime, endTime, recurrence, maxPatients: max ? Number(max) : null })} />
      {onDelete && <Button title="Remove sitting" tone="outline" style={{ marginTop: 10 }} onPress={onDelete} />}
    </View>
  );
}
