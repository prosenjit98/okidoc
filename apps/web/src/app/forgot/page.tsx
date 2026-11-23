'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthAlert, AuthButton, AuthField, AuthShell, DevCode, Icon, OtpField, PasswordField } from '@/components/auth';
import { api, ApiError } from '@/lib/api';

/** AUTH-09 / AUTH-10: reset with phone OTP, or recover with the backup code. */
export default function ForgotPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'otp' | 'backup'>('otp');
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState<{ token: string; devOtp?: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'backup') {
        const r = await api<{ backupCode: string }>('/auth/recover', { body: { phone, backupCode: code, newPassword: password } });
        setDone(`Password changed. Your new backup code is ${r.backupCode} — save it.`);
      } else if (!challenge) {
        const r = await api<{ challengeToken: string; devOtp?: string }>('/auth/forgot-password', { body: { phone } });
        setChallenge({ token: r.challengeToken, devOtp: r.devOtp });
      } else {
        await api('/auth/reset-password', { body: { challengeToken: challenge.token, code, newPassword: password } });
        setDone('Password changed. All devices were signed out.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach Okidoc');
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: 'otp' | 'backup') => {
    setMode(m);
    setChallenge(null);
    setCode('');
    setError(null);
  };

  const back = (
    <Link href="/login" className="inline-flex items-center gap-1.5 font-semibold text-teal-700 underline-offset-4 hover:underline">
      <Icon name="back" className="h-4 w-4" /> Back to log in
    </Link>
  );

  if (done) {
    return (
      <AuthShell eyebrow="All set" title="Password changed" footer={back}>
        <AuthAlert tone="success">{done}</AuthAlert>
        <AuthButton type="button" className="mt-6" onClick={() => router.push('/login')}>
          Log in now
        </AuthButton>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      subtitle={mode === 'otp' ? 'We’ll text a one-time code to your registered mobile number.' : 'Use the backup code you saved when you created your account.'}
      footer={back}
    >
      <div role="tablist" className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-sm font-semibold">
        {(['otp', 'backup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`rounded-xl py-2.5 transition ${mode === m ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-900'}`}
          >
            {m === 'otp' ? 'SMS code' : 'Backup code'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-5">
        <AuthField label="Mobile number" icon="phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!!challenge} placeholder="98300 12345" required />
        {mode === 'otp' && challenge && <OtpField label="Code from SMS" value={code} onChange={setCode} hint={<DevCode code={challenge.devOtp} />} />}
        {mode === 'backup' && <AuthField label="Backup code" icon="key" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono tracking-widest" required />}
        {(challenge || mode === 'backup') && <PasswordField label="New password" hint="At least 8 characters with letters and numbers" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthButton type="submit" loading={busy}>
          {mode === 'otp' && !challenge ? 'Send code' : 'Change password'}
        </AuthButton>
      </form>
    </AuthShell>
  );
}
