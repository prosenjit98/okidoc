import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { router } from '@/lib/nav';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Input, Loading, Screen, T } from '@/components/ui';
import { useArea, type AreaRow } from '@/lib/area';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { C } from '@/lib/theme';

/** PAT-01 area picker: by name, Bengali name, PIN or district. */
export default function AreaPicker() {
  const { t, lang } = useI18n();
  const { areaId, setArea } = useArea();
  const [q, setQ] = useState('');
  const areas = useApi<AreaRow[]>(['areas', q], `/areas${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  const grouped = useMemo(() => {
    const m = new Map<string, AreaRow[]>();
    for (const a of areas.data ?? []) m.set(a.region.district, [...(m.get(a.region.district) ?? []), a]);
    return [...m.entries()];
  }, [areas.data]);

  return (
    <Screen back tabs={false} title={t('home.chooseArea')} subtitle="West Bengal">
      <Input value={q} onChangeText={setQ} placeholder="Area, PIN code or district" autoFocus />
      {areas.isLoading ? (
        <Loading />
      ) : (
        grouped.map(([district, list]) => (
          <View key={district} style={{ marginBottom: 10 }}>
            <T variant="label" style={{ marginBottom: 6 }}>
              {district}
            </T>
            <Card style={{ paddingVertical: 4 }}>
              {list.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={async () => {
                    await setArea(a);
                    router.back();
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: C.navy900 }}>{lang === 'bn' && a.nameBn ? a.nameBn : a.name}</Text>
                    <Text style={{ color: C.muted, fontSize: 12 }}>PIN {a.pin}</Text>
                  </View>
                  {areaId === a.id && <Ionicons name="checkmark-circle" size={22} color={C.teal} />}
                </Pressable>
              ))}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}
