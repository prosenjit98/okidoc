import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { ClinicForm, type ClinicFormValues } from '@/components/ClinicForm';
import { Badge, Button, Card, Chip, Input, Loading, Screen, Section, statusTone, T } from '@/components/ui';
import { api, errMessage, fileForm } from '@/lib/api';
import { useClinic } from '@/lib/clinic';
import { pickImage } from '@/lib/pickers';
import { useAction } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

/** CLN-18 profile & photos, CLN-20 booking window / cut-off, CLN-19 payout details. */
export default function ClinicProfile() {
  const t = useT();
  const { clinicId, clinic, refetch } = useClinic();
  const [windowH, setWindowH] = useState<number | null>(null);
  const [cutoff, setCutoff] = useState('30');
  const [upi, setUpi] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [rejoin, setRejoin] = useState(2);
  useEffect(() => {
    if (!clinic) return;
    setWindowH(clinic.bookingWindowHours ?? null);
    setCutoff(String(clinic.cutoffMinutes ?? 30));
    setUpi(clinic.payoutUpi ?? '');
    setAccount(clinic.payoutAccount ?? '');
    setIfsc(clinic.payoutIfsc ?? '');
    setRejoin(clinic.lateRejoinAfter ?? 2);
  }, [clinic]);

  const save = useAction((body: object) => api(`/clinic/${clinicId}`, { method: 'PATCH', body }), { invalidate: [['clinic-info']], onSuccess: () => Alert.alert('Saved', 'Clinic profile updated.') });
  const removePhoto = useAction((url: string) => api(`/clinic/${clinicId}/photos?url=${encodeURIComponent(url)}`, { method: 'DELETE' }), { invalidate: [['clinic-info']] });
  const addPhoto = async () => {
    try {
      const f = await pickImage();
      if (!f) return;
      await api(`/clinic/${clinicId}/photos`, { form: fileForm(f) });
      refetch();
    } catch (e) {
      Alert.alert('Okidoc', errMessage(e));
    }
  };

  if (!clinic) return <Screen back tabs={false} title={t('more.profile')}><Loading /></Screen>;
  return (
    <Screen back tabs={false} title={t('more.profile')} subtitle={`${clinic.code} · ${clinic.area.name}`}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T variant="h3">Okidoc verification</T>
          <Badge text={clinic.verification.toLowerCase()} tone={statusTone(clinic.verification)} />
        </View>
        {!!clinic.verificationNote && <T variant="muted">{clinic.verificationNote}</T>}
      </Card>
      <Section title="Photos patients see">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {clinic.photos.map((p) => (
            <View key={p} style={{ marginRight: 10 }}>
              <Image source={{ uri: p }} style={{ width: 140, height: 100, borderRadius: 12 }} />
              <Pressable onPress={() => removePhoto.mutate(p)} style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 2 }}>
                <Ionicons name="close" size={18} color={C.white} />
              </Pressable>
            </View>
          ))}
          {clinic.photos.length < 8 && (
            <Pressable onPress={addPhoto} style={{ width: 140, height: 100, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={28} color={C.teal} />
            </Pressable>
          )}
        </ScrollView>
      </Section>
      <Section title="Details">
        <ClinicForm
          initial={{ ...clinic, type: clinic.type as ClinicFormValues['type'], phone: clinic.phone ?? undefined, about: clinic.about ?? undefined, openingHours: clinic.openingHours ?? undefined }}
          submitLabel={t('common.save')}
          saving={save.isPending}
          onSubmit={(v) => save.mutate(v)}
        />
      </Section>
      <Section title="Online booking window">
        <T variant="muted" style={{ marginBottom: 8 }}>
          Overrides each doctor's own advance-booking limit (BR-03).
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[
            [null, "Doctor's choice"],
            [24, '24 hours'],
            [72, '3 days'],
            [168, '7 days'],
            [360, '15 days'],
          ].map(([h, l]) => (
            <Chip key={String(h)} label={String(l)} active={windowH === h} onPress={() => setWindowH(h as number | null)} />
          ))}
        </View>
        <Input label="Close online booking this many minutes before the sitting ends" value={cutoff} onChangeText={(v) => setCutoff(v.replace(/\D/g, ''))} keyboardType="number-pad" />
        <Button title={t('common.save')} tone="dark" onPress={() => save.mutate({ bookingWindowHours: windowH, cutoffMinutes: Number(cutoff || 0) })} />
      </Section>
      <Section title="Late arrivals">
        <T variant="muted" style={{ marginBottom: 8 }}>
          A patient who missed their turn and then arrives is seen after this many more patients. Recall now still calls them next.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <Chip key={n} label={n === 0 ? 'Right after current' : `After ${n}`} active={rejoin === n} onPress={() => setRejoin(n)} />
          ))}
        </View>
        <Button title={t('common.save')} tone="dark" style={{ marginTop: 8 }} onPress={() => save.mutate({ lateRejoinAfter: rejoin })} />
      </Section>
      <Section title="Payout details">
        <Input label="UPI ID" value={upi} onChangeText={setUpi} autoCapitalize="none" />
        <Input label="Bank account number" value={account} onChangeText={setAccount} keyboardType="number-pad" />
        <Input label="IFSC" value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" />
        <Button title={t('common.save')} tone="dark" onPress={() => save.mutate({ payoutUpi: upi || null, payoutAccount: account || null, payoutIfsc: ifsc || null })} />
      </Section>
    </Screen>
  );
}
