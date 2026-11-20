import { addDays } from '@okidoc/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Bell } from '@/components/common';
import { EarningsView } from '@/components/EarningsView';
import { Chip, ErrorView, Loading, Screen } from '@/components/ui';
import { todayIST } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import type { Earnings } from '@/lib/types';

/** DOC-09 earnings per chamber and per sitting. */
export default function DoctorEarnings() {
  const t = useT();
  const [range, setRange] = useState(30);
  const to = todayIST();
  const from = addDays(to, -(range - 1));
  const q = useApi<Earnings>(['doctor-earnings', range], `/doctor/earnings?from=${from}&to=${to}`);
  return (
    <Screen title={t('tab.earnings')} subtitle={`${from} → ${to}`} right={<Bell />} onRefresh={q.refetch} refreshing={q.isRefetching}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[7, 30, 90].map((d) => (
          <Chip key={d} label={`${d} days`} active={range === d} onPress={() => setRange(d)} />
        ))}
      </View>
      {q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} /> : q.data ? <EarningsView e={q.data} mine="doctor" /> : null}
    </Screen>
  );
}
