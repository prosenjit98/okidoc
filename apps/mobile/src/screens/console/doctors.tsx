import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { router } from '@/lib/nav';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Bell } from '@/components/common';
import { Avatar, Badge, Button, Card, Empty, ErrorView, Hero, Input, Loading, Row, Screen, Section, Stats, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useClinic } from '@/lib/clinic';
import { days, inr, t12 } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { useRoom } from '@/lib/socket';
import { C } from '@/lib/theme';
import type { SittingRow } from '@/lib/types';

export interface RosterLink {
  linkId: string;
  status: string;
  initiatedBy: string;
  declineReason?: string | null;
  consultationFee: number;
  clinicSplitPercent: number;
  walkInEvery?: number | null;
  avgConsultMinutes?: number | null;
  doctor: { id: string; name: string; degrees?: string | null; specialties: string[]; verification: string; photoUrl?: string | null };
  sittings: SittingRow[];
}
export interface Roster {
  summary: { doctors: number; scheduled: number; activeDays: number };
  requests: RosterLink[];
  doctors: RosterLink[];
}

/** CLN-03..07 Doctors & sittings roster. */
export default function ClinicDoctors() {
  const t = useT();
  const { clinicId, clinic } = useClinic();
  const [q, setQ] = useState('');
  const roster = useApi<Roster>(['roster', clinicId, q], clinicId ? `/clinic/${clinicId}/doctors${q ? `?q=${encodeURIComponent(q)}` : ''}` : null);
  useRoom(clinicId ? `clinic:${clinicId}` : null, ['roster:changed'], () => roster.refetch());
  const respond = useAction((v: { linkId: string; accept: boolean }) => api(`/clinic/${clinicId}/links/${v.linkId}/respond`, { body: { accept: v.accept } }), { invalidate: [['roster'], ['clinic-info']] });
  const r = roster.data;

  return (
    <Screen
      title={t('roster.title')}
      subtitle={clinic ? `${clinic.name} · ${clinic.code}` : undefined}
      right={
        <Row>
          <Bell />
          <Button small tone="soft" icon="person-add-outline" title={t('common.add')} onPress={() => router.push('/k/add-doctor')} />
        </Row>
      }
      onRefresh={roster.refetch}
      refreshing={roster.isRefetching}
    >
      <Hero eyebrow="Chamber roster" title={t('roster.hero')} hint={t('roster.heroHint')} />
      {roster.isLoading ? (
        <Loading />
      ) : roster.error ? (
        <ErrorView error={roster.error} onRetry={roster.refetch} />
      ) : r ? (
        <>
          <Stats
            items={[
              { label: t('roster.doctors'), value: r.summary.doctors },
              { label: t('roster.scheduled'), value: r.summary.scheduled },
              { label: t('roster.activeDays'), value: r.summary.activeDays },
            ]}
          />
          {!!r.requests.length && (
            <Section title={`${t('roster.requests')} · ${r.requests.length}`}>
              {r.requests.map((l) => (
                <Card key={l.linkId} style={{ backgroundColor: l.status === 'DECLINED' ? C.badSoft : C.warnSoft }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T variant="h3">Dr. {l.doctor.name}</T>
                    <Badge text={l.status === 'DECLINED' ? t('roster.declined') : t('roster.pending')} tone={l.status === 'DECLINED' ? 'bad' : 'warn'} />
                  </Row>
                  <T variant="muted">
                    {l.status === 'DECLINED'
                      ? `This connection was declined, so no queue can run here.${l.declineReason ? ` ${l.declineReason}` : ''} Send a new request if it was a mistake.`
                      : l.initiatedBy === 'DOCTOR'
                        ? 'The doctor asked to sit at your clinic.'
                        : 'Waiting for the doctor to accept.'}
                  </T>
                  {l.status === 'PENDING' && l.initiatedBy === 'DOCTOR' && (
                    <Row style={{ marginTop: 10 }}>
                      <Button small title="Accept" onPress={() => respond.mutate({ linkId: l.linkId, accept: true })} />
                      <Button small tone="outline" title="Decline" onPress={() => respond.mutate({ linkId: l.linkId, accept: false })} />
                    </Row>
                  )}
                </Card>
              ))}
            </Section>
          )}
          <Input value={q} onChangeText={setQ} placeholder={t('roster.search')} />
          {!r.doctors.length && !q ? (
            <Empty icon="people-outline" title={t('roster.empty')} body={t('roster.emptyBody')} action={t('roster.addFirst')} onAction={() => router.push('/k/add-doctor')} />
          ) : (
            <Section title={`${t('roster.yourDoctors')} · ${r.doctors.length}`}>
              {r.doctors.map((l) => (
                <Card key={l.linkId} onPress={() => router.push(`/k/link/${l.linkId}`)}>
                  <Row gap={12}>
                    <Avatar name={l.doctor.name} uri={l.doctor.photoUrl} square />
                    <View style={{ flex: 1 }}>
                      <Row gap={6}>
                        <T variant="h3" numberOfLines={1}>
                          Dr. {l.doctor.name}
                        </T>
                        {l.doctor.verification === 'APPROVED' && <Ionicons name="checkmark-circle" size={16} color={C.teal} />}
                      </Row>
                      <T variant="muted" numberOfLines={1}>
                        {[l.doctor.specialties.join(', '), l.doctor.degrees].filter(Boolean).join(' · ')}
                      </T>
                      <Text style={{ fontSize: 12, fontWeight: '700', marginTop: 2, color: l.doctor.verification === 'APPROVED' ? C.ok : C.bad }}>
                        ● {l.doctor.verification === 'APPROVED' ? t('roster.approved') : t('roster.notApproved')} ·{' '}
                        {l.sittings.length ? `${l.sittings.length} sittings` : t('roster.sittingNeeded')}
                      </Text>
                      {l.sittings.slice(0, 2).map((s) => (
                        <T key={s.id} variant="small" style={{ color: C.muted }}>
                          {days(s.weekdays)} · {t12(s.startTime)}–{t12(s.endTime)}
                        </T>
                      ))}
                    </View>
                    <Text style={{ fontWeight: '800', color: C.tealDark }}>{inr(l.consultationFee)}</Text>
                  </Row>
                </Card>
              ))}
            </Section>
          )}
          <Row style={{ marginTop: 6 }}>
            <Ionicons name="flash-outline" size={14} color={C.tealDark} />
            <T variant="muted" style={{ flex: 1 }}>
              {t('roster.syncNote')}
            </T>
          </Row>
        </>
      ) : null}
    </Screen>
  );
}
