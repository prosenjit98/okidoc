import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import type { SlotView } from '@okidoc/shared';
import { router, useLocalSearchParams } from '@/lib/nav';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { specialtyName, type DoctorCardData } from '@/components/common';
import { Avatar, Button, Card, ErrorView, Loading, Row, Screen, Stats, T } from '@/components/ui';
import { dayLabel, inr, t12 } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface DoctorDetail extends DoctorCardData {
  about?: string | null;
  council?: string | null;
  registrationNo?: string | null;
  languagesSpoken: string[];
  ratingCount: number;
  chambers: number;
  reviews: { rating: number; comment?: string | null; by: string }[];
}

const SLOT_REASON: Record<string, 'slot.full' | 'slot.closed' | 'slot.tooEarly' | 'slot.cancelled'> = {
  FULL: 'slot.full',
  CUTOFF_PASSED: 'slot.closed',
  CLOSED: 'slot.closed',
  ENDED: 'slot.closed',
  TOO_EARLY: 'slot.tooEarly',
  CANCELLED: 'slot.cancelled',
};

/** PAT-08/09 doctor profile + "this week — tick a slot". */
export default function DoctorPage() {
  const { t, lang } = useI18n();
  const { id, clinicId } = useLocalSearchParams<{ id: string; clinicId?: string }>();
  const doctor = useApi<DoctorDetail>(['doctor', id], `/doctors/${id}`);
  const slots = useApi<SlotView[]>(['slots', id], `/doctors/${id}/slots?days=7`, { refetchInterval: 60_000 });
  const [picked, setPicked] = useState<SlotView | null>(null);
  const [more, setMore] = useState(false);

  const groups = useMemo(() => {
    const list = (slots.data ?? []).filter((s) => !clinicId || s.clinicId === clinicId);
    const m = new Map<string, SlotView[]>();
    for (const s of list) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return [...m.entries()];
  }, [slots.data, clinicId]);

  const d = doctor.data;
  return (
    <Screen
      back
      tabs={false}
      title={d ? `Dr. ${d.name}` : ''}
      subtitle={d ? [d.degrees, d.specialties.map((s) => specialtyName(s, lang)).join(', ')].filter(Boolean).join(' · ').toUpperCase() : undefined}
      right={d ? <Avatar name={d.name} uri={d.photoUrl} size={46} /> : undefined}
      onRefresh={slots.refetch}
      refreshing={slots.isRefetching}
      headerExtra={
        d ? (
          <Pressable onPress={() => setMore(!more)} style={{ marginTop: 8 }}>
            <Text style={{ color: C.tealGlow, fontSize: 13, fontWeight: '600' }}>
              {d.verified ? '✓ ' : ''}
              {t('doctor.readMore')} ›
            </Text>
          </Pressable>
        ) : undefined
      }
    >
      {doctor.isLoading ? (
        <Loading />
      ) : doctor.error ? (
        <ErrorView error={doctor.error} />
      ) : d ? (
        <>
          <Stats
            items={[
              { label: t('doctor.yearsExp'), value: d.experienceYears ?? '—' },
              { label: t('doctor.rating'), value: d.ratingAvg ? `★ ${d.ratingAvg}` : t('doctor.notRated') },
              { label: t('doctor.chambers'), value: d.chambers },
            ]}
          />
          {more && (
            <Card>
              {!!d.about && <T>{d.about}</T>}
              <T variant="muted" style={{ marginTop: 6 }}>
                {d.council} · Reg. {d.registrationNo}
              </T>
              {!!d.languagesSpoken.length && <T variant="muted">Speaks {d.languagesSpoken.join(', ')}</T>}
              {d.reviews.slice(0, 3).map((r, i) => (
                <T key={i} variant="small" style={{ marginTop: 8 }}>
                  {'★'.repeat(r.rating)} {r.comment ? `“${r.comment}” — ${r.by}` : r.by}
                </T>
              ))}
            </Card>
          )}
          <T variant="muted" style={{ marginBottom: 8 }}>
            {t('doctor.weekHint')}
          </T>
          {slots.isLoading ? (
            <Loading />
          ) : !groups.length ? (
            <Card>
              <T variant="muted">{t('doctor.noSlots')}</T>
            </Card>
          ) : (
            groups.map(([date, list]) => (
              <View key={date}>
                <T variant="label" style={{ marginVertical: 8 }}>
                  {dayLabel(date, t).toUpperCase()}
                </T>
                {list.map((s) => {
                  const ok = s.bookable === 'OK';
                  const sel = picked?.sittingId === s.sittingId && picked.date === s.date;
                  return (
                    <Card key={s.sittingId + s.date} onPress={ok ? () => setPicked(sel ? null : s) : undefined} style={[sel && { borderWidth: 2, borderColor: C.teal }, !ok && { opacity: 0.55 }]}>
                      <Row gap={12}>
                        <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={24} color={sel ? C.teal : C.faint} />
                        <View style={{ flex: 1 }}>
                          <T variant="h3">{s.clinicName}</T>
                          <T variant="muted">
                            {t12(s.startTime)} – {t12(s.endTime)} · {s.clinicArea}
                          </T>
                          {!ok && <Text style={{ color: C.warn, fontSize: 12, fontWeight: '700' }}>{SLOT_REASON[s.bookable] ? t(SLOT_REASON[s.bookable]) : s.bookable}</Text>}
                          {ok && s.maxPatients != null && <Text style={{ color: C.muted, fontSize: 12 }}>{s.maxPatients - s.booked} places left</Text>}
                        </View>
                        <Text style={{ fontWeight: '800', color: C.navy900 }}>{inr(s.consultationFee)}</Text>
                      </Row>
                    </Card>
                  );
                })}
              </View>
            ))
          )}
          <Button
            title={t('doctor.bookVisit')}
            icon="calendar-outline"
            disabled={!picked}
            onPress={() => picked && router.push(`/book?sittingId=${picked.sittingId}&date=${picked.date}&doctorId=${id}&clinic=${encodeURIComponent(picked.clinicName)}&time=${picked.startTime}-${picked.endTime}`)}
            style={{ marginTop: 8 }}
          />
        </>
      ) : null}
    </Screen>
  );
}
