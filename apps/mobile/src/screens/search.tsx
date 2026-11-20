import { CLINIC_TYPE_LABELS, type ClinicType } from '@okidoc/shared';
import { router, useLocalSearchParams } from '@/lib/nav';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AdSlot } from '@/components/AdSlot';
import { ClinicRow, DoctorRow, specialtyName, type ClinicCardData, type DoctorCardData } from '@/components/common';
import { Chip, Empty, Input, Loading, Screen, Section } from '@/components/ui';
import { useArea } from '@/lib/area';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';

interface SearchResult {
  doctors: DoctorCardData[];
  clinics: ClinicCardData[];
  specialties: { id: string; slug: string; name: string; patientName?: string | null; nameBn?: string | null; nameHi?: string | null }[];
  areas: { id: string; name: string; pin: string; region: { district: string } }[];
}

/** PAT-02 universal search (doctor, speciality, problem, clinic, area, PIN), clinic-type browse, live-now list. */
export default function Search() {
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ q?: string; type?: string; live?: string }>();
  const { areaId, setArea } = useArea();
  const [q, setQ] = useState(params.q ?? '');
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const type = params.type as ClinicType | undefined;
  const search = useApi<SearchResult>(['search', debounced, areaId], debounced.length >= 2 ? `/search?q=${encodeURIComponent(debounced)}${areaId ? `&areaId=${areaId}` : ''}` : null);
  const byType = useApi<ClinicCardData[]>(['clinics-type', type, areaId], type ? `/clinics?type=${type}${areaId ? `&areaId=${areaId}` : ''}` : null);
  const live = useApi<{ liveNow: { instanceId: string; doctor: DoctorCardData; clinic: ClinicCardData; nowServing: number | null }[] }>(
    ['home-live', areaId],
    params.live ? `/discover/home${areaId ? `?areaId=${areaId}` : ''}` : null,
  );

  const title = type ? CLINIC_TYPE_LABELS[type] : params.live ? t('home.liveNow') : t('common.search');

  return (
    <Screen back tabs={false} title={title}>
      {!type && !params.live && <Input value={q} onChangeText={setQ} placeholder={t('home.searchPlaceholder')} autoFocus returnKeyType="search" />}
      {type &&
        (byType.isLoading ? (
          <Loading />
        ) : byType.data?.length ? (
          byType.data.map((c) => <ClinicRow key={c.id} c={c} onPress={() => router.push(`/clinic/${c.id}`)} statusText={c.doctorsToday ? t('home.doctorsToday', { n: c.doctorsToday }) : t('home.viewSchedule')} />)
        ) : (
          <Empty icon="business-outline" title="No clinics of this type nearby yet" />
        ))}
      {!!params.live &&
        (live.isLoading ? (
          <Loading />
        ) : live.data?.liveNow.length ? (
          live.data.liveNow.map((c) => <DoctorRow key={c.instanceId} d={c.doctor} onPress={() => router.push(`/doctor/${c.doctor.id}`)} />)
        ) : (
          <Empty icon="time-outline" title={t('home.liveEmpty')} />
        ))}
      {!type && !params.live && debounced.length >= 2 && (
        <>
          <AdSlot placement="SEARCH_SPONSORED" areaId={areaId} compact />
          {search.isLoading ? (
            <Loading />
          ) : search.data ? (
            <>
              {!!search.data.specialties.length && (
                <Section title="Specialities">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {search.data.specialties.map((s) => (
                      <Chip key={s.id} label={specialtyName(s, lang)} onPress={() => setQ(s.name)} />
                    ))}
                  </ScrollView>
                </Section>
              )}
              {!!search.data.doctors.length && (
                <Section title={t('home.doctors')}>
                  {search.data.doctors.map((d) => (
                    <DoctorRow key={d.id} d={d} onPress={() => router.push(`/doctor/${d.id}`)} />
                  ))}
                </Section>
              )}
              {!!search.data.clinics.length && (
                <Section title={t('home.clinics')}>
                  {search.data.clinics.map((c) => (
                    <ClinicRow key={c.id} c={c} onPress={() => router.push(`/clinic/${c.id}`)} />
                  ))}
                </Section>
              )}
              {!!search.data.areas.length && (
                <Section title="Areas">
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {search.data.areas.map((a) => (
                      <Chip key={a.id} icon="location-outline" label={`${a.name} · ${a.pin}`} onPress={() => setArea({ ...a, region: { id: '', state: 'West Bengal', district: a.region.district } }).then(() => router.back())} />
                    ))}
                  </View>
                </Section>
              )}
              {!search.data.doctors.length && !search.data.clinics.length && !search.data.specialties.length && !search.data.areas.length && (
                <Empty icon="search-outline" title="No results" body="Try a symptom like 'fever', a speciality, a clinic name or a PIN code." />
              )}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
