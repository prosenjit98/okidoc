'use client';

import { useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { BrandMark, Icon, type IconName } from './icons';

export { Icon };

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Wordmark({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark size={40} />
      <div className="leading-none">
        <div className={cx('text-[22px] font-extrabold tracking-tight', light ? 'text-white' : 'text-navy-900')}>
          <span className="bg-gradient-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent">Oki</span>doc
        </div>
        <div className={cx('mt-1 text-[10px] font-semibold uppercase tracking-[0.22em]', light ? 'text-teal-200/70' : 'text-slate-400')}>Clinic console · Admin</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ layout */

/**
 * Split-screen sign-in layout used by /login, /signup and /forgot.
 * Left: brand story with an illustrated live-queue preview (sample data). Right: the form.
 */
export function AuthShell({ eyebrow, title, subtitle, children, footer, side }: { eyebrow?: string; title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; side?: 'queue' | 'clinic' }) {
  return (
    <div className="grid min-h-screen bg-[#f4f8f8] lg:grid-cols-[1.08fr_1fr]">
      <BrandPanel variant={side ?? 'queue'} />
      <main className="relative flex flex-col">
        {/* compact brand strip on small screens */}
        <div className="auth-aurora relative overflow-hidden px-6 pb-16 pt-8 lg:hidden">
          <Wordmark light />
          <p className="relative mt-5 max-w-xs text-lg font-semibold text-white">Know your queue. Skip the wait.</p>
        </div>
        <div className="flex flex-1 items-start justify-center px-5 pb-10 lg:items-center lg:px-12">
          <div className="auth-rise -mt-10 w-full max-w-[440px] rounded-[28px] border border-white bg-white/90 p-7 shadow-[0_30px_80px_-30px_rgba(7,29,41,0.35)] backdrop-blur sm:p-9 lg:mt-0">
            {eyebrow && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700 ring-1 ring-teal-100">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                {eyebrow}
              </span>
            )}
            <h1 className="mt-4 text-[28px] font-extrabold leading-tight tracking-tight text-navy-900">{title}</h1>
            {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-slate-500">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </div>
        {footer && <div className="pb-8 text-center text-sm text-slate-500">{footer}</div>}
        <p className="pb-6 text-center text-[11px] text-slate-400">© {new Date().getFullYear()} Okidoc · Made for clinics across India</p>
      </main>
    </div>
  );
}

function BrandPanel({ variant }: { variant: 'queue' | 'clinic' }) {
  const points =
    variant === 'clinic'
      ? [
          { icon: 'bolt' as const, t: 'Live in minutes', d: 'Register, add your doctors and share your clinic QR.' },
          { icon: 'users' as const, t: 'Online + walk-in, one queue', d: 'Fair token order, late and recall handled for you.' },
          { icon: 'globe' as const, t: 'Your patients’ language', d: 'English, বাংলা and हिन्दी out of the box.' },
        ]
      : [
          { icon: 'bolt' as const, t: 'Real-time queue', d: 'Patients see now-serving and their ETA live.' },
          { icon: 'users' as const, t: 'Every doctor, every sitting', d: 'One calm view of the whole clinic day.' },
          { icon: 'shield' as const, t: 'Secure by default', d: 'Admins sign in with a one-time code.' },
        ];
  return (
    <aside className="auth-aurora relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <div className="auth-grid pointer-events-none absolute inset-0" />
      <div className="relative">
        <Wordmark light />
      </div>

      <div className="relative">
        <h2 className="max-w-md text-[44px] font-extrabold leading-[1.05] tracking-tight text-white xl:text-[52px]">
          Know your queue.
          <br />
          <span className="bg-gradient-to-r from-teal-200 via-emerald-200 to-cyan-200 bg-clip-text text-transparent">Skip the wait.</span>
        </h2>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-teal-50/75">
          Run your OPD like clockwork — online bookings, walk-ins and a live queue your patients can follow from home.
        </p>

        <QueuePreview />
      </div>

      <ul className="relative hidden gap-4 xl:grid xl:grid-cols-3">
        {points.map((p) => (
          <li key={p.t} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-400/15 text-teal-200 ring-1 ring-teal-300/20">
              <Icon name={p.icon} className="h-[18px] w-[18px]" />
            </span>
            <div className="mt-3 text-sm font-bold text-white">{p.t}</div>
            <div className="mt-1 text-xs leading-relaxed text-teal-50/60">{p.d}</div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** Decorative preview of the queue console (illustrative sample data, hidden from screen readers). */
function QueuePreview() {
  const waiting = [
    { n: 15, name: 'Riya D.', tag: 'Online', tone: 'bg-sky-400/15 text-sky-200' },
    { n: 16, name: 'Walk-in', tag: 'Present', tone: 'bg-emerald-400/15 text-emerald-200' },
    { n: 17, name: 'Arjun S.', tag: 'Online', tone: 'bg-sky-400/15 text-sky-200' },
  ];
  return (
    <div aria-hidden className="relative mt-10 h-[318px] max-w-[580px]">
      {/* main card */}
      <div className="auth-float absolute left-0 top-0 w-[330px] rounded-3xl border border-white/15 bg-white/[0.08] p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-300 to-emerald-400 text-sm font-black text-navy-950">AG</div>
            <div>
              <div className="text-sm font-bold text-white">Dr. Ananya Ghosh</div>
              <div className="text-[11px] text-teal-100/60">General Physician · 5–8 PM</div>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-200">
            <span className="auth-ping relative h-2 w-2 rounded-full bg-emerald-300" />
            Online
          </span>
        </div>
        <div className="mt-5 flex items-end justify-between rounded-2xl bg-navy-950/40 p-4 ring-1 ring-white/10">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-200/70">Now serving</div>
            <div className="mt-1 text-5xl font-black tabular-nums text-white">#14</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-200/70">Waiting</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-white">9</div>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5">
          {waiting.map((w) => (
            <li key={w.n} className="flex items-center justify-between rounded-xl px-2 py-1.5 text-[13px] text-teal-50/85">
              <span className="flex items-center gap-3">
                <span className="w-7 font-bold tabular-nums text-white">#{w.n}</span>
                {w.name}
              </span>
              <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-bold', w.tone)}>{w.tag}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* floating chips */}
      <div className="auth-float-slow absolute right-0 top-6 w-[176px] rounded-2xl border border-white/15 bg-white/[0.1] p-4 shadow-xl backdrop-blur-md">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-200/70">Your turn in</div>
        <div className="mt-1 text-3xl font-black text-white">
          ~18<span className="ml-1 text-sm font-bold text-teal-100/70">min</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-teal-300 to-emerald-300" />
        </div>
      </div>
      <div className="auth-float absolute bottom-6 right-0 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.1] px-4 py-3 shadow-xl backdrop-blur-md [animation-delay:-3s]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-200">
          <Icon name="check" className="h-4 w-4" />
        </span>
        <div>
          <div className="text-[13px] font-bold text-white">Token #22 booked</div>
          <div className="text-[11px] text-teal-100/60">Pay at clinic · ₹400</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ form pieces */

export function AuthField({ label, hint, icon, trailing, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; icon?: IconName; trailing?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-navy-900">{label}</span>
      <span className="group relative flex items-center">
        {icon && (
          <span className="pointer-events-none absolute left-4 text-slate-400 transition group-focus-within:text-teal-600">
            <Icon name={icon} className="h-[18px] w-[18px]" />
          </span>
        )}
        <input
          {...p}
          className={cx(
            'h-[52px] w-full rounded-2xl border border-slate-200 bg-slate-50/70 text-[15px] text-navy-900 outline-none transition placeholder:text-slate-400',
            'hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/15 disabled:opacity-60',
            icon ? 'pl-11' : 'pl-4',
            trailing ? 'pr-12' : 'pr-4',
            p.className,
          )}
        />
        {trailing && <span className="absolute right-2">{trailing}</span>}
      </span>
      {hint && <span className="mt-1.5 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function PasswordField(p: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; hint?: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <AuthField
      {...p}
      type={show ? 'text' : 'password'}
      icon="lock"
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-navy-900"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          <Icon name={show ? 'eyeOff' : 'eye'} className="h-[18px] w-[18px]" />
        </button>
      }
    />
  );
}

/** Six separate boxes for a one-time code; supports paste and backspace navigation. */
export function OtpField({ value, onChange, length = 6, label = 'Verification code', hint }: { value: string; onChange: (v: string) => void; length?: number; label?: string; hint?: ReactNode }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  const setAt = (i: number, d: string) => {
    const next = (value.slice(0, i) + d + value.slice(i + 1)).replace(/\D/g, '').slice(0, length);
    onChange(next);
  };
  return (
    <div>
      <span className="mb-2 block text-[13px] font-semibold text-navy-900">{label}</span>
      <div className="flex justify-between gap-2" onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length); onChange(t); refs.current[Math.min(t.length, length - 1)]?.focus(); }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={d}
            autoFocus={i === 0}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${i + 1}`}
            onChange={(e) => {
              const typed = e.target.value.replace(/\D/g, '');
              if (!typed) return;
              // SMS autofill / paste into one box delivers the whole code at once.
              if (typed.length > 2) {
                const code = typed.slice(0, length);
                onChange(code);
                refs.current[Math.min(code.length, length - 1)]?.focus();
                return;
              }
              setAt(i, typed.slice(-1));
              refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace') {
                e.preventDefault();
                if (d) setAt(i, '');
                else if (i > 0) { onChange(value.slice(0, i - 1)); refs.current[i - 1]?.focus(); }
              } else if (e.key === 'ArrowLeft') refs.current[i - 1]?.focus();
              else if (e.key === 'ArrowRight') refs.current[i + 1]?.focus();
            }}
            className={cx(
              'h-14 w-full min-w-0 rounded-2xl border text-center text-2xl font-extrabold tabular-nums text-navy-900 outline-none transition',
              d ? 'border-teal-400 bg-teal-50/60' : 'border-slate-200 bg-slate-50/70',
              'focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/15',
            )}
          />
        ))}
      </div>
      {hint && <div className="mt-3">{hint}</div>}
    </div>
  );
}

export function AuthButton({ loading, children, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cx(
        'group relative flex h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-[15px] font-bold text-white transition',
        'bg-gradient-to-r from-teal-500 via-teal-500 to-emerald-500 shadow-[0_12px_30px_-10px_rgba(13,148,136,0.7)]',
        'hover:shadow-[0_16px_36px_-10px_rgba(13,148,136,0.85)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <span className="auth-shine pointer-events-none absolute inset-0" />
      {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
      <span className="relative">{children}</span>
      {!loading && <Icon name="arrow" className="relative h-[18px] w-[18px] transition group-hover:translate-x-0.5" />}
    </button>
  );
}

export function AuthAlert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' | 'success' }) {
  const t = {
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
    success: 'border-teal-200 bg-teal-50 text-teal-800',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm', t)}>
      <Icon name={tone === 'success' ? 'check' : 'alert'} className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/** Dev-mode hint showing the echoed OTP (only when the API runs with OTP_DEV_ECHO=true). */
export function DevCode({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
      <span>Development code: {code}</span>
      <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">dev only</span>
    </div>
  );
}

export function TextLink({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...p} className={cx('text-sm font-semibold text-teal-700 underline-offset-4 transition hover:text-teal-800 hover:underline', p.className)}>
      {children}
    </button>
  );
}
