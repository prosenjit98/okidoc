import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { router } from '@/lib/nav';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AuthShell, Logo } from '@/components/AuthShell';
import { PinPad } from '@/components/ui';
import { errCode, errMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

/** AUTH-07 daily unlock with passcode or biometric / device screen lock. */
export default function Unlock() {
  const t = useT();
  const { quick, unlockWithPasscode, unlockWithBiometric } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);

  const handle = (e: unknown) => {
    const code = errCode(e);
    if (code === 'QUICK_LOGIN_LOCKED' || code === 'FULL_LOGIN_REQUIRED' || code === 'ACCOUNT_BLOCKED') {
      setError(errMessage(e));
      setTimeout(() => router.replace('/login'), 1500);
      return;
    }
    if (code !== 'BIOMETRIC_CANCELLED') setError(errMessage(e));
  };

  const bio = async () => {
    setBusy(true);
    setError(null);
    try {
      await unlockWithBiometric();
    } catch (e) {
      handle(e);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (quick?.method === 'BIOMETRIC' && !tried.current) {
      tried.current = true;
      bio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quick?.method]);

  if (!quick) return null;
  return (
    <AuthShell
      footer={
        <Pressable onPress={() => router.push('/login')} style={{ alignSelf: 'center', padding: 8 }}>
          <Text style={{ color: '#B6C7CF', fontWeight: '600' }}>{t('auth.useFullLogin')}</Text>
        </Pressable>
      }
    >
      <View style={{ alignItems: 'center', marginTop: 30 }}>
        <Logo size={60} />
        <Text style={{ color: C.white, fontSize: 22, fontWeight: '800', marginTop: 18 }}>{quick.name}</Text>
        <Text style={{ color: '#B6C7CF', marginTop: 4 }}>{quick.hasPasscode ? t('auth.enterPasscode') : t('auth.unlock')}</Text>
      </View>
      {quick.hasPasscode && (
        <PinPad
          dark
          allowVariable
          onComplete={async (pin) => {
            setBusy(true);
            setError(null);
            try {
              await unlockWithPasscode(pin);
            } catch (e) {
              handle(e);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {quick.method === 'BIOMETRIC' && (
        <Pressable onPress={bio} disabled={busy} style={{ alignSelf: 'center', alignItems: 'center', marginTop: 20 }} accessibilityLabel={t('auth.useBiometric')}>
          <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: C.tealGlow, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="finger-print" size={40} color={C.tealGlow} />
          </View>
          <Text style={{ color: C.white, marginTop: 8, fontWeight: '600' }}>{t('auth.unlock')}</Text>
        </Pressable>
      )}
      {!!error && <Text style={{ color: '#FCA5A5', textAlign: 'center', marginTop: 16 }}>{error}</Text>}
      {busy && <Text style={{ color: C.tealGlow, textAlign: 'center', marginTop: 10 }}>{t('common.loading')}</Text>}
    </AuthShell>
  );
}
