import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { router } from '@/lib/nav';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Bell } from '@/components/common';
import { Badge, Button, Card, Chip, ErrorView, Hero, Input, Loading, Row, Screen, Section, Sheet, Stats, T } from '@/components/ui';
import { api } from '@/lib/api';
import { dayLabel, days, inr, t12 } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';
import type { SittingRow } from '@/lib/types';

interface Schedule {
  summary: { chambers: number; sittings: number; daysAWeek: number };
  bookingWindowHours: number | null;
  links: {
    id: string;
    status: string;
    initiatedBy: string;
    consultationFee: number;
    clinic: { id: string; name: string; phone?: string | null; addressLine: string; code: string; area: { name: string } };
    sittings: SittingRow[];
  }[];
  week: { date: string; items: { sittingId: string; clinicName: string; startTime: string; endTime: string }[] }[];
  exceptions: { id: string; fromDate: string; toDate: string; type: string; startTime?: string | null; endTime?: string | null; reason?: string | null }[];
}

const WINDOWS = [
  { h: 24, label: '24 hours' },
  { h: 72, label: '3 days' },
  { h: 168, label: '7 days' },
  { h: 360, label: '15 days' },
];

/** DOC-02..07 My schedule. */
export default function DoctorSchedule() {
  const t = useT();
  const q = useApi<Schedule>(['doctor-schedule'], '/doctor/schedule');
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');
  const [chamber, setChamber] = useState<Schedule['links'][number] | null>(null);
  const setWindow = useAction((h: number) => api('/doctor/settings', { method: 'PATCH', body: { defaultBookingWindowHours: h } }), { invalidate: [['doctor-schedule']] });
  const respond = useAction((v: { id: string; accept: boolean }) => api(`/doctor/links/${v.id}/respond`, { body: { accept: v.accept } }), { invalidate: [['doctor-schedule']] });
  const join = useAction(() => api('/doctor/links/request', { body: { clinicCode: code.trim().toUpperCase() } }), {
    invalidate: [['doctor-schedule']],
    onSuccess: () => {
      setJoinOpen(false);
      setCode('');
    },
  });
  const removeEx = useAction((id: string) => api(`/doctor/exceptions/${id}`, { method: 'DELETE' }), { invalidate: [['doctor-schedule']] });

  const s = q.data;
  const approved = s?.links.filter((l) => l.status === 'APPROVED') ?? [];
  const requests = s?.links.filter((l) => l.status === 'PENDING') ?? [];

  return (
    <Screen title={t('schedule.title')} subtitle={t('schedule.subtitle')} right={<Bell />} onRefresh={q.refetch} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} onRetry={q.refetch} />
      ) : s ? (
        <>
          <Hero eyebrow="My week" title={t('schedule.hero')} hint={t('schedule.heroHint')} />
          <Stats
            items={[
              { label: t('schedule.chambers'), value: s.summary.chambers },
              { label: t('schedule.sittings'), value: s.summary.sittings },
              { label: t('schedule.daysAWeek'), value: s.summary.daysAWeek },
            ]}
          />
          <Button title={t('schedule.addSitting')} icon="add-circle-outline" disabled={!approved.length} onPress={() => router.push('/d/sitting')} />
          {!approved.length && (
            <>
              <T variant="muted" style={{ marginTop: 8 }}>
                Sit at your own chamber, or join a clinic with its clinic code below.
              </T>
              <Button title="Set up my own chamber" icon="business-outline" tone="outline" style={{ marginTop: 8 }} onPress={() => router.push('/d/chamber')} />
            </>
          )}
          {!!requests.length && (
            <Section title={t('schedule.requests')}>
              {requests.map((l) => (
                <Card key={l.id}>
                  <T variant="h3">{l.clinic.name}</T>
                  <T variant="muted">
                    {l.clinic.area.name} · {l.initiatedBy === 'CLINIC' ? `Fee ${inr(l.consultationFee)}` : 'Waiting for the clinic to accept'}
                  </T>
                  {l.initiatedBy === 'CLINIC' && (
                    <Row style={{ marginTop: 10 }}>
                      <Button small title={t('schedule.accept')} onPress={() => respond.mutate({ id: l.id, accept: true })} />
                      <Button small tone="outline" title={t('schedule.decline')} onPress={() => respond.mutate({ id: l.id, accept: false })} />
                    </Row>
                  )}
                </Card>
              ))}
            </Section>
          )}
          <Section title={t('schedule.thisWeek')}>
            <Card style={{ paddingVertical: 6 }}>
              {s.week.map((d, i) => {
                const dt = new Date(`${d.date}T00:00:00+05:30`);
                const isToday = i === 0;
                return (
                  <Row key={d.date} gap={12} style={{ paddingVertical: 10, borderBottomWidth: i < s.week.length - 1 ? 1 : 0, borderBottomColor: C.line, alignItems: 'flex-start' }}>
                    <View
                      style={{ width: 48, borderRadius: 14, paddingVertical: 6, alignItems: 'center', backgroundColor: isToday ? C.teal : d.items.length ? C.tealSoft : '#F1F5F9' }}
                      accessibilityLabel={dayLabel(d.date, t)}
                    >
                      <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6, color: isToday ? C.white : C.muted }}>
                        {dt.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }).toUpperCase()}
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: isToday ? C.white : C.navy900 }}>{dt.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 6, paddingTop: 2 }}>
                      <Text style={{ fontWeight: '800', color: C.navy900, fontSize: 14 }}>{dayLabel(d.date, t)}</Text>
                      {d.items.length ? (
                        d.items.map((it) => (
                          <View key={it.sittingId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10 }}>
                            <Ionicons name="time-outline" size={14} color={C.tealDark} />
                            <Text style={{ color: C.navy900, fontWeight: '700', fontSize: 12.5 }}>
                              {t12(it.startTime)}–{t12(it.endTime)}
                            </Text>
                            <Text style={{ color: C.muted, fontSize: 12.5, flex: 1 }} numberOfLines={1}>
                              {it.clinicName}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={{ color: C.faint, fontSize: 12.5 }}>No sittings</Text>
                      )}
                    </View>
                  </Row>
                );
              })}
            </Card>
          </Section>
          <Section title={t('schedule.chambers')} action={t('schedule.joinClinic')} onAction={() => setJoinOpen(true)}>
            {approved.map((l) => (
              <Card key={l.id} onPress={() => setChamber(l)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T variant="h3">{l.clinic.name}</T>
                  <Text style={{ fontWeight: '800', color: C.tealDark }}>{inr(l.consultationFee)}</Text>
                </Row>
                {l.sittings.map((st) => (
                  <T key={st.id} variant="muted">
                    {days(st.weekdays)} · {t12(st.startTime)}–{t12(st.endTime)}
                    {st.recurrence === 'ALTERNATE_WEEKS' ? ' · alternate weeks' : ''}
                  </T>
                ))}
                {!l.sittings.length && <Badge text={t('roster.sittingNeeded')} tone="warn" />}
              </Card>
            ))}
            {!!approved.length && <Button small tone="ghost" icon="add" title="Set up my own chamber" onPress={() => router.push('/d/chamber')} />}
          </Section>
          <Section title={t('schedule.daysOff')} action={t('schedule.addDayOff')} onAction={() => router.push('/d/dayoff')}>
            {s.exceptions.length ? (
              s.exceptions.map((e) => (
                <Card key={e.id}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <T variant="h3">
                        {e.fromDate === e.toDate ? e.fromDate : `${e.fromDate} → ${e.toDate}`}
                      </T>
                      <T variant="muted">
                        {e.type === 'OFF' ? 'Day off' : `Changed time ${e.startTime}–${e.endTime}`}
                        {e.reason ? ` · ${e.reason}` : ''}
                      </T>
                    </View>
                    <Button small tone="ghost" title={t('common.delete')} onPress={() => removeEx.mutate(e.id)} />
                  </Row>
                </Card>
              ))
            ) : (
              <T variant="muted">No days off planned.</T>
            )}
          </Section>
          <Section title={t('schedule.advanceBooking')}>
            <Card>
              <T variant="muted" style={{ marginBottom: 10 }}>
                {t('schedule.advanceHint')}
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {WINDOWS.map((w) => (
                  <Chip key={w.h} label={w.label} active={(s.bookingWindowHours ?? 168) === w.h} onPress={() => setWindow.mutate(w.h)} />
                ))}
              </View>
            </Card>
          </Section>
        </>
      ) : null}
      <Sheet visible={joinOpen} onClose={() => setJoinOpen(false)} title={t('schedule.joinClinic')}>
        <Input value={code} onChangeText={setCode} placeholder="OK-XXXXX" autoCapitalize="characters" />
        <Button title="Send request" disabled={!/^OK-[A-Z0-9]{5}$/i.test(code.trim())} loading={join.isPending} onPress={() => join.mutate()} />
      </Sheet>
      <Sheet visible={!!chamber} onClose={() => setChamber(null)} title={chamber?.clinic.name ?? ''}>
        {chamber && (
          <>
            <T>{chamber.clinic.addressLine}</T>
            <T variant="muted">
              {chamber.clinic.area.name} · Code {chamber.clinic.code} · Fee {inr(chamber.consultationFee)}
            </T>
            {!!chamber.clinic.phone && <Button small tone="soft" icon="call-outline" title="Call clinic" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => Linking.openURL(`tel:+91${chamber.clinic.phone}`)} />}
            <Section title={t('schedule.sittings')}>
              {chamber.sittings.map((st) => (
                <Card
                  key={st.id}
                  onPress={() => {
                    setChamber(null);
                    router.push(`/d/sitting?id=${st.id}`);
                  }}
                >
                  <T variant="h3">
                    {days(st.weekdays)} · {t12(st.startTime)}–{t12(st.endTime)}
                  </T>
                  <T variant="muted">{st.maxPatients ? `Max ${st.maxPatients} patients` : 'No limit'} · tap to edit</T>
                </Card>
              ))}
            </Section>
            <Button
              title={t('schedule.addSitting')}
              icon="add"
              onPress={() => {
                const id = chamber.id;
                setChamber(null);
                router.push(`/d/sitting?linkId=${id}`);
              }}
            />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
