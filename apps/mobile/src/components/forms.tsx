import { addDays } from '@okidoc/shared';
import { ScrollView, View } from 'react-native';
import { todayIST, WEEKDAYS } from '@/lib/format';
import { Chip, Input, T } from './ui';

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <T variant="label" style={{ marginBottom: 6 }}>
        Days
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {ORDER.map((d) => (
          <Chip key={d} label={WEEKDAYS[d]} active={value.includes(d)} onPress={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])} />
        ))}
        <Chip label="Every day" active={value.length === 7} onPress={() => onChange(value.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6])} />
      </View>
    </View>
  );
}

const PRESETS = ['09:00', '10:00', '11:00', '13:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
export const isHm = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** HH:mm text field with quick presets (no native picker dependency). */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View>
      <Input
        label={label}
        value={value}
        onChangeText={(v) => {
          const d = v.replace(/[^\d]/g, '').slice(0, 4);
          onChange(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d);
        }}
        keyboardType="number-pad"
        placeholder="HH:mm (24-hour)"
        error={value && !isHm(value) ? 'Use 24-hour HH:mm, e.g. 18:30' : undefined}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: -6, marginBottom: 8 }}>
        {PRESETS.map((p) => (
          <Chip key={p} label={p} active={value === p} onPress={() => onChange(p)} />
        ))}
      </ScrollView>
    </View>
  );
}

export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const today = todayIST();
  return (
    <View>
      <Input label={label} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" error={value && !isDate(value) ? 'Use YYYY-MM-DD' : undefined} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -6, marginBottom: 8 }}>
        {[0, 1, 2, 7].map((n) => {
          const d = addDays(today, n);
          return <Chip key={n} label={n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `+${n} days`} active={value === d} onPress={() => onChange(d)} />;
        })}
      </View>
    </View>
  );
}
