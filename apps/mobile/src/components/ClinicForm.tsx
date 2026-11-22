import { CLINIC_TYPE_LABELS, CLINIC_TYPES, type ClinicType, type HoursRange } from '@okidoc/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { AreaPicker } from './AreaPicker';
import { cleanHours, DEFAULT_HOURS, HoursEditor, hoursErrors } from './HoursEditor';
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
  /** CLN-01a structured hours; null = the clinic still uses the old free-text hours. */
  weeklyHours?: HoursRange[] | null;
  drugLicenceNo?: string | null;
}

/** Clinic profile form (CLN-01 / CLN-18). */
export function ClinicForm({ initial, onSubmit, saving, submitLabel }: { initial?: Partial<ClinicFormValues>; onSubmit: (v: ClinicFormValues) => void; saving?: boolean; submitLabel: string }) {
  // New clinics start with Mon–Sat 9–9; existing clinics without structured hours keep their text until they switch.
  const [v, setV] = useState<Partial<ClinicFormValues>>({ type: 'PHARMACY_CHAMBER', ...initial, weeklyHours: initial ? (initial.weeklyHours ?? null) : DEFAULT_HOURS });
  const set = (k: keyof ClinicFormValues) => (x: string) => setV({ ...v, [k]: x });
  const valid = !!v.name && v.name.length > 1 && !!v.type && !!v.addressLine && v.addressLine.length > 2 && !!v.areaId && /^\d{6}$/.test(v.pin ?? '') && !(v.weeklyHours && hoursErrors(v.weeklyHours).length);
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
      <AreaPicker areaId={v.areaId} pin={v.pin} onPick={(a) => setV((cur) => ({ ...cur, areaId: a.id, pin: a.pin }))} />
      <Input label="PIN code" value={v.pin ?? ''} onChangeText={(x) => set('pin')(x.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" />
      <Input label="Clinic phone" value={v.phone ?? ''} onChangeText={set('phone')} keyboardType="phone-pad" />
      {v.weeklyHours ? (
        <HoursEditor value={v.weeklyHours} onChange={(weeklyHours) => setV((cur) => ({ ...cur, weeklyHours }))} />
      ) : (
        <View style={{ marginBottom: 14 }}>
          <Input
            label="Opening hours"
            value={v.openingHours ?? ''}
            onChangeText={set('openingHours')}
            placeholder="Mon–Sat 9 AM – 9 PM"
            hint="Set day-by-day hours so patients see “Open now”."
            style={{ marginBottom: 0 }}
          />
          <Button title="Set day-by-day hours" tone="soft" small icon="time-outline" onPress={() => setV((cur) => ({ ...cur, weeklyHours: DEFAULT_HOURS }))} />
        </View>
      )}
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
            ...(v.weeklyHours ? { weeklyHours: cleanHours(v.weeklyHours) } : { openingHours: v.openingHours || undefined }),
            drugLicenceNo: v.drugLicenceNo || null,
          })
        }
      />
    </View>
  );
}