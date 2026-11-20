'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isAdminUser, useSession } from '@/lib/hooks';
import { BrandMark, Icon } from './icons';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Logo({ light = true }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Okidoc home">
      <BrandMark size={36} />
      <span className={cx('text-[21px] font-extrabold tracking-tight', light ? 'text-white' : 'text-navy-900')}>
        <span className="bg-gradient-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent">Oki</span>doc
      </span>
    </Link>
  );
}

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#patients', label: 'For patients' },
  { href: '#clinics', label: 'For clinics' },
  { href: '#late', label: 'Missed turn' },
  { href: '#faq', label: 'FAQ' },
];

/** Sticky top bar: transparent over the hero, frosted once the page scrolls. Knows if you are signed in. */
export function LandingNav() {
  const session = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const home = session ? (isAdminUser(session.user) ? '/admin' : '/console') : null;
  return (
    <header className={cx('fixed inset-x-0 top-0 z-50 transition-all duration-300', scrolled || open ? 'bg-navy-950/85 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.6)] backdrop-blur-xl' : 'bg-transparent')}>
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-5 sm:px-8" aria-label="Main">
        <Logo />
        <div className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="rounded-full px-3.5 py-2 text-sm font-semibold text-teal-50/80 transition hover:bg-white/10 hover:text-white">
              {n.label}
            </a>
          ))}
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          {home ? (
            <Link href={home} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-navy-900 shadow-lg transition hover:-translate-y-0.5">
              Open {home === '/admin' ? 'admin' : 'console'} <Icon name="arrow" className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-4 py-2.5 text-sm font-bold text-white/90 transition hover:bg-white/10">
                Log in
              </Link>
              <Link href="/signup" className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 px-5 py-2.5 text-sm font-bold text-navy-950 shadow-[0_10px_30px_-10px_rgba(45,212,191,0.8)] transition hover:-translate-y-0.5">
                <span className="auth-shine pointer-events-none absolute inset-0" />
                Register your clinic
              </Link>
            </>
          )}
        </div>
        <button className="rounded-xl p-2 text-white lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
          <Icon name={open ? 'close' : 'menu'} className="h-6 w-6" />
        </button>
      </nav>
      {open && (
        <div className="ok-fade border-t border-white/10 px-5 pb-5 lg:hidden">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-[15px] font-semibold text-teal-50/90 hover:bg-white/10">
              {n.label}
            </a>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={home ?? '/login'} className="rounded-xl border border-white/15 py-3 text-center text-sm font-bold text-white">
              {home ? 'Open console' : 'Log in'}
            </Link>
            <Link href="/signup" className="rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 py-3 text-center text-sm font-bold text-navy-950">
              Register clinic
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

const MY_TOKEN = 14;

/** Illustrated patient app (sample data): the "now serving" number ticks up to show the live queue. */
export function LiveQueuePhone() {
  const [serving, setServing] = useState(10);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setServing((s) => (s >= MY_TOKEN - 1 ? 9 : s + 1)), 2600);
    return () => clearInterval(t);
  }, []);
  const ahead = Math.max(0, MY_TOKEN - serving - 1);
  const next = ahead === 0;
  const etaMin = ahead * 6 + 4;
  return (
    <div className="relative mx-auto w-[300px] sm:w-[320px]" aria-label="Okidoc patient app showing a live queue (sample)">
      <div className="absolute -inset-10 rounded-full bg-teal-400/20 blur-3xl" />
      <div className="relative rounded-[46px] bg-gradient-to-b from-slate-700 to-slate-900 p-[10px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.85)] ring-1 ring-white/10">
        <div className="relative overflow-hidden rounded-[37px] bg-[#f3f7f7]">
          <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
          <div className="ok-aurora relative px-5 pb-16 pt-10 text-white">
            <div className="ok-dots pointer-events-none absolute inset-0" />
            <div className="relative flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-teal-200/90">
              <span>Live queue</span>
              <span className="flex items-center gap-1.5">
                <span className="ok-ping relative h-1.5 w-1.5 rounded-full bg-emerald-400" /> Doctor online
              </span>
            </div>
            <div className="relative mt-3 text-[15px] font-extrabold">Dr. Farhan Ali</div>
            <div className="relative text-xs text-teal-100/70">Sanjeevani Pharmacy · Barasat</div>
          </div>
          <div className="relative -mt-12 px-4">
            <div className="rounded-3xl bg-white p-4 text-center shadow-[0_16px_30px_-18px_rgba(15,23,42,0.45)]">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Your token</div>
              <div className="text-[56px] font-black leading-none tracking-tight text-navy-900">#{MY_TOKEN}</div>
              <div className={cx('mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-colors duration-500', next ? 'bg-emerald-500 text-white' : 'bg-teal-50 text-teal-700')}>
                {next ? "You're next — please be ready" : 'Booked · pay at clinic'}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Now serving</div>
                <div key={serving} className="ok-pop text-[30px] font-black tabular-nums text-teal-600">#{serving}</div>
              </div>
              <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ahead of you</div>
                <div key={`a${ahead}`} className="ok-pop text-[30px] font-black tabular-nums text-navy-900">{ahead}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Icon name="clock" className="h-[18px] w-[18px]" />
              </span>
              <div className="text-left">
                <div className="text-[11px] font-semibold text-slate-400">Your turn in about</div>
                <div className="text-sm font-extrabold text-navy-900">{next ? 'a few minutes' : `${etaMin} min`}</div>
              </div>
            </div>
            <div className="mt-3 mb-5 h-11 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-center text-sm font-bold leading-[44px] text-white shadow-[0_10px_20px_-10px_rgba(13,148,136,0.9)]">
              Directions to clinic
            </div>
          </div>
        </div>
      </div>
      {/* floating notifications */}
      <div className="auth-float absolute -bottom-7 -left-20 hidden w-56 rounded-2xl bg-white/95 p-3 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] ring-1 ring-black/5 backdrop-blur md:block">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500 text-white">
            <Icon name="bell" className="h-4 w-4" />
          </span>
          <div>
            <div className="text-xs font-extrabold text-navy-900">Your turn is near</div>
            <div className="text-[11px] text-slate-500">3 patients ahead of #14</div>
          </div>
        </div>
      </div>
      <div className="auth-float-slow absolute -right-24 top-[76px] hidden w-52 rounded-2xl bg-white/95 p-3 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] ring-1 ring-black/5 backdrop-blur md:block">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <Icon name="check" className="h-4 w-4" />
          </span>
          <div>
            <div className="text-xs font-extrabold text-navy-900">Token #14 confirmed</div>
            <div className="text-[11px] text-slate-500">Today · 5:00 – 8:00 PM</div>
          </div>
        </div>
      </div>
    </div>
  );
}
