import { router } from '@/lib/nav';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { AuthShell, authInput } from '@/components/AuthShell';
import { Button, Input } from '@/components/ui';
import { api, errMessage } from '@/lib/api';
import { normalizePhone } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

/** AUTH-09 reset via SMS code, AUTH-10 recovery with backup code. */
export default function Forgot() {
  const t = useT();
  const [mode, setMode] = useState<'otp' | 'backup'>('otp');
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState<{ token: string; devOtp?: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const p = normalizePhone(phone);
    try {
      if (mode === 'backup') {
        const r = await api<{ backupCode: string }>('/auth/recover', { body: { phone: p, backupCode: code, newPassword: password }, auth: false });
        Alert.alert(t('auth.resetTitle'), `Password changed. Your NEW backup code is:\n\n${r.backupCode}\n\nSave it somewhere safe.`, [{ text: 'OK', onPress: () => router.replace('/login') }]);
      } else if (!challenge) {
        const r = await api<{ challengeToken: string; devOtp?: string }>('/auth/forgot-password', { body: { phone: p }, auth: false });
        setChallenge({ token: r.challengeToken, devOtp: r.devOtp });
      } else {
        await api('/auth/reset-password', { body: { challengeToken: challenge.token, code, newPassword: password }, auth: false });
        Alert.alert(t('auth.resetTitle'), 'Password changed. All devices were signed out.', [{ text: 'OK', onPress: () => router.replace('/login') }]);
      }
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const needsCode = mode === 'backup' || !!challenge;
  return (
    <AuthShell back title={t('auth.resetTitle')} footer={<Button title={needsCode ? t('common.save') : t('common.continue')} loading={busy} disabled={!phone || (needsCode && (!code || password.length < 8))} onPress={submit} />}>
      <Input label={t('auth.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!challenge} dark style={authInput} />
      {needsCode && (
        <>
          <Input
            label={mode === 'backup' ? t('auth.backupCode') : t('auth.otpTitle')}
            value={code}
            onChangeText={setCode}
            keyboardType={mode === 'backup' ? 'default' : 'number-pad'}
            autoCapitalize="characters"
            dark style={authInput}
            hint={challenge?.devOtp ? `Development code: ${challenge.devOtp}` : undefined}
          />
          <Input label={t('auth.newPassword')} value={password} onChangeText={setPassword} secureTextEntry hint={t('auth.passwordHint')} dark style={authInput} />
        </>
      )}
      {!!error && (
        <View style={{ backgroundColor: C.badSoft, borderRadius: 12, padding: 12 }}>
          <Text style={{ color: C.bad }}>{error}</Text>
        </View>
      )}
      <Pressable
        onPress={() => {
          setMode(mode === 'otp' ? 'backup' : 'otp');
          setChallenge(null);
          setError(null);
        }}
        style={{ marginTop: 16, alignSelf: 'center' }}
      >
        <Text style={{ color: C.tealGlow, fontWeight: '700' }}>{mode === 'otp' ? t('auth.recoverBackup') : 'Use SMS code instead'}</Text>
      </Pressable>
    </AuthShell>
  );
}
