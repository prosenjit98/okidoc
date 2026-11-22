import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { CLINIC_TYPE_LABELS, weeklyHoursLines, type ClinicType, type HoursRange } from '@okidoc/shared';
import { router, useLocalSearchParams } from '@/lib/nav';
import { Image, Linking, ScrollView, Text, View } from 'react-native';
import { DoctorRow, OpenLine, type DoctorCardData } from '@/components/common';
import { RatingLine, ReviewList } from '@/components/rating';
import { Badge, Button, Card, ErrorView, Loading, Row, Screen, Section, T } from '@/components/ui';
import { inr } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface ClinicDetail {
  id: string;
  code: string;
  name: string;
  type: string;
  photos: string[];
  addressLine: string;
  about?: string | null;
  phone?: string | null;
  openingHours?: string | null;
  weeklyHours?: HoursRange[] | null;
  pin: string;
  lat?: number | null;
  lng?: number | null;
  area: { name: string; region: { district: string } };
  ratingAvg?: number | null;
  ratingCount: number;
  reviews: { rating: number | null; comment?: string | null; by: string }[];
  doctors: (DoctorCardData & { consultationFee: number })[];
  slots: { sittingId: string; date: string; startTime: string; endTime: string; bookable: string }[];
}

/** PAT-07 clinic detail (also opened by deep link okidoc://clinic/OK-XXXXX and QR scan). */
export default function ClinicPage() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isCode = /^OK-/i.test(id ?? '');
  const q = useApi<ClinicDetail>(['clinic', id], id ? (isCode ? `/clinics/by-code/${id.toUpperCase()}` : `/clinics/${id}`) : null);
  const c = q.data;
  const todayCount = c ? new Set(c.slots.filter((s) => s.date === c.slots[0]?.date).map((s) => s.sittingId)).size : 0;

  return (
    <Screen back tabs={false} title={c?.name ?? ''} subtitle={c ? `${c.area.name} · ${c.area.region.district}` : undefined} onRefresh={q.refetch} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} onRetry={q.refetch} />
      ) : c ? (
        <>
          {!!c.photos.length && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {c.photos.map((p) => (
                <Image key={p} source={{ uri: p }} style={{ width: 240, height: 150, borderRadius: 16, marginRight: 10 }} />
              ))}
            </ScrollView>
          )}
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Badge text={CLINIC_TYPE_LABELS[c.type as ClinicType] ?? c.type} tone="info" />
              <Text style={{ color: C.faint, fontSize: 12 }}>{c.code}</Text>
            </Row>
            <View style={{ marginTop: 10 }} accessibilityLabel={t('clinic.rating')}>
              <RatingLine avg={c.ratingAvg} count={c.ratingCount} />
            </View>
            <T style={{ marginTop: 8 }}>{c.addressLine}</T>
            <T variant="muted">PIN {c.pin}</T>
            {c.weeklyHours?.length ? (
              // CLN-01a: open now + the week, days with the same hours grouped.
              <View style={{ marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: '#F6FAFB' }}>
                <Row>
                  <Ionicons name="time-outline" size={16} color={C.muted} />
                  <T variant="label">Opening hours</T>
                </Row>
                <OpenLine hours={c.weeklyHours} size={13} />
                <View style={{ marginTop: 6 }}>
                  {weeklyHoursLines(c.weeklyHours).map((l) => (
                    <Row key={l.days} style={{ justifyContent: 'space-between', paddingVertical: 2 }}>
                      <T variant="small" style={{ fontWeight: '700' }}>
                        {l.days}
                      </T>
                      <T variant="small" style={{ color: l.hours === 'Closed' ? C.muted : C.text, flexShrink: 1, textAlign: 'right', marginLeft: 12 }}>
                        {l.hours}
                      </T>
                    </Row>
                  ))}
                </View>
              </View>
            ) : (
              !!c.openingHours && (
                <Row style={{ marginTop: 8 }}>
                  <Ionicons name="time-outline" size={16} color={C.muted} />
                  <T variant="muted">{c.openingHours}</T>
                </Row>
              )
            )}
            {!!c.about && <T style={{ marginTop: 8 }}>{c.about}</T>}
            <Row style={{ marginTop: 12 }}>
              {!!c.phone && <Button small tone="soft" icon="call-outline" title="Call" onPress={() => Linking.openURL(`tel:+91${c.phone}`)} />}
              <Button
                small
                tone="soft"
                icon="navigate-outline"
                title="Directions"
                onPress={() =>
                  Linking.openURL(c.lat && c.lng ? `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.name} ${c.addressLine}`)}`)
                }
              />
            </Row>
          </Card>
          <Section title={`${t('home.doctors')} · ${c.doctors.length}`}>
            {c.doctors.map((d) => (
              <DoctorRow
                key={d.id}
                d={d}
                onPress={() => router.push(`/doctor/${d.id}?clinicId=${c.id}`)}
                right={<Text style={{ color: C.tealDark, fontWeight: '800' }}>{inr(d.consultationFee)}</Text>}
              />
            ))}
            {!c.doctors.length && <T variant="muted">No doctors listed yet.</T>}
          </Section>
          {todayCount > 0 && <T variant="muted">{t('home.doctorsToday', { n: todayCount })}</T>}
          {c.reviews.length > 0 && (
            <Section title={t('clinic.reviews')}>
              <Card>
                <ReviewList reviews={c.reviews.slice(0, 5)} />
              </Card>
            </Section>
          )}
        </>
      ) : null}
    </Screen>
  );
}