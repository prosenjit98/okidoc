import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { router } from '@/lib/nav';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { AuthShell } from '@/components/AuthShell';
import { BrandMark, Wordmark } from '@/components/Brand';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

const POINTS: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] = [
  { icon: 'search', text: 'Find doctors & clinics near you' },
  { icon: 'ticket', text: 'Book your serial token in seconds' },
  { icon: 'pulse', text: 'Follow the queue live from home' },
];

/** AUTH-01 welcome. */
export default function Welcome() {
  const t = useT();
  return (
    <AuthShell
      footer={
        <View style={{ gap: 14, alignItems: 'center' }}>
          <Button title={t('welcome.getStarted')} iconRight="arrow-forward" onPress={() => router.push('/language')} style={{ alignSelf: 'stretch' }} />
          <Pressable
            onPress={() => router.push('/login')}
            hitSlop={8}
            accessibilityRole="button"
            style={{ alignSelf: 'stretch', minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: C.white, fontWeight: '800', fontSize: 15 }}>{t('welcome.haveAccount')}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 4 }}>
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              onPress={() =>
                Alert.alert(
                  t('welcome.howToSignup'),
                  '1. Choose your language\n2. Choose Patient, Clinic / Pharmacy or Doctor\n3. Enter your mobile number and a password\n4. Enter the 6-digit SMS code\n5. Set a passcode or fingerprint for quick login',
                )
              }
            >
              <Text style={{ color: C.onDarkMuted, fontSize: 13, fontWeight: '600' }}>{t('welcome.howToSignup')}</Text>
            </Pressable>
            <Text style={{ color: 'rgba(167,196,204,0.5)' }}>·</Text>
            <Pressable onPress={() => Linking.openURL('mailto:support@okidoc.in')} hitSlop={8} accessibilityRole="link">
              <Text style={{ color: C.onDarkMuted, fontSize: 13, fontWeight: '600' }}>{t('welcome.help')}</Text>
            </Pressable>
          </View>
        </View>
      }
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
        <BrandMark size={104} />
        <Text style={{ color: C.onDarkMuted, fontSize: 17, fontWeight: '700', marginTop: 30 }}>{t('welcome.title')}</Text>
        <Wordmark size={46} />
        <Text style={{ color: C.onDarkMuted, fontSize: 16, marginTop: 8, textAlign: 'center' }}>{t('app.tagline')}</Text>
        <View style={{ alignSelf: 'stretch', marginTop: 34, gap: 10 }}>
          {POINTS.map((p) => (
            <View
              key={p.text}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(94,234,212,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={p.icon} size={17} color={C.tealGlow} />
              </View>
              <Text style={{ color: C.white, fontSize: 14.5, fontWeight: '600', flex: 1 }}>{p.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </AuthShell>
  );
}
