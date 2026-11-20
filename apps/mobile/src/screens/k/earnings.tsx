import { addDays } from '@okidoc/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { EarningsView } from '@/components/EarningsView';
import { Chip, ErrorView, Loading, Screen } from '@/components/ui';
import { useClinic } from '@/lib/clinic';
import { todayIST } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import type { Earnings } from '@/lib/types';

/** CLN-17 earnings & history. */
export default function ClinicEarnings() {
  const t = useT();
  const { clinicId } = useClinic();
  const [range, setRange] = useState(30);
  const to = todayIST();
  const from = addDays(to, -(range - 1));
  const q = useApi<Earnings>(['clinic-earnings', clinicId, range], clinicId ? `/clinic/${clinicId}/earnings?from=${from}&to=${to}` : null);
  return (
    <Screen back tabs={false} title={t('more.earnings')} subtitle={`${from} → ${to}`}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[7, 30, 90].map((d) => (
          <Chip key={d} label={`${d} days`} active={range === d} onPress={() => setRange(d)} />
        ))}
      </View>
      {q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} /> : q.data ? <EarningsView e={q.data} mine="clinic" /> : null}
    </Screen>
  );
}
