import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { router } from '@/lib/nav';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AuthShell, authInput } from '@/components/AuthShell';
import { Button, Input } from '@/components/ui';
import { errMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { normalizePhone } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { C } from '@/lib/theme';

/** AUTH-04 sign-up: phone + password (+ consent). */
export default function Signup() {
  const { t, lang } = useI18n();
  const { signup, flow } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const p = normalizePhone(phone);
  const pwOk = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
  const valid = name.trim().length > 1 && /^[6-9]\d{9}$/.test(p) && pwOk && password === confirm && consent;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signup({ name: name.trim(), phone: p, password, role: flow.role ?? 'PATIENT', language: lang });
      router.push('/otp');
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell back title={t('auth.signup')} subtitle={t('app.tagline')} footer={<Button title={t('auth.signup')} disabled={!valid} loading={busy} onPress={submit} />}>
      <Input label={t('auth.name')} value={name} onChangeText={setName} dark style={authInput} autoComplete="name" />
      <Input label={t('auth.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98300 12345" dark style={authInput} autoComplete="tel" />
      <Input label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry hint={t('auth.passwordHint')} dark style={authInput} />
      <Input label={t('auth.confirmPassword')} value={confirm} onChangeText={setConfirm} secureTextEntry dark style={authInput} error={confirm && confirm !== password ? 'Passwords do not match' : undefined} />
      <Pressable onPress={() => setConsent(!consent)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 4 }} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
        <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={22} color={consent ? C.tealGlow : '#B6C7CF'} />
        <Text style={{ color: '#D5E2E7', flex: 1, fontSize: 13 }}>{t('auth.consent')}</Text>
      </Pressable>
      {!!error && (
        <View style={{ backgroundColor: C.badSoft, borderRadius: 12, padding: 12, marginTop: 14 }}>
          <Text style={{ color: C.bad }}>{error}</Text>
        </View>
      )}
    </AuthShell>
  );
}
