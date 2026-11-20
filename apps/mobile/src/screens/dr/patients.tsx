import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Bell } from '@/components/common';
import { Avatar, Card, Chip, Empty, Input, Loading, Row, Screen, T } from '@/components/ui';
import { openAuthedFile } from '@/lib/files';
import { dateShort } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';

interface PatientRow {
  key: string;
  name: string;
  visits: number;
  lastVisit: string;
  lastClinic: string;
  sharedRecords: { id: string; title: string; type: string }[];
  history: { bookingId: string; date: string; clinic: string; note?: string | null }[];
}

/** DOC-10 patients seen, with records they shared at booking. */
export default function DoctorPatients() {
  const t = useT();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const list = useApi<PatientRow[]>(['doctor-patients', q], `/doctor/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  return (
    <Screen title={t('tab.patients')} right={<Bell />} onRefresh={list.refetch} refreshing={list.isRefetching}>
      <Input value={q} onChangeText={setQ} placeholder="Search patient name" />
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.length ? (
        <Empty icon="people-outline" title="No patients yet" body="Patients you have seen through Okidoc appear here." />
      ) : (
        list.data.map((p) => (
          <Card key={p.key} onPress={() => setOpen(open === p.key ? null : p.key)}>
            <Row gap={12}>
              <Avatar name={p.name} />
              <View style={{ flex: 1 }}>
                <T variant="h3">{p.name}</T>
                <T variant="muted">
                  {p.visits} visit{p.visits > 1 ? 's' : ''} · last {dateShort(p.lastVisit)} · {p.lastClinic}
                </T>
              </View>
            </Row>
            {open === p.key && (
              <View style={{ marginTop: 10 }}>
                {p.history.slice(0, 8).map((h) => (
                  <T key={h.bookingId} variant="small">
                    {dateShort(h.date)} · {h.clinic}
                    {h.note ? ` — ${h.note}` : ''}
                  </T>
                ))}
                {!!p.sharedRecords.length && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                    {p.sharedRecords.map((r) => (
                      <Chip key={r.id} icon="document-outline" label={r.title} onPress={() => openAuthedFile(`/records/${r.id}/file`, r.title).catch((e) => Alert.alert('Okidoc', String(e?.message ?? e)))} />
                    ))}
                  </View>
                )}
              </View>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}
