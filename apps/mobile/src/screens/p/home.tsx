import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { CLINIC_TYPES, CLINIC_TYPE_LABELS } from '@okidoc/shared';
import { router } from '@/lib/nav';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AdSlot } from '@/components/AdSlot';
import { Bell, ClinicRow, DoctorTile, specialtyName, type ClinicCardData, type DoctorCardData } from '@/components/common';
import { Chip, Empty, ErrorView, Loading, Screen, Section, Segmented, T } from '@/components/ui';
import { useArea } from '@/lib/area';
import { t12 } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface RailCard {
  instanceId: string;
  sittingId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  nowServing: number | null;
  waiting: number;
  doctor: DoctorCardData;
  clinic: ClinicCardData;
}
interface HomeData {
  liveNow: RailCard[];
  availableLater: RailCard[];
  clinicsNear: ClinicCardData[];
}
interface Specialty {
  id: string;
  slug: string;
  name: string;
  patientName?: string | null;
  nameBn?: string | null;
  nameHi?: string | null;
  icon?: string | null;
}

const SPECIALTY_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  gynecology: 'female-outline',
  pediatrics: 'happy-outline',
  neurology: 'pulse-outline',
  'general-surgery': 'cut-outline',
  oncology: 'ribbon-outline',
  orthopedics: 'body-outline',
  dermatology: 'hand-left-outline',
  ent: 'ear-outline',
  ophthalmology: 'eye-outline',
  dentistry: 'happy-outline',
  cardiology: 'heart-outline',
  'general-physician': 'medkit-outline',
};
const TYPE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  PHARMACY_CHAMBER: 'medkit-outline',
  WOMENS_CLINIC: 'female-outline',
  CHILD_CLINIC: 'happy-outline',
  DENTAL_CLINIC: 'medical-outline',
  EYE_CLINIC: 'eye-outline',
  BONE_JOINT: 'body-outline',
  CLINIC: 'business-outline',
  POLYCLINIC: 'business-outline',
};

