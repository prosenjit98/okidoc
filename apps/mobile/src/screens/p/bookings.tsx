import { router, useLocalSearchParams } from '@/lib/nav';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { PostBookingInterstitial } from '@/components/AdSlot';
import { Bell } from '@/components/common';
import { Badge, Card, Empty, ErrorView, Loading, Row, Screen, Segmented, statusTone, T } from '@/components/ui';
import { dayLabel, t12 } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';
import type { BookingView } from '@/screens/booking/live';

/** PAT-13 bookings. Shows the post-booking interstitial (capped once a day) after a new booking. */
export default function Bookings() {
  const t = useT();
  const { booked } = useLocalSearchParams<{ booked?: string }>();
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const q = useApi<BookingView[]>(['bookings', scope], `/bookings?scope=${scope}`);

  return (
    <Screen
      title={t('tab.bookings')}
      right={<Bell />}
      onRefresh={q.refetch}
      refreshing={q.isRefetching}
      headerExtra={
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'upcoming', label: t('bookings.upcoming') },
            { value: 'past', label: t('bookings.past') },
          ]}
        />
      }
    >
      <PostBookingInterstitial trigger={!!booked} />
      {!!booked && (
        <Card style={{ backgroundColor: C.tealSoft }} onPress={() => router.push(`/booking/${booked}`)}>
          <T variant="h3" color={C.tealDark}>
            {t('book.success')}
          </T>
          <T variant="muted">Tap to follow your live queue ›</T>
        </Card>
      )}
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <Empty icon="ticket-outline" title={t('bookings.empty')} action={t('tab.home')} onAction={() => router.push('/p/home')} />
      ) : (
        q.data.map((b) => (
          <Card key={b.id} onPress={() => router.push(`/booking/${b.id}`)}>
            <Row gap={14}>
              <View style={{ width: 62, height: 62, borderRadius: 16, backgroundColor: C.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, color: C.tealDark, fontWeight: '700' }}>{t('book.token')}</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: C.navy900 }}>#{b.tokenNo}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <T variant="h3" numberOfLines={1}>
                  Dr. {b.doctor.name}
                </T>
                <T variant="muted" numberOfLines={1}>
                  {b.clinic.name}
                </T>
                <T variant="small" style={{ color: C.muted }}>
                  {dayLabel(b.instance.date, t)} · {t12(b.instance.startTime)} · {b.patientName}
                </T>
              </View>
              <Badge text={t(`status.${b.status}` as never)} tone={statusTone(b.status)} />
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
