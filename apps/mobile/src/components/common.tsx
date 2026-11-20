import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { router } from '@/lib/nav';
import { Image, Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useUserEvents } from '@/lib/socket';
import { useAuth } from '@/lib/auth';
import { C } from '@/lib/theme';
import { Avatar, Badge, Card, Row, T } from './ui';

/** Floating notification bell with unread count (PAT-17). */
export function Bell() {
  const { status } = useAuth();
  const qc = useQueryClient();
  const q = useApi<{ unread: number }>(['notifications'], status === 'signedIn' ? '/notifications' : null, { refetchInterval: 60_000 });
  useUserEvents(status === 'signedIn', () => qc.invalidateQueries({ queryKey: ['notifications'] }));
  const unread = q.data?.unread ?? 0;
  return (
    <Pressable onPress={() => router.push('/notifications')} style={bellStyle} accessibilityLabel="Notifications" hitSlop={6}>
      <Ionicons name="notifications-outline" size={20} color={C.white} />
      {unread > 0 && (
        <View style={{ position: 'absolute', top: -2, right: -2, backgroundColor: C.bad, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: C.white, fontSize: 10, fontWeight: '800' }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}
const bellStyle = { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center' as const, justifyContent: 'center' as const };

/** Floating pill bottom tab bar (screenshots). */
export function tabOptions(icon: React.ComponentProps<typeof Ionicons>['name'], title: string) {
  return {
    title,
    tabBarIcon: ({ color, focused }: { color: import('react-native').ColorValue; focused: boolean }) => (
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 30,
          borderRadius: 15,
          backgroundColor: focused ? C.teal : 'transparent',
          ...(focused ? { shadowColor: C.teal, shadowOpacity: 0.6, shadowRadius: 10, elevation: 4 } : null),
        }}
      >
        <Ionicons name={(focused ? String(icon).replace(/-outline$/, '') : icon) as typeof icon} size={19} color={color as string} />
      </View>
    ),
  };
}

export const tabBarScreenOptions = {
  headerShown: false,
  tabBarHideOnKeyboard: true,
  tabBarActiveTintColor: C.white,
  tabBarInactiveTintColor: '#8FA9B2',
  tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700' as const, marginTop: 2 },
  tabBarStyle: {
    position: 'absolute' as const,
    bottom: 16,
    marginHorizontal: 14,
    height: 70,
    paddingTop: 9,
    paddingBottom: 9,
    borderRadius: 26,
    backgroundColor: C.navy950,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    elevation: 14,
    shadowColor: '#071D29',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
};

export interface DoctorCardData {
  id: string;
  name: string;
  photoUrl?: string | null;
  degrees?: string | null;
  experienceYears?: number | null;
  specialties: { name: string; patientName?: string | null; nameBn?: string | null; nameHi?: string | null }[];
  ratingAvg?: number | null;
  verified?: boolean;
}

export function specialtyName(s: { name: string; patientName?: string | null; nameBn?: string | null; nameHi?: string | null }, lang: string) {
  return lang === 'bn' ? s.nameBn ?? s.patientName ?? s.name : lang === 'hi' ? s.nameHi ?? s.patientName ?? s.name : s.patientName ?? s.name;
}

export function DoctorTile({ d, subtitle, footer, onPress, width = 170 }: { d: DoctorCardData; subtitle?: string; footer?: string; onPress?: () => void; width?: number }) {
  const { lang } = useI18n();
  return (
    <Card onPress={onPress} style={{ width, marginRight: 12, padding: 14 }}>
      <Avatar name={d.name} uri={d.photoUrl} size={48} />
      <T variant="h3" numberOfLines={1} style={{ marginTop: 10 }}>
        Dr. {d.name}
      </T>
      <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>
        {(d.specialties[0] ? specialtyName(d.specialties[0], lang) : 'Doctor').toUpperCase()}
      </Text>
      {!!subtitle && (
        <T variant="muted" numberOfLines={1} style={{ marginTop: 4 }}>
          {subtitle}
        </T>
      )}
      {!!footer && <Text style={{ color: C.tealDark, fontWeight: '700', fontSize: 12, marginTop: 6 }}>{footer}</Text>}
    </Card>
  );
}

export function DoctorRow({ d, right, onPress }: { d: DoctorCardData; right?: React.ReactNode; onPress?: () => void }) {
  const { lang } = useI18n();
  return (
    <Card onPress={onPress}>
      <Row gap={12}>
        <Avatar name={d.name} uri={d.photoUrl} />
        <View style={{ flex: 1 }}>
          <Row gap={6}>
            <T variant="h3" numberOfLines={1}>
              Dr. {d.name}
            </T>
            {d.verified && <Ionicons name="checkmark-circle" size={16} color={C.teal} />}
          </Row>
          <T variant="muted" numberOfLines={1}>
            {[d.specialties.map((s) => specialtyName(s, lang)).join(', '), d.degrees].filter(Boolean).join(' · ')}
          </T>
          {d.experienceYears != null && <T variant="small" style={{ color: C.muted }}>{d.experienceYears} yrs exp{d.ratingAvg ? ` · ★ ${d.ratingAvg}` : ''}</T>}
        </View>
        {right ?? <Ionicons name="chevron-forward" size={18} color={C.faint} />}
      </Row>
    </Card>
  );
}

export interface ClinicCardData {
  id: string;
  code?: string;
  name: string;
  type?: string;
  photos?: string[];
  addressLine?: string;
  area?: { name: string; nameBn?: string | null; region?: { district: string } };
  doctorsToday?: number;
  ratingAvg?: number | null;
  ratingCount?: number;
}

export function ClinicRow({ c, onPress, statusText, statusTone }: { c: ClinicCardData; onPress?: () => void; statusText?: string; statusTone?: 'ok' | 'info' }) {
  const { lang } = useI18n();
  return (
    <Card onPress={onPress}>
      <Row gap={12}>
        {c.photos?.[0] ? (
          <Image source={{ uri: c.photos[0] }} style={{ width: 56, height: 56, borderRadius: 14 }} />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: C.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="medkit-outline" size={26} color={C.tealDark} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Row gap={6}>
            <T variant="h3" numberOfLines={2} style={{ flexShrink: 1 }}>
              {c.name}
            </T>
            {!!c.ratingAvg && !!c.ratingCount && (
              <Text style={{ color: C.warn, fontWeight: '800', fontSize: 12 }} accessibilityLabel={`Clinic rating ${c.ratingAvg} of 5`}>
                ★ {c.ratingAvg.toFixed(1)}
              </Text>
            )}
          </Row>
          <T variant="muted" numberOfLines={1}>
            {lang === 'bn' && c.area?.nameBn ? c.area.nameBn : c.area?.name}
            {c.area?.region ? ` · ${c.area.region.district}` : ''}
          </T>
          {!!statusText && <Text style={{ color: statusTone === 'ok' ? C.ok : C.tealDark, fontWeight: '700', fontSize: 12, marginTop: 4 }}>{statusText}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.faint} />
      </Row>
    </Card>
  );
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const tone = (({ ONLINE: 'ok', PAUSED: 'warn', ENDED: 'muted', CANCELLED: 'bad', SCHEDULED: 'info', DELAYED: 'warn' }) as Record<string, 'ok' | 'warn' | 'muted' | 'bad' | 'info'>)[status] ?? 'muted';
  return <Badge text={label ?? status.replace(/_/g, ' ').toLowerCase()} tone={tone} />;
}
