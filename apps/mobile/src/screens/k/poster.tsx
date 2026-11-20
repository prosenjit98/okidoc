import { useRef, type ComponentRef } from 'react';
import { Alert, Image, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Button, ErrorView, Loading, Screen } from '@/components/ui';
import { errMessage } from '@/lib/api';
import { useClinic } from '@/lib/clinic';
import { shareImage } from '@/lib/files';
import { dateShort, t12 } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface Poster {
  clinic: { name: string; code: string; address: string; area: string; phone?: string | null };
  date: string;
  doctors: { name: string; specialties: string[]; startTime: string; endTime: string }[];
  url: string;
  qrDataUrl: string;
}

/** CLN-24 Today's doctors poster: shareable card with the clinic QR (WhatsApp / print). */
export default function PosterScreen() {
  const t = useT();
  const { clinicId } = useClinic();
  const q = useApi<Poster>(['poster', clinicId], clinicId ? `/clinic/${clinicId}/poster` : null);
  const card = useRef<ComponentRef<typeof View>>(null);
  const share = async () => {
    try {
      const uri = await captureRef(card.current as never, { format: 'png', quality: 1 });
      await shareImage(uri, t('more.poster'));
    } catch (e) {
      Alert.alert('Okidoc', errMessage(e));
    }
  };
  const p = q.data;
  return (
    <Screen back tabs={false} title={t('more.poster')} subtitle={t('more.poster.desc')}>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} />
      ) : p ? (
        <>
          <View ref={card} collapsable={false} style={{ backgroundColor: C.white, borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
            <View style={{ backgroundColor: C.navy900, padding: 18 }}>
              <Text style={{ color: C.tealGlow, fontWeight: '800', letterSpacing: 1.5, fontSize: 11 }}>● TODAY'S DOCTORS · {dateShort(p.date).toUpperCase()}</Text>
              <Text style={{ color: C.white, fontSize: 22, fontWeight: '900', marginTop: 4 }}>{p.clinic.name}</Text>
              <Text style={{ color: '#CBD5E1', marginTop: 2 }}>
                {p.clinic.address}, {p.clinic.area}
              </Text>
            </View>
            <View style={{ padding: 18 }}>
              {p.doctors.length ? (
                p.doctors.map((d, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: C.navy900, fontSize: 15 }}>Dr. {d.name}</Text>
                      <Text style={{ color: C.muted, fontSize: 12 }}>{d.specialties.join(', ')}</Text>
                    </View>
                    <Text style={{ fontWeight: '700', color: C.tealDark }}>
                      {t12(d.startTime)} – {t12(d.endTime)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: C.muted }}>No doctors sitting today.</Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 }}>
                <Image source={{ uri: p.qrDataUrl }} style={{ width: 120, height: 120 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: C.navy900, fontSize: 16 }}>Scan to book on Okidoc</Text>
                  <Text style={{ color: C.muted, marginTop: 4 }}>Know your queue. Skip the wait.</Text>
                  <Text style={{ color: C.faint, marginTop: 4, fontSize: 12 }}>Clinic code {p.clinic.code}</Text>
                </View>
              </View>
            </View>
          </View>
          <Button title="Share poster" icon="logo-whatsapp" onPress={share} />
        </>
      ) : null}
    </Screen>
  );
}
