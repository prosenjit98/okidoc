import { router, useLocalSearchParams } from '@/lib/nav';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Avatar, Button, Card, Chip, Input, Loading, Row, Screen, Section, Segmented, T, Badge, statusTone } from '@/components/ui';
import { api } from '@/lib/api';
import { useClinic } from '@/lib/clinic';
import { normalizePhone } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface Found {
  id: string;
  name: string;
  degrees?: string | null;
  specialties: string[];
  verification: string;
  photoUrl?: string | null;
}

/** CLN-04 add doctor: search Okidoc doctors or invite by phone, with fee & split. */
export default function AddDoctor() {
  const t = useT();
  const { clinicId, clinic } = useClinic();
  const params = useLocalSearchParams<{ doctorId?: string; name?: string }>();
  const [mode, setMode] = useState<'search' | 'invite'>('search');
  const [q, setQ] = useState(params.name ?? '');
  const [picked, setPicked] = useState<Found | null>(params.doctorId ? { id: params.doctorId, name: params.name ?? 'Doctor', specialties: [], verification: 'APPROVED' } : null);
  const [phone, setPhone] = useState('');
  const [fee, setFee] = useState('300');
  const [split, setSplit] = useState('20');
  const results = useApi<Found[]>(['doctor-search', q], clinicId && mode === 'search' && q.trim().length >= 2 ? `/clinic/${clinicId}/doctors/search?q=${encodeURIComponent(q.trim())}` : null);

  const add = useAction(
    () =>
      api<{ invited?: boolean }>(`/clinic/${clinicId}/doctors`, {
        body: {
          ...(mode === 'search' ? { doctorId: picked!.id } : { invitePhone: normalizePhone(phone) }),
          consultationFee: Math.round(Number(fee || 0) * 100),
          clinicSplitPercent: Number(split || 0),
        },
      }),
    {
      invalidate: [['roster'], ['clinic-info']],
      onSuccess: (r) => {
        Alert.alert(r?.invited ? 'Invitation sent' : 'Request sent', r?.invited ? `We sent an SMS with your clinic code ${clinic?.code}.` : 'The doctor will see your request in their app. Add sittings once they accept.');
        router.back();
      },
    },
  );

  return (
    <Screen back tabs={false} title="Add doctor" subtitle="Doctors must accept before sittings can run">
      <View style={{ marginTop: -8, marginBottom: 12, backgroundColor: C.navy900, borderRadius: 14, padding: 4 }}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'search', label: 'Find on Okidoc' },
            { value: 'invite', label: 'Invite by phone' },
          ]}
        />
      </View>
      {mode === 'search' ? (
        <>
          <Input value={q} onChangeText={setQ} placeholder="Name, registration no. or phone" />
          {results.isLoading && <Loading />}
          {results.data?.map((d) => (
            <Card key={d.id} onPress={() => setPicked(d)} style={picked?.id === d.id ? { borderWidth: 2, borderColor: C.teal } : undefined}>
              <Row gap={12}>
                <Avatar name={d.name} uri={d.photoUrl} />
                <View style={{ flex: 1 }}>
                  <T variant="h3">Dr. {d.name}</T>
                  <T variant="muted">{[d.specialties.join(', '), d.degrees].filter(Boolean).join(' · ')}</T>
                </View>
                <Badge text={d.verification.toLowerCase()} tone={statusTone(d.verification)} />
              </Row>
            </Card>
          ))}
          {results.data && !results.data.length && <T variant="muted">No doctor found — invite them by phone instead.</T>}
        </>
      ) : (
        <Input label="Doctor's mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" hint="If they are not on Okidoc yet we SMS an invite with your clinic code." />
      )}
      <Section title="Fee & split">
        <Input label="Consultation fee (₹)" value={fee} onChangeText={(v) => setFee(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
        <Input label="Clinic's share of the fee (%)" value={split} onChangeText={(v) => setSplit(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" hint="The rest goes to the doctor. Okidoc takes no commission." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {['0', '10', '20', '30'].map((s) => (
            <Chip key={s} label={`${s}%`} active={split === s} onPress={() => setSplit(s)} />
          ))}
        </View>
      </Section>
      <Button
        title={mode === 'search' ? 'Send request' : 'Send invite'}
        disabled={(mode === 'search' ? !picked : !/^[6-9]\d{9}$/.test(normalizePhone(phone))) || Number(split) > 100}
        loading={add.isPending}
        onPress={() => add.mutate()}
      />
    </Screen>
  );
}
