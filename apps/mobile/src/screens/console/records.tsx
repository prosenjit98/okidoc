import { addDays } from '@okidoc/shared';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Bell } from '@/components/common';
import { Badge, Button, Card, Chip, Empty, ErrorView, Input, Loading, Row, Screen, statusTone, T } from '@/components/ui';
import { useClinic } from '@/lib/clinic';
import { openAuthedFile } from '@/lib/files';
import { dateShort, inr, todayIST } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface Row_ {
  date: string;
  sitting: string;
  doctor: string;
  token: number;
  patient: string;
  phone: string;
  source: string;
  status: string;
  paymentMode: string;
  fee: number;
  paid: string;
}

/** CLN-15 visit register with date range, search and CSV export. */
export default function ClinicRecords() {
  const t = useT();
  const { clinicId } = useClinic();
  const [range, setRange] = useState(1);
  const [q, setQ] = useState('');
  const to = todayIST();
  const from = addDays(to, -(range - 1));
  const reg = useApi<{ items: Row_[] }>(['register', clinicId, range, q], clinicId ? `/clinic/${clinicId}/register?from=${from}&to=${to}${q ? `&q=${encodeURIComponent(q)}` : ''}` : null);
  return (
    <Screen
      title={t('more.register')}
      subtitle={`${from} → ${to}`}
      right={
        <Row>
          <Bell />
          <Button small tone="soft" icon="download-outline" title="CSV" onPress={() => openAuthedFile(`/clinic/${clinicId}/register?from=${from}&to=${to}&format=csv`, `okidoc-register-${from}-${to}.csv`, 'text/csv').catch((e) => Alert.alert('Okidoc', String(e?.message ?? e)))} />
        </Row>
      }
      onRefresh={reg.refetch}
      refreshing={reg.isRefetching}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[
          [1, t('common.today')],
          [7, '7 days'],
          [30, '30 days'],
        ].map(([n, l]) => (
          <Chip key={String(n)} label={String(l)} active={range === n} onPress={() => setRange(Number(n))} />
        ))}
      </View>
      <Input value={q} onChangeText={setQ} placeholder="Search patient name or phone" />
      {reg.isLoading ? (
        <Loading />
      ) : reg.error ? (
        <ErrorView error={reg.error} />
      ) : !reg.data?.items.length ? (
        <Empty icon="folder-open-outline" title="No visits in this period" />
      ) : (
        reg.data.items.map((r, i) => (
          <Card key={i}>
            <Row>
              <Text style={{ width: 50, fontSize: 18, fontWeight: '900', color: C.navy900 }}>#{r.token}</Text>
              <View style={{ flex: 1 }}>
                <T variant="h3">{r.patient}</T>
                <T variant="muted">
                  {dateShort(r.date)} · Dr. {r.doctor} · {r.source.toLowerCase().replace('_', '-')}
                  {r.paid ? ` · ${r.paid.toLowerCase().replace('_', ' ')}` : ''}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Badge text={t(`status.${r.status}` as never)} tone={statusTone(r.status)} />
                <Text style={{ color: C.muted, fontSize: 12 }}>{inr(r.fee)}</Text>
              </View>
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
