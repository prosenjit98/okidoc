import { View } from 'react-native';
import { RatingLine, Stars } from '@/components/rating';
import { Card, Empty, ErrorView, Loading, Row, Screen, Section, T } from '@/components/ui';
import { useClinic } from '@/lib/clinic';
import { dateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface ClinicReviews {
  ratingAvg: number | null;
  ratingCount: number;
  breakdown: Record<string, number>;
  reviews: { id: string; clinicRating: number | null; doctorRating: number | null; doctor: string; comment: string | null; by: string; createdAt: string }[];
}

/** PAT-16 (clinic side): the clinic's rating, star breakdown and recent patient reviews. Owner only. */
export default function ClinicReviewsScreen() {
  const t = useT();
  const { clinicId, isOwner } = useClinic();
  const q = useApi<ClinicReviews>(['clinic-reviews', clinicId], clinicId && isOwner ? `/clinic/${clinicId}/reviews` : null);
  const d = q.data;
  const max = d ? Math.max(1, ...Object.values(d.breakdown)) : 1;

  return (
    <Screen back tabs={false} title={t('more.reviews')} subtitle={t('more.reviews.desc')} onRefresh={q.refetch} refreshing={q.isRefetching}>
      {!isOwner ? (
        <Empty icon="lock-closed-outline" title={t('more.reviews')} body="Only the clinic owner can see ratings and reviews." />
      ) : q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} onRetry={q.refetch} />
      ) : d ? (
        <>
          <Card>
            <T variant="label">{t('clinic.rating')}</T>
            <Row style={{ alignItems: 'center', marginTop: 6 }} gap={12}>
              <T variant="h1">{d.ratingAvg ? d.ratingAvg.toFixed(1) : '–'}</T>
              <RatingLine avg={d.ratingAvg} count={d.ratingCount} />
            </Row>
            <View style={{ marginTop: 10, gap: 4 }}>
              {[5, 4, 3, 2, 1].map((n) => (
                <Row key={n} gap={8} style={{ alignItems: 'center' }}>
                  <T variant="small" style={{ width: 22 }}>{n}★</T>
                  <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: C.border }}>
                    <View style={{ width: `${(100 * (d.breakdown[n] ?? 0)) / max}%`, height: 8, borderRadius: 4, backgroundColor: C.warn }} />
                  </View>
                  <T variant="small" style={{ width: 28, textAlign: 'right', color: C.muted }}>{d.breakdown[n] ?? 0}</T>
                </Row>
              ))}
            </View>
          </Card>
          {d.reviews.length ? (
            <Section title={t('clinic.reviews')}>
              {d.reviews.map((r) => (
                <Card key={r.id}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T variant="small" style={{ fontWeight: '700' }}>{r.by}</T>
                    <T variant="small" style={{ color: C.muted }}>{dateTime(r.createdAt)}</T>
                  </Row>
                  {r.clinicRating ? (
                    <Row gap={6} style={{ alignItems: 'center', marginTop: 6 }}>
                      <T variant="small" style={{ width: 70, color: C.muted }}>Clinic</T>
                      <Stars value={r.clinicRating} />
                    </Row>
                  ) : null}
                  {r.doctorRating ? (
                    <Row gap={6} style={{ alignItems: 'center', marginTop: 4 }}>
                      <T variant="small" style={{ width: 70, color: C.muted }} numberOfLines={1}>Dr. {r.doctor.split(' ')[0]}</T>
                      <Stars value={r.doctorRating} />
                    </Row>
                  ) : null}
                  {r.comment ? <T style={{ marginTop: 6 }}>“{r.comment}”</T> : null}
                </Card>
              ))}
            </Section>
          ) : (
            <Empty icon="star-outline" title={t('reviews.empty')} body={t('reviews.emptyHint')} />
          )}
        </>
      ) : null}
    </Screen>
  );
}
