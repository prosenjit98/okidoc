import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Avatar, Badge, Button, Card, Chip, Input, Loading, Row, Screen, Section, statusTone, T } from '@/components/ui';
import { api, errMessage, fileForm } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { pickDocument, pickImage } from '@/lib/pickers';
import { useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';

interface DoctorProfile {
  registrationNo?: string | null;
  council?: string | null;
  degrees?: string | null;
  experienceYears?: number | null;
  about?: string | null;
  languagesSpoken: string[];
  photoUrl?: string | null;
  verification: string;
  verificationNote?: string | null;
  specialties: { id: string; name: string }[];
  documents: { id: string; kind: string; createdAt: string }[];
}

/** DOC-01 verification: registration details, specialties, certificate upload, submit. */
export default function Verify() {
  const t = useT();
  const { user } = useAuth();
  const p = useApi<DoctorProfile>(['doctor-profile'], '/doctor/profile');
  const specs = useApi<{ id: string; name: string }[]>(['specialties'], '/specialties');
  const [f, setF] = useState({ registrationNo: '', council: 'West Bengal Medical Council', degrees: '', experienceYears: '', about: '', languages: 'Bengali, English' });
  const [specialtyIds, setSpecialtyIds] = useState<string[]>([]);
  useEffect(() => {
    if (!p.data) return;
    setF({
      registrationNo: p.data.registrationNo ?? '',
      council: p.data.council ?? 'West Bengal Medical Council',
      degrees: p.data.degrees ?? '',
      experienceYears: p.data.experienceYears != null ? String(p.data.experienceYears) : '',
      about: p.data.about ?? '',
      languages: p.data.languagesSpoken.join(', ') || 'Bengali, English',
    });
    setSpecialtyIds(p.data.specialties.map((s) => s.id));
  }, [p.data]);

  const save = useAction(
    () =>
      api('/doctor/profile', {
        method: 'PATCH',
        body: {
          registrationNo: f.registrationNo || undefined,
          council: f.council || undefined,
          degrees: f.degrees || undefined,
          experienceYears: f.experienceYears ? Number(f.experienceYears) : undefined,
          about: f.about || undefined,
          languagesSpoken: f.languages.split(',').map((s) => s.trim()).filter(Boolean),
          specialtyIds,
        },
      }),
    { invalidate: [['doctor-profile']] },
  );
  const submit = useAction(() => api('/doctor/verification/submit', { body: {} }), {
    invalidate: [['doctor-profile']],
    onSuccess: () => Alert.alert(t('verify.title'), 'Submitted. Okidoc will review your registration shortly.'),
  });

  const uploadDoc = async (kind: string) => {
    try {
      const f = await pickDocument();
      if (!f) return;
      await api('/doctor/documents', { form: fileForm(f, { kind }) });
      p.refetch();
    } catch (e) {
      Alert.alert('Okidoc', errMessage(e));
    }
  };
  const uploadPhoto = async () => {
    try {
      const f = await pickImage();
      if (!f) return;
      await api('/doctor/photo', { form: fileForm(f) });
      p.refetch();
    } catch (e) {
      Alert.alert('Okidoc', errMessage(e));
    }
  };

  if (p.isLoading) return <Screen back tabs={false} title={t('verify.title')}><Loading /></Screen>;
  const d = p.data!;
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  return (
    <Screen back tabs={false} title={t('verify.title')} subtitle={t('verify.body')}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={12}>
            <Avatar name={user?.name ?? ''} uri={d.photoUrl} size={56} />
            <Button small tone="soft" title="Change photo" onPress={uploadPhoto} />
          </Row>
          <Badge text={d.verification.toLowerCase().replace('_', ' ')} tone={statusTone(d.verification)} />
        </Row>
        {!!d.verificationNote && <T style={{ marginTop: 8 }} color="#D97706">{d.verificationNote}</T>}
      </Card>
      <Input label="Registration number" value={f.registrationNo} onChangeText={set('registrationNo')} autoCapitalize="characters" />
      <Input label="Medical council" value={f.council} onChangeText={set('council')} />
      <Input label="Degrees" value={f.degrees} onChangeText={set('degrees')} placeholder="MBBS, MD (Medicine)" />
      <Input label="Years of experience" value={f.experienceYears} onChangeText={(v) => set('experienceYears')(v.replace(/\D/g, ''))} keyboardType="number-pad" />
      <Input label="About you (shown to patients)" value={f.about} onChangeText={set('about')} multiline />
      <Input label="Languages spoken" value={f.languages} onChangeText={set('languages')} hint="Comma separated" />
      <Section title="Specialities (up to 5)">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {specs.data?.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              active={specialtyIds.includes(s.id)}
              onPress={() => setSpecialtyIds(specialtyIds.includes(s.id) ? specialtyIds.filter((x) => x !== s.id) : specialtyIds.length < 5 ? [...specialtyIds, s.id] : specialtyIds)}
            />
          ))}
        </View>
      </Section>
      <Button title={t('common.save')} tone="dark" loading={save.isPending} onPress={() => save.mutate()} />
      <Section title="Documents">
        {d.documents.map((doc) => (
          <T key={doc.id} variant="muted">
            ✓ {doc.kind.toLowerCase()} uploaded
          </T>
        ))}
        <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
          <Button small tone="soft" icon="cloud-upload-outline" title="Registration certificate" onPress={() => uploadDoc('REGISTRATION')} />
          <Button small tone="soft" icon="cloud-upload-outline" title="Degree" onPress={() => uploadDoc('DEGREE')} />
        </Row>
      </Section>
      {d.verification !== 'APPROVED' && d.verification !== 'PENDING' && (
        <Button
          title={t('verify.submit')}
          style={{ marginTop: 16 }}
          loading={submit.isPending}
          onPress={async () => {
            await save.mutateAsync().catch(() => undefined);
            submit.mutate();
          }}
        />
      )}
    </Screen>
  );
}
