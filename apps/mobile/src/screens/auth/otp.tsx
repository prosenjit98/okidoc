import { router } from '@/lib/nav';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AuthShell, authInput } from '@/components/AuthShell';
import { Button, Input } from '@/components/ui';
import { errMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

/** AUTH-05 phone verification (one-time, at sign-up). */
export default function Otp() {
  const t = useT();
  const { flow, verifyOtp, resendOtp } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(30);

  useEffect(() => {
    const id = setInterval(() => setWait((w) => (w > 0 ? w - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const submit = async (c = code) => {
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(c);
      router.replace('/backup');
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!flow.challenge) {
    return (
      <AuthShell back title={t('auth.otpTitle')}>
        <Button title={t('common.back')} onPress={() => router.replace('/welcome')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell back title={t('auth.otpTitle')} subtitle={t('auth.otpSent', { phone: flow.challenge.to ?? '' })} footer={<Button title={t('auth.verify')} disabled={code.length !== 6} loading={busy} onPress={() => submit()} />}>
      <Input
        value={code}
        onChangeText={(v) => {
          const d = v.replace(/\D/g, '').slice(0, 6);
          setCode(d);
          if (d.length === 6) submit(d);
        }}
        keyboardType="number-pad"
        autoFocus
        maxLength={6}
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        dark style={[authInput, { fontSize: 28, letterSpacing: 12, textAlign: 'center' }]}
      />
      {!!flow.challenge.devOtp && <Text style={{ color: C.tealGlow, textAlign: 'center' }}>Development code: {flow.challenge.devOtp}</Text>}
      {!!error && (
        <View style={{ backgroundColor: C.badSoft, borderRadius: 12, padding: 12, marginTop: 14 }}>
          <Text style={{ color: C.bad }}>{error}</Text>
        </View>
      )}
      <Pressable
        disabled={wait > 0}
        onPress={async () => {
          try {
            await resendOtp();
            setWait(30);
          } catch (e) {
            setError(errMessage(e));
          }
        }}
        style={{ marginTop: 20, alignItems: 'center' }}
      >
        <Text style={{ color: wait > 0 ? '#7E95A0' : C.white, fontWeight: '700' }}>{wait > 0 ? t('auth.otpResendIn', { s: wait }) : t('auth.otpResend')}</Text>
      </Pressable>
    </AuthShell>
  );
}
