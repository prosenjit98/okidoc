import { router } from '@/lib/nav';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AuthShell, GlassOption } from '@/components/AuthShell';
import { Button, PinPad } from '@/components/ui';
import { errMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { biometricSecret } from '@/lib/storage';
import { C } from '@/lib/theme';

type Step = 'choose' | 'create' | 'confirm';

/**
 * AUTH-06 mandatory quick-login setup: a 4–6 digit passcode, or device biometrics / screen lock
 * (with an optional passcode as fallback).
 */
export default function QuickSetup() {
  const t = useT();
  const { completeSetup, flow } = useAuth();
  const [bioAvailable, setBioAvailable] = useState(false);
  const [method, setMethod] = useState<'PASSCODE' | 'BIOMETRIC'>('PASSCODE');
  const [step, setStep] = useState<Step>('choose');
  const [first, setFirst] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fingerprint / face, or at least a device PIN / pattern (BIOMETRY_ANY_OR_DEVICE_PASSCODE).
    biometricSecret.available().then(setBioAvailable);
  }, []);

  const finish = async (passcode?: string) => {
    setBusy(true);
    setError(null);
    try {
      await completeSetup(method, passcode);
    } catch (e) {
      setError(errMessage(e));
      setStep('choose');
    } finally {
      setBusy(false);
    }
  };

  if (!flow.setupToken) {
    return (
      <AuthShell title={t('auth.quickTitle')} subtitle="Your setup session expired. Please log in again.">
        <Button title={t('auth.login')} onPress={() => router.replace('/login')} />
      </AuthShell>
    );
  }

  if (step === 'create' || step === 'confirm') {
    return (
      <AuthShell back title={step === 'create' ? t('auth.createPasscode') : t('auth.confirmPasscode')} subtitle={method === 'BIOMETRIC' ? 'Backup passcode for when biometrics are unavailable.' : t('auth.quickSubtitle')}>
        <PinPad
          dark
          allowVariable
          onComplete={(pin) => {
            if (pin.length < 4) return;
            if (step === 'create') {
              setFirst(pin);
              setStep('confirm');
              setError(null);
            } else if (pin !== first) {
              setError(t('auth.passcodeMismatch'));
              setStep('create');
            } else finish(pin);
          }}
        />
        {!!error && <Text style={{ color: '#FCA5A5', textAlign: 'center', marginTop: 10 }}>{error}</Text>}
        {busy && <Text style={{ color: C.tealGlow, textAlign: 'center', marginTop: 10 }}>{t('common.loading')}</Text>}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t('auth.quickTitle')}
      subtitle={t('auth.quickSubtitle')}
      footer={
        <View style={{ gap: 10 }}>
          {method === 'BIOMETRIC' ? (
            <>
              <Button title={t('common.continue')} loading={busy} onPress={() => finish()} />
              <Button title="Also set a backup passcode" tone="outline" onPress={() => setStep('create')} />
            </>
          ) : (
            <Button title={t('common.continue')} onPress={() => setStep('create')} />
          )}
        </View>
      }
    >
      <GlassOption icon="keypad-outline" title={t('auth.usePasscode')} desc="4–6 digits" selected={method === 'PASSCODE'} onPress={() => setMethod('PASSCODE')} />
      {bioAvailable && <GlassOption icon="finger-print-outline" title={t('auth.useBiometric')} desc="Uses your phone's own lock — Okidoc never sees your fingerprint." selected={method === 'BIOMETRIC'} onPress={() => setMethod('BIOMETRIC')} />}
      {!!error && <Text style={{ color: '#FCA5A5', marginTop: 10 }}>{error}</Text>}
    </AuthShell>
  );
}
