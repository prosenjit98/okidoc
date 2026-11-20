'use client';

import type { AuthResult } from '@okidoc/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthAlert, AuthButton, AuthField, AuthShell, DevCode, Icon, OtpField, PasswordField, TextLink } from '@/components/auth';
import { api, ApiError, saveSession } from '@/lib/api';

/** Clinic / pharmacy owner sign-up from the browser (AUTH-04/05), then clinic registration. */
export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', phone: '', password: '', confirm: '', consent: false });
  const [challenge, setChallenge] = useState<{ token: string; to?: string; devOtp?: string } | null>(null);
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!challenge && form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      if (!challenge) {
        const r = await api<AuthResult>('/auth/signup?client=web', {
          body: { name: form.name, phone: form.phone, password: form.password, role: 'CLINIC_OWNER', language: 'en', consent: form.consent },
        });
        setChallenge({ token: r.challengeToken!, to: r.otpSentTo, devOtp: r.devOtp });
      } else {
        const r = await api<AuthResult>('/auth/verify-otp', { body: { challengeToken: challenge.token, code } });
        if (r.tokens) saveSession({ tokens: r.tokens, user: r.user });
        setBackup(r.backupCode ?? '');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach Okidoc');
    } finally {
      setBusy(false);
    }
  };

  const steps = ['Your details', 'Verify phone', 'Backup code'];
  const step = backup !== null ? 2 : challenge ? 1 : 0;
  const Stepper = (
    <ol className="mb-7 flex items-center gap-2">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < step ? 'bg-teal-500 text-white' : i === step ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
            {i < step ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={`hidden text-xs font-semibold sm:inline ${i === step ? 'text-navy-900' : 'text-slate-400'}`}>{s}</span>
          {i < steps.length - 1 && <span className={`h-px flex-1 ${i < step ? 'bg-teal-400' : 'bg-slate-200'}`} />}
        </li>
      ))}
    </ol>
  );

  if (backup !== null) {
    return (
      <AuthShell side="clinic" eyebrow="Almost done" title="Save your backup code" subtitle="If you ever lose access to your phone number, this code recovers your account. It is shown only once.">
        {Stepper}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-6 text-center">
          <div className="auth-grid pointer-events-none absolute inset-0 opacity-60" />
          <Icon name="key" className="relative mx-auto h-6 w-6 text-teal-300" />
          <div className="relative mt-3 font-mono text-[28px] font-bold tracking-[0.2em] text-white">{backup}</div>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(backup).then(() => setCopied(true))}
            className="relative mt-4 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-teal-100 ring-1 ring-white/15 transition hover:bg-white/15"
          >
            {copied ? 'Copied ✓' : 'Copy code'}
          </button>
        </div>
        <AuthButton className="mt-6" onClick={() => router.replace('/console/register')}>
          I have saved it — register my clinic
        </AuthButton>
      </AuthShell>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: k === 'consent' ? e.target.checked : e.target.value });

  if (challenge) {
    return (
      <AuthShell side="clinic" eyebrow="Step 2 of 3" title="Verify your number" subtitle={<>Enter the 6-digit code we sent to <span className="font-semibold text-navy-900">{challenge.to}</span>.</>}>
        {Stepper}
        <form onSubmit={submit} className="space-y-5">
          <OtpField value={code} onChange={setCode} hint={<DevCode code={challenge.devOtp} />} />
          {error && <AuthAlert>{error}</AuthAlert>}
          <AuthButton type="submit" loading={busy} disabled={code.length !== 6}>
            Verify
          </AuthButton>
          <div className="text-center">
            <TextLink onClick={() => { setChallenge(null); setCode(''); setError(null); }}>Change my details</TextLink>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      side="clinic"
      eyebrow="For clinics & pharmacies"
      title="Start your clinic on Okidoc"
      subtitle="Create the owner account first — you’ll add your clinic, doctors and sittings next."
      footer={
        <>
          Already registered?{' '}
          <Link href="/login" className="font-semibold text-teal-700 underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {Stepper}
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Your full name" icon="user" autoComplete="name" value={form.name} onChange={set('name')} placeholder="e.g. Sourav Banerjee" required />
        <AuthField label="Mobile number" icon="phone" autoComplete="tel" value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="98300 12345" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField label="Password" autoComplete="new-password" value={form.password} onChange={set('password')} required />
          <PasswordField label="Confirm password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} required />
        </div>
        <p className="-mt-1 text-xs text-slate-400">At least 8 characters with letters and numbers.</p>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs leading-relaxed text-slate-600 transition hover:border-slate-300">
          <input type="checkbox" checked={form.consent} onChange={set('consent')} className="mt-0.5 h-4 w-4 accent-teal-600" required />
          I agree to the Terms and Privacy Policy and consent to Okidoc processing my data to provide its services.
        </label>
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthButton type="submit" loading={busy}>
          Create account
        </AuthButton>
      </form>
    </AuthShell>
  );
}