/** PAT-01..06 patient home. */
export default function Home() {
  const { t, lang } = useI18n();
  const { area, areaId } = useArea();
  const [tab, setTab] = useState<'doctors' | 'clinics'>('doctors');
  const [spec, setSpec] = useState<string | null>(null);
  const summary = useApi<{ clinics: number; doctors: number }>(['summary', areaId], `/discover/summary${areaId ? `?areaId=${areaId}` : ''}`);
  const home = useApi<HomeData>(['home', areaId, spec], `/discover/home?${areaId ? `areaId=${areaId}&` : ''}${spec ? `specialty=${spec}` : ''}`, { refetchInterval: 60_000 });
  const specialties = useApi<Specialty[]>(['specialties'], '/specialties');
  const clinics = useApi<ClinicCardData[]>(['clinics', areaId], tab === 'clinics' ? `/clinics${areaId ? `?areaId=${areaId}` : ''}` : null);

  const areaName = area ? (lang === 'bn' && area.nameBn ? area.nameBn : area.name) : t('home.chooseArea');

  return (
    <Screen
      title="Okidoc"
      subtitle={summary.data ? t('home.summary', { clinics: summary.data.clinics, doctors: summary.data.doctors }) : undefined}
      onRefresh={() => {
        home.refetch();
        summary.refetch();
        clinics.refetch();
      }}
      refreshing={home.isRefetching}
      right={
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Pressable onPress={() => router.push('/area')} style={pill}>
            <Ionicons name="location-outline" size={14} color={C.white} />
            <Text style={{ color: C.white, fontWeight: '600', fontSize: 12, maxWidth: 110 }} numberOfLines={1}>
              {areaName}
            </Text>
            <Ionicons name="chevron-down" size={12} color={C.white} />
          </Pressable>
          <Bell />
        </View>
      }
      headerExtra={
        <>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable onPress={() => router.push('/search')} style={searchBox} accessibilityRole="search">
              <Ionicons name="search" size={18} color="#CBD5E1" />
              <Text style={{ color: '#CBD5E1', flex: 1 }} numberOfLines={1}>
                {t('home.searchPlaceholder')}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.push('/scan')} style={qrBtn} accessibilityLabel="Scan clinic QR">
              <Ionicons name="qr-code-outline" size={22} color={C.tealGlow} />
            </Pressable>
          </View>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'doctors', label: t('home.doctors') },
              { value: 'clinics', label: t('home.clinics') },
            ]}
          />
        </>
      }
    >
      <AdSlot placement="HOME_BANNER" areaId={areaId} compact />
      {tab === 'doctors' ? (
        <>
          <Section title={t('home.bySpeciality')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Chip label={t('home.all')} icon="grid-outline" active={!spec} onPress={() => setSpec(null)} />
              {specialties.data?.map((s) => (
                <Chip key={s.id} label={specialtyName(s, lang)} icon={SPECIALTY_ICONS[s.slug] ?? 'medkit-outline'} active={spec === s.slug} onPress={() => setSpec(spec === s.slug ? null : s.slug)} />
              ))}
            </ScrollView>
          </Section>
          {home.isLoading ? (
            <Loading />
          ) : home.error ? (
            <ErrorView error={home.error} onRetry={home.refetch} />
          ) : (
            <>
              <Section title={t('home.liveNow')} action={t('common.seeAll')} onAction={() => router.push('/search?live=1')}>
                {home.data!.liveNow.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {home.data!.liveNow.map((c) => (
                      <DoctorTile
                        key={c.instanceId}
                        d={c.doctor}
                        subtitle={c.clinic.name}
                        footer={c.nowServing ? t('home.nowServing', { n: c.nowServing }) : t('home.waiting', { n: c.waiting })}
                        onPress={() => router.push(`/doctor/${c.doctor.id}`)}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <T variant="muted">{t('home.liveEmpty')}</T>
                )}
              </Section>
              <Section title={t('home.clinicsNear')} action={t('common.seeAll')} onAction={() => setTab('clinics')}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {home.data!.clinicsNear.map((c) => (
                    <View key={c.id} style={{ width: 268, marginRight: 12 }}>
                      <ClinicRow c={c} onPress={() => router.push(`/clinic/${c.id}`)} statusText={c.doctorsToday ? t('home.doctorsToday', { n: c.doctorsToday }) : t('home.viewSchedule')} statusTone={c.doctorsToday ? 'ok' : 'info'} />
                    </View>
                  ))}
                </ScrollView>
              </Section>
              <AdSlot placement="HOME_NATIVE" areaId={areaId} notSameAs="HOME_BANNER" />
              <Section title={t('home.availableLater')}>
                {home.data!.availableLater.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {home.data!.availableLater.map((c) => (
                      <DoctorTile key={c.instanceId} d={c.doctor} subtitle={c.clinic.name} footer={`${t12(c.startTime)} – ${t12(c.endTime)}`} onPress={() => router.push(`/doctor/${c.doctor.id}`)} />
                    ))}
                  </ScrollView>
                ) : (
                  <Empty icon="time-outline" title="No more sittings today" body="Search to see doctors sitting later this week." action={t('common.search')} onAction={() => router.push('/search')} />
                )}
              </Section>
            </>
          )}
        </>
      ) : (
        <>
          <Section title={`${t('home.clinicsNear')} · ${clinics.data?.length ?? 0}`}>
            {clinics.isLoading ? (
              <Loading />
            ) : clinics.data?.length ? (
              clinics.data.map((c) => (
                <ClinicRow key={c.id} c={c} onPress={() => router.push(`/clinic/${c.id}`)} statusText={c.doctorsToday ? t('home.doctorsToday', { n: c.doctorsToday }) : t('home.viewSchedule')} statusTone={c.doctorsToday ? 'ok' : 'info'} />
              ))
            ) : (
              <Empty icon="business-outline" title="No clinics in this area yet" action={t('home.chooseArea')} onAction={() => router.push('/area')} />
            )}
          </Section>
          <Section title={t('home.byClinicType')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {CLINIC_TYPES.filter((x) => x !== 'CLINIC' && x !== 'POLYCLINIC').map((type) => (
                <Pressable key={type} onPress={() => router.push(`/search?type=${type}`)} style={typeTile}>
                  <Ionicons name={TYPE_ICONS[type]} size={22} color={C.tealDark} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: C.navy900, marginTop: 6, textAlign: 'center' }}>{CLINIC_TYPE_LABELS[type]}</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        </>
      )}
    </Screen>
  );
}

const pill = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 };
const searchBox = { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, borderWidth: 1.5, borderColor: 'rgba(94,234,212,0.6)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.06)' };
const qrBtn = { width: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(255,255,255,0.06)' };
const typeTile = { width: '31%' as const, backgroundColor: C.white, borderRadius: 16, padding: 12, alignItems: 'center' as const, elevation: 1 };
