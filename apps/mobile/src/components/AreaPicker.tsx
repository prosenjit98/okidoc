import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { INDIAN_STATES } from '@okidoc/shared';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { api } from '@/lib/api';
import type { AreaRow } from '@/lib/area';
import { useAction, useApi } from '@/lib/hooks';
import { C, R } from '@/lib/theme';
import { Button, Chip, Input, T } from './ui';

const PIN_RE = /^[1-9]\d{5}$/;

/**
 * Clinic area: search the list (name, PIN, district or state). A clinic whose locality is missing adds it — any
 * state in India; the API reuses an existing area with the same name and PIN.
 */
export function AreaPicker({ areaId, pin, onPick }: { areaId?: string; pin?: string; onPick: (a: AreaRow) => void }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [na, setNa] = useState({ name: '', pin: '', district: '', state: '' });
  const results = useApi<AreaRow[]>(['areas', q], `/areas${q ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  const current = useApi<AreaRow[]>(['areas', 'id', areaId ?? ''], areaId ? `/areas?id=${encodeURIComponent(areaId)}` : null);
  const selected = current.data?.[0];
  const add = useAction((body: typeof na) => api<AreaRow>('/areas', { body }), {
    invalidate: [['areas']],
    onSuccess: (a) => {
      onPick(a);
      setAdding(false);
      setQ('');
    },
  });

  const stateOk = (INDIAN_STATES as readonly string[]).includes(na.state);
  const stateMatches = na.state && !stateOk ? INDIAN_STATES.filter((s) => s.toLowerCase().includes(na.state.trim().toLowerCase())).slice(0, 6) : [];
  const canAdd = na.name.trim().length > 1 && PIN_RE.test(na.pin) && na.district.trim().length > 1 && stateOk;

  const startAdding = () => {
    const typed = q.trim();
    setNa({
      name: /^\d+$/.test(typed) ? '' : typed,
      pin: /^\d{6}$/.test(typed) ? typed : (pin ?? ''),
      district: '',
      state: selected?.region.state ?? '',
    });
    setAdding(true);
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <T variant="label" style={{ marginBottom: 6 }}>
        Area
      </T>
      {selected && (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.tealSoft, borderRadius: R.sm, padding: 12, marginBottom: 10 }}>
          <Ionicons name="location" size={18} color={C.tealDark} style={{ marginRight: 8 }} />
          <T style={{ flex: 1, fontWeight: '700' }}>
            {selected.name} · {selected.pin}
            {'\n'}
            <T variant="small">
              {selected.region.district}, {selected.region.state}
            </T>
          </T>
        </View>
      )}

      {!adding && (
        <>
          <Input value={q} onChangeText={setQ} placeholder={selected ? 'Search to change area' : 'Search your area, PIN or district'} style={{ marginBottom: 0 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: -6, marginBottom: 8 }}>
            {results.data?.slice(0, 20).map((a) => (
              <Chip key={a.id} label={`${a.name} · ${a.pin}`} active={areaId === a.id} onPress={() => onPick(a)} />
            ))}
          </ScrollView>
          {!!q.trim() && results.data?.length === 0 && (
            <T variant="muted" style={{ marginBottom: 6 }}>
              No area matches “{q.trim()}”.
            </T>
          )}
          <Pressable onPress={startAdding} hitSlop={8} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
            <Ionicons name="add-circle-outline" size={18} color={C.tealDark} style={{ marginRight: 6 }} />
            <T style={{ color: C.tealDark, fontWeight: '700' }}>Can’t find your area? Add it</T>
          </Pressable>
        </>
      )}

      {adding && (
        <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: 14, backgroundColor: C.white }}>
          <T variant="h3" style={{ marginBottom: 4 }}>
            Add your area
          </T>
          <T variant="muted" style={{ marginBottom: 12 }}>
            Patients will find your clinic under this area.
          </T>
          <Input label="Area / locality" value={na.name} onChangeText={(x) => setNa({ ...na, name: x })} placeholder="e.g. Lake Town" />
          <Input label="PIN code" value={na.pin} onChangeText={(x) => setNa({ ...na, pin: x.replace(/\D/g, '').slice(0, 6) })} keyboardType="number-pad" error={na.pin.length === 6 && !PIN_RE.test(na.pin) ? 'Enter a valid PIN code' : undefined} />
          <Input label="District" value={na.district} onChangeText={(x) => setNa({ ...na, district: x })} placeholder="e.g. North 24 Parganas" />
          <Input label="State" value={na.state} onChangeText={(x) => setNa({ ...na, state: x })} placeholder="Type to choose" hint={stateOk ? undefined : 'Pick your state from the list'} />
          {stateMatches.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -6, marginBottom: 8 }}>
              {stateMatches.map((s) => (
                <Chip key={s} label={s} onPress={() => setNa({ ...na, state: s })} />
              ))}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Cancel" tone="outline" small style={{ flex: 1 }} onPress={() => setAdding(false)} />
            <Button title="Add area" small style={{ flex: 1 }} disabled={!canAdd} loading={add.isPending} onPress={() => add.mutate({ name: na.name.trim(), pin: na.pin, district: na.district.trim(), state: na.state })} />
          </View>
        </View>
      )}
    </View>
  );
}