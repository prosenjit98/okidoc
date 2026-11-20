import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Chip, Empty, ErrorView, Input, Loading, Row, Screen, Sheet, T, Card } from '@/components/ui';
import { api, fileForm } from '@/lib/api';
import { extOf, openAuthedFile } from '@/lib/files';
import { pickDocument, pickImage, takePhoto } from '@/lib/pickers';
import { todayIST } from '@/lib/format';
import { confirm, useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface RecordRow {
  id: string;
  title: string;
  type: 'PRESCRIPTION' | 'REPORT' | 'IMAGE' | 'OTHER';
  memberId?: string | null;
  doctorName?: string | null;
  recordDate?: string | null;
  mimeType: string;
  size: number;
}
type Picked = { uri: string; name: string; type: string };
const TYPES = ['PRESCRIPTION', 'REPORT', 'IMAGE', 'OTHER'] as const;

/** PAT-14 records. Ad-free screen (MON-02). */
export default function Records() {
  const t = useT();
  const q = useApi<RecordRow[]>(['records'], '/records');
  const family = useApi<{ id: string; name: string }[]>(['family'], '/me/family');
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<Picked | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]>('PRESCRIPTION');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState('');

  const upload = useAction(
    () => api('/records', { form: fileForm(file!, { title, type, memberId, doctorName, recordDate: todayIST() }) }),
    {
      invalidate: [['records']],
      onSuccess: () => {
        setOpen(false);
        setFile(null);
        setTitle('');
        setDoctorName('');
      },
    },
  );
  const remove = useAction((id: string) => api(`/records/${id}`, { method: 'DELETE' }), { invalidate: [['records']] });

  const fromCamera = async () => {
    const f = await takePhoto();
    if (f) setFile(f);
  };
  const fromLibrary = async () => {
    const f = await pickImage();
    if (f) setFile(f);
  };
  const fromFiles = async () => {
    try {
      const f = await pickDocument();
      if (f) setFile(f);
    } catch (e) {
      Alert.alert('Okidoc', String((e as Error)?.message ?? e));
    }
  };

  return (
    <Screen title={t('records.title')} onRefresh={q.refetch} refreshing={q.isRefetching} right={<Button small title={t('records.upload')} icon="cloud-upload-outline" onPress={() => setOpen(true)} />}>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <Empty icon="document-text-outline" title={t('records.title')} body={t('records.empty')} action={t('records.upload')} onAction={() => setOpen(true)} />
      ) : (
        q.data.map((r) => (
          <Card key={r.id} onPress={() => openAuthedFile(`/records/${r.id}/file`, `${r.title}.${extOf(r.mimeType)}`, r.mimeType).catch((e) => Alert.alert('Okidoc', String(e?.message ?? e)))}>
            <Row gap={12}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={r.mimeType === 'application/pdf' ? 'document-outline' : 'image-outline'} size={22} color={C.tealDark} />
              </View>
              <View style={{ flex: 1 }}>
                <T variant="h3" numberOfLines={1}>
                  {r.title}
                </T>
                <T variant="muted">
                  {t(`records.type.${r.type}` as never)} · {r.recordDate ?? ''}
                  {r.memberId ? ` · ${family.data?.find((m) => m.id === r.memberId)?.name ?? ''}` : ''}
                  {r.doctorName ? ` · Dr. ${r.doctorName}` : ''}
                </T>
              </View>
              <Pressable
                hitSlop={10}
                onPress={async () => {
                  if (await confirm(t('common.delete'), r.title, t('common.delete'), true)) remove.mutate(r.id);
                }}
              >
                <Ionicons name="trash-outline" size={20} color={C.bad} />
              </Pressable>
            </Row>
          </Card>
        ))
      )}
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('records.upload')}>
        <Row style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <Button small tone="soft" icon="camera-outline" title={t('records.camera')} onPress={fromCamera} />
          <Button small tone="soft" icon="images-outline" title="Gallery" onPress={fromLibrary} />
          <Button small tone="soft" icon="document-outline" title={t('records.file')} onPress={fromFiles} />
        </Row>
        {file && <T variant="muted" style={{ marginBottom: 10 }}>📎 {file.name}</T>}
        <Input label={t('records.titleField')} value={title} onChangeText={setTitle} placeholder="e.g. Blood test, Dr. Ghosh prescription" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {TYPES.map((x) => (
            <Chip key={x} label={t(`records.type.${x}` as never)} active={type === x} onPress={() => setType(x)} />
          ))}
        </View>
        {!!family.data?.length && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Chip label="Me" active={!memberId} onPress={() => setMemberId(null)} />
            {family.data.map((m) => (
              <Chip key={m.id} label={m.name} active={memberId === m.id} onPress={() => setMemberId(m.id)} />
            ))}
          </View>
        )}
        <Input label="Doctor (optional)" value={doctorName} onChangeText={setDoctorName} />
        <Button title={t('records.upload')} disabled={!file || !title.trim()} loading={upload.isPending} onPress={() => upload.mutate()} />
      </Sheet>
    </Screen>
  );
}
