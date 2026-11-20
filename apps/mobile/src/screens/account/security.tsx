import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, Input, ListItem, PinPad, Screen, Section, Sheet, T, Toggle } from '@/components/ui';
import { api, errMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { confirm, useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { biometricSecret, getDeviceId } from '@/lib/storage';

interface DeviceRow {
  id: string;
  name?: string | null;
  platform: string;
  quickLoginMethod?: string | null;
  lastSeenAt: string;
  current: boolean;
}

/** AUTH-11 account security. */
export default function Security() {
  const t = useT();
  const { quick, updateQuick } = useAuth();
  const devices = useApi<DeviceRow[]>(['devices'], '/me/devices');
  const [deviceId, setDeviceId] = useState('');
  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pinStep, setPinStep] = useState<'off' | 'create' | 'confirm'>('off');
  const [firstPin, setFirstPin] = useState('');
  const [bioHw, setBioHw] = useState(false);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    biometricSecret.available().then(setBioHw);
  }, []);

  const changePw = useAction(() => api('/me/password', { body: { currentPassword: current, newPassword: next } }), {
    invalidate: [['devices']],
    onSuccess: () => {
      setPwOpen(false);
      setCurrent('');
      setNext('');
      Alert.alert(t('security.changePassword'), 'Password changed. Other devices were signed out.');
    },
  });
  const revoke = useAction((id: string) => api(`/me/devices/${id}`, { method: 'DELETE' }), { invalidate: [['devices']] });

  const savePin = async (pin: string) => {
    try {
      await api('/me/passcode', { body: { deviceId, newPasscode: pin } });
      await updateQuick({ hasPasscode: true });
      setPinStep('off');
      Alert.alert(t('security.changePasscode'), 'Passcode updated.');
    } catch (e) {
      Alert.alert('Okidoc', errMessage(e));
    }
  };

  const toggleBio = async (enabled: boolean) => {
    try {
      const r = await api<{ deviceSecret?: string }>('/me/biometric', { body: { deviceId, enabled } });
      if (enabled && r.deviceSecret) await biometricSecret.save(r.deviceSecret);
      if (!enabled) await biometricSecret.clear();
      await updateQuick({ method: enabled ? 'BIOMETRIC' : 'PASSCODE' });
    } catch (e) {
      Alert.alert('Okidoc', errMessage(e));
    }
  };

  const newBackup = useAction(() => api<{ backupCode: string }>('/me/backup-code', { body: {} }), {
    onSuccess: (r) => Alert.alert(t('security.backupCode'), `Your new backup code:\n\n${r.backupCode}\n\nThe old code no longer works. Save this one somewhere safe.`),
  });

  return (
    <Screen back tabs={false} title={t('account.security')}>
      <Card style={{ paddingVertical: 4 }}>
        <ListItem icon="key-outline" title={t('security.changePassword')} onPress={() => setPwOpen(true)} />
        <ListItem icon="keypad-outline" title={t('security.changePasscode')} subtitle={quick?.hasPasscode ? 'Set' : 'Not set'} onPress={() => setPinStep('create')} />
        {bioHw && (
          <Toggle
            label={t('security.biometric')}
            hint={quick?.method === 'BIOMETRIC' ? 'On for this device' : 'Off'}
            value={quick?.method === 'BIOMETRIC'}
            onChange={toggleBio}
          />
        )}
        <ListItem
          icon="document-lock-outline"
          title={t('security.backupCode')}
          subtitle="Replaces your current backup code"
          onPress={async () => {
            if (await confirm(t('security.backupCode'), 'Generate a new backup code? The old one will stop working.', 'Generate')) newBackup.mutate();
          }}
        />
      </Card>
      <Section title={t('security.devices')}>
        {devices.data?.map((d) => (
          <Card key={d.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T variant="h3">{d.name ?? d.platform}</T>
                <T variant="muted">
                  {d.platform} · {dateTime(d.lastSeenAt)} {d.quickLoginMethod ? `· ${d.quickLoginMethod.toLowerCase()}` : ''}
                </T>
              </View>
              {d.current ? (
                <Badge text="This device" tone="info" />
              ) : (
                <Button
                  small
                  tone="outline"
                  title="Sign out"
                  onPress={async () => {
                    if (await confirm('Sign out device', d.name ?? d.platform, 'Sign out', true)) revoke.mutate(d.id);
                  }}
                />
              )}
            </View>
          </Card>
        ))}
      </Section>
      <Sheet visible={pwOpen} onClose={() => setPwOpen(false)} title={t('security.changePassword')}>
        <Input label="Current password" value={current} onChangeText={setCurrent} secureTextEntry />
        <Input label={t('auth.newPassword')} value={next} onChangeText={setNext} secureTextEntry hint={t('auth.passwordHint')} />
        <Button title={t('common.save')} disabled={!current || next.length < 8} loading={changePw.isPending} onPress={() => changePw.mutate()} />
      </Sheet>
      <Sheet visible={pinStep !== 'off'} onClose={() => setPinStep('off')} title={pinStep === 'create' ? t('auth.createPasscode') : t('auth.confirmPasscode')}>
        <PinPad
          allowVariable
          onComplete={(pin) => {
            if (pin.length < 4) return;
            if (pinStep === 'create') {
              setFirstPin(pin);
              setPinStep('confirm');
            } else if (pin !== firstPin) {
              Alert.alert('Okidoc', t('auth.passcodeMismatch'));
              setPinStep('create');
            } else savePin(pin);
          }}
        />
      </Sheet>
    </Screen>
  );
}
