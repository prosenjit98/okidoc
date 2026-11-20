'use client';

import type { AuthResult } from '@okidoc/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthAlert, AuthButton, AuthField, AuthShell, DevCode, Icon, OtpField, PasswordField, TextLink } from '@/components/auth';
import { api, ApiError, saveSession } from '@/lib/api';
import { isAdminUser } from '@/lib/hooks';

const AUDIENCES = ['Clinic owners', 'Queue managers', 'Okidoc admins'];

function LoginInner() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<{ token: string; to?: string; devOtp?: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = (r: AuthResult) => {
    if (!r.tokens) return;
    saveSession({ tokens: r.tokens, user: r.user });
    const admin = isAdminUser(r.user);
    // Only follow ?next= to a local page this role can open (no open redirects, no /admin for clinic staff).
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') && (admin || !next.startsWith('/admin')) ? next : null;
    router.replace(safeNext ?? (admin ? '/admin' : '/console'));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!challenge) {
        const r = await api<AuthResult>('/auth/web/login', { body: { identifier, password } });
        if (r.challengeToken) setChallenge({ token: r.challengeToken, to: r.otpSentTo, devOtp: r.devOtp });
        else finish(r);
      } else {
        finish(await api<AuthResult>('/auth/verify-otp', { body: { challengeToken: challenge.token, code } }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach Okidoc. Is the API running?');
    } finally {
      setBusy(false);
    }
  };

  if (challenge) {
    return (
      <AuthShell
        eyebrow="2-step verification"
        title="Enter the verification code"
        subtitle={<>We sent a 6-digit code to <span className="font-semibold text-navy-900">{challenge.to}</span>. It expires in a few minutes.</>}
      >
        <form onSubmit={submit} className="space-y-5">
          <OtpField value={code} onChange={setCode} hint={<DevCode code={challenge.devOtp} />} />
          {error && <AuthAlert>{error}</AuthAlert>}
          <AuthButton type="submit" loading={busy} disabled={code.length !== 6}>
            Verify
          </AuthButton>
          <div className="flex items-center justify-center">
            <TextLink onClick={() => { setChallenge(null); setCode(''); setError(null); }} className="inline-flex items-center gap-1.5">
              <Icon name="back" className="h-4 w-4" /> Use a different account
            </TextLink>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to Okidoc"
      subtitle="Run today’s queue, manage doctors and sittings, or administer the platform."
      footer={
        <>
          New clinic or pharmacy?{' '}
          <Link href="/signup" className="font-semibold text-teal-700 underline-offset-4 hover:underline">
            Register a clinic
          </Link>
        </>
      }
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {AUDIENCES.map((a) => (
          <span key={a} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {a}
          </span>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-5">
        <AuthField label="Phone or email" icon="phone" autoFocus autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="98300 12345" required />
        <div>
          <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          <div className="mt-2 flex justify-end">
            <Link href="/forgot" className="text-[13px] font-semibold text-teal-700 underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthButton type="submit" loading={busy}>
          Log in
        </AuthButton>
        <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <Icon name="shield" className="h-4 w-4 text-teal-600" />
          Admin accounts also confirm a one-time code.
        </p>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
