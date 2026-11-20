import { CLINIC_TYPE_LABELS, CLINIC_TYPES, type ClinicType } from '@okidoc/shared';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useApi } from '@/lib/hooks';
import type { AreaRow } from '@/lib/area';
import { Button, Chip, Input, T } from './ui';

export interface ClinicFormValues {
  name: string;
  type: ClinicType;
  addressLine: string;
  areaId: string;
  pin: string;
  phone?: string;
  about?: string;
  openingHours?: string;
  drugLicenceNo?: string | null;
}

/** Clinic profile form (CLN-01 / CLN-18). */
export function ClinicForm({ initial, onSubmit, saving, submitLabel }: { initial?: Partial<ClinicFormValues>; onSubmit: (v: ClinicFormValues) => void; saving?: boolean; submitLabel: string }) {
  const [v, setV] = useState<Partial<ClinicFormValues>>({ type: 'PHARMACY_CHAMBER', ...initial });
  const [areaQ, setAreaQ] = useState('');
  const areas = useApi<AreaRow[]>(['areas', areaQ], `/areas${areaQ ? `?q=${encodeURIComponent(areaQ)}` : ''}`);
  const set = (k: keyof ClinicFormValues) => (x: string) => setV({ ...v, [k]: x });
  const selectedArea = areas.data?.find((a) => a.id === v.areaId);
  const valid = !!v.name && v.name.length > 1 && !!v.type && !!v.addressLine && v.addressLine.length > 2 && !!v.areaId && /^\d{6}$/.test(v.pin ?? '');
  return (
    <View>
      <Input label="Clinic / pharmacy name" value={v.name ?? ''} onChangeText={set('name')} />
      <T variant="label" style={{ marginBottom: 6 }}>
        Type
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {CLINIC_TYPES.map((tp) => (
          <Chip key={tp} label={CLINIC_TYPE_LABELS[tp]} active={v.type === tp} onPress={() => setV({ ...v, type: tp })} />
        ))}
      </View>
      <Input label="Address" value={v.addressLine ?? ''} onChangeText={set('addressLine')} multiline />
      <Input label="Area" value={areaQ} onChangeText={setAreaQ} placeholder={selectedArea ? `${selectedArea.name} (${selectedArea.region.district})` : 'Search area or PIN'} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: -6, marginBottom: 10 }}>
        {areas.data?.slice(0, 20).map((a) => (
          <Chip key={a.id} label={`${a.name} · ${a.pin}`} active={v.areaId === a.id} onPress={() => setV({ ...v, areaId: a.id, pin: v.pin || a.pin })} />
        ))}
      </ScrollView>
      <Input label="PIN code" value={v.pin ?? ''} onChangeText={(x) => set('pin')(x.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" />
      <Input label="Clinic phone" value={v.phone ?? ''} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Input label="Opening hours" value={v.openingHours ?? ''} onChangeText={set('openingHours')} placeholder="Mon–Sat 9 AM – 9 PM" />
      <Input label="About" value={v.about ?? ''} onChangeText={set('about')} multiline />
      {v.type === 'PHARMACY_CHAMBER' && <Input label="Drug licence number" value={v.drugLicenceNo ?? ''} onChangeText={set('drugLicenceNo')} />}
      <Button
        title={submitLabel}
        disabled={!valid}
        loading={saving}
        onPress={() =>
          onSubmit({
            name: v.name!.trim(),
            type: v.type!,
            addressLine: v.addressLine!.trim(),
            areaId: v.areaId!,
            pin: v.pin!,
            phone: v.phone?.replace(/\D/g, '').slice(-10) || undefined,
            about: v.about || undefined,
            openingHours: v.openingHours || undefined,
            drugLicenceNo: v.drugLicenceNo || null,
          })
        }
      />
    </View>
  );
}
