import { router } from '@/lib/nav';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AuthShell, authInput } from '@/components/AuthShell';
import { Button, Input } from '@/components/ui';
import { errMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { normalizePhone } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

/** AUTH-08 full login (new device, after logout, or after too many wrong passcodes). */
export default function Login() {
  const t = useT();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await login(normalizePhone(phone), password);
      router.replace(next === 'OTP' ? '/otp' : '/quick-setup');
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell back title={t('auth.login')} subtitle={t('app.tagline')} footer={<Button title={t('auth.login')} disabled={!phone || !password} loading={busy} onPress={submit} />}>
      <Input label={t('auth.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98300 12345" dark style={authInput} autoComplete="tel" />
      <Input label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry dark style={authInput} onSubmitEditing={submit} />
      {!!error && (
        <View style={{ backgroundColor: C.badSoft, borderRadius: 12, padding: 12 }}>
          <Text style={{ color: C.bad }}>{error}</Text>
        </View>
      )}
      <Pressable onPress={() => router.push('/forgot')} style={{ marginTop: 16, alignSelf: 'center' }} hitSlop={8}>
        <Text style={{ color: C.tealGlow, fontWeight: '700' }}>{t('auth.forgot')}</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/language')} style={{ marginTop: 16, alignSelf: 'center' }} hitSlop={8}>
        <Text style={{ color: '#B6C7CF' }}>{t('welcome.getStarted')} — {t('auth.signup')}</Text>
      </Pressable>
    </AuthShell>
  );
}
