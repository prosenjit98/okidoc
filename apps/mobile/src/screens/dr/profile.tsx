import { router } from '@/lib/nav';
import { AccountMenu } from '@/components/AccountMenu';
import { Bell } from '@/components/common';
import { Badge, Card, ListItem, Row, Screen, Section, T } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { statusTone } from '@/components/ui';

/** DOC-01 / DOC-11 / DOC-12 doctor profile hub. */
export default function DoctorProfileTab() {
  const t = useT();
  const p = useApi<{ verification: string; verificationNote?: string | null; registrationNo?: string | null; degrees?: string | null; specialties: { name: string }[] }>(['doctor-profile'], '/doctor/profile');
  const v = p.data?.verification;
  return (
    <Screen title={t('tab.profile')} right={<Bell />} onRefresh={p.refetch} refreshing={p.isRefetching}>
      <Card onPress={() => router.push('/d/verify')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h3">{v === 'APPROVED' ? t('verify.approved') : v === 'PENDING' ? t('verify.pending') : t('verify.title')}</T>
          {v && <Badge text={v.toLowerCase().replace('_', ' ')} tone={statusTone(v)} />}
        </Row>
        <T variant="muted">
          {[p.data?.degrees, p.data?.specialties.map((s) => s.name).join(', '), p.data?.registrationNo ? `Reg. ${p.data.registrationNo}` : null].filter(Boolean).join(' · ') || t('verify.body')}
        </T>
        {!!p.data?.verificationNote && v !== 'APPROVED' && <T color="#D97706">Okidoc: {p.data.verificationNote}</T>}
      </Card>
      <Section title="Chambers & availability">
        <Card style={{ paddingVertical: 4 }}>
          <ListItem icon="time-outline" title="My free hours" subtitle="Let clinics with an empty chair find you" onPress={() => router.push('/d/freehours')} />
          <ListItem icon="business-outline" title={t('more.openSlots')} subtitle="Clinics looking for a doctor" onPress={() => router.push('/d/openslots')} />
          <ListItem icon="calendar-outline" title={t('schedule.title')} onPress={() => router.push('/dr/schedule')} />
        </Card>
      </Section>
      <Section title={t('tab.account')}>
        <AccountMenu />
      </Section>
    </Screen>
  );
}
