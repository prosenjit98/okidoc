import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { LandingNav, LiveQueuePhone, Logo } from '@/components/landing';
import { AtHomeArt, PhoneShot, PulseLine, WaitingRoomArt } from '@/components/landing-art';

export const metadata: Metadata = {
  title: 'Okidoc — Know your queue. Skip the wait.',
  description:
    'Book a serial token with your doctor, follow the clinic queue live from home, and walk in just in time. Okidoc runs the OPD queue for clinics, pharmacy chambers and doctors across India — free for clinics and patients.',
};

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ content */

const STATS = [
  { k: '< 2 s', v: 'live queue updates' },
  { k: '3', v: 'languages at launch' },
  { k: '₹0', v: 'for clinics & patients' },
  { k: '1 app', v: 'for patients, doctors & clinics' },
];

const SPECIALTIES = ['General physician', 'Women’s doctor', 'Child specialist', 'Dentist', 'Eye specialist', 'Bone & joint', 'Skin & hair', 'ENT', 'Heart', 'Diabetes', 'Chest & lungs', 'Pharmacy chambers', 'Polyclinics', 'Nursing homes'];

const STEPS: { n: string; title: string; body: string; img: string; alt: string }[] = [
  { n: '01', title: 'Search near you', body: 'By doctor, problem, clinic, area or PIN — in English, বাংলা or हिन्दी.', img: '/landing/intro.webp', alt: 'Okidoc app: find the right doctor nearby' },
  { n: '02', title: 'Pick a sitting', body: 'See every chamber, the fee and how many places are left this week.', img: '/landing/doctor.webp', alt: 'Doctor profile with this week’s sittings' },
  { n: '03', title: 'Get your token', body: 'Book for yourself or family. Pay at the clinic or online — the clinic decides.', img: '/landing/book.webp', alt: 'Confirm booking screen' },
  { n: '04', title: 'Follow it live', body: 'Now serving, patients ahead and your expected time — updated in seconds.', img: '/landing/rejoined.webp', alt: 'Live queue with now serving and patients ahead' },
];

const CLINIC_FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'users', title: 'One-tap queue console', body: 'Put the doctor online, call next, hold or recall — from the reception PC, a tablet or a phone.' },
  { icon: 'user', title: 'Walk-ins in seconds', body: 'Name and phone, done. The token goes by SMS and fits between online bookings.' },
  { icon: 'stethoscope', title: 'Doctors & sittings', body: 'Weekly chamber plan for every doctor, alternate weeks, days off, and requests doctors accept in their app.' },
  { icon: 'rupee', title: 'Fees your way', body: 'Pay at clinic, a small booking fee online, or full prepayment with UPI. Earnings and history per doctor.' },
  { icon: 'megaphone', title: 'Delay & cancel alerts', body: 'Doctor running late? One tap tells every booked patient. Cancellations refund online payments in full.' },
  { icon: 'print', title: 'Doctors poster with QR', body: 'A printable, shareable poster so patients can book from the counter or straight from WhatsApp.' },
];

const TRUST: { icon: IconName; title: string; body: string }[] = [
  { icon: 'shield', title: 'Verified doctors and clinics', body: 'Okidoc checks each doctor’s registration and each clinic before patients can book online.' },
  { icon: 'lock', title: 'Your health, your data', body: 'Built for India’s DPDP Act 2023: clear consent, only your clinic sees your visit, delete your account any time.' },
  { icon: 'key', title: 'Passcode or fingerprint', body: 'Sign up once with your phone number, then open the app with a passcode or your phone’s own lock.' },
  { icon: 'ban', title: 'No ads where it matters', body: 'The live queue, checkout, payments and your records are always ad-free.' },
  { icon: 'card', title: 'Pay the way you like', body: 'Cash at the counter, UPI or card. Online payments are refunded automatically when a clinic cancels.' },
  { icon: 'phone', title: 'Made for everyday phones', body: 'Light and fast on budget Android phones, with SMS alerts for anyone without the app.' },
];

const FAQ: { q: string; a: ReactNode }[] = [
  { q: 'Does it cost anything?', a: 'No. Okidoc is free for patients and for clinics — every feature is included, with no card and no contract.' },
  { q: 'What if a patient misses their turn?', a: 'They are not thrown out. The app tells them right away; when they reach the clinic, reception taps Arrived and they rejoin after a set number of patients (your clinic chooses how many). If they cannot make it today, they can move the visit to the doctor’s next sitting — once, with a new token.' },
  { q: 'Can a patient cancel at the last minute?', a: 'Patients can cancel until the doctor’s sitting starts. After that only the clinic can cancel — and if a patient does not come, the visit is marked absent.' },
  { q: 'Our patients do not all use smartphones.', a: 'Reception can add anyone at the desk as a walk-in, and the token number goes to them by SMS. Booked patients also get SMS alerts when their turn is near.' },
  { q: 'Do doctors need to install anything?', a: 'Doctors use the same Okidoc app to accept clinic requests, set sittings, see their queue and earnings. A clinic can run the queue without the doctor touching the phone.' },
  { q: 'Which languages are supported?', a: 'English, বাংলা (Bengali) and हिन्दी (Hindi) at launch, with more Indian languages on the way.' },
];

/* ------------------------------------------------------------------ page */

export default function Landing() {
  return (
    <div className="overflow-x-clip bg-[#f6f9f9] text-slate-900">
      <LandingNav />

      {/* ---------------------------------------------------------- hero */}
      <section className="auth-aurora relative overflow-hidden pt-[72px] text-white">
        <div className="auth-grid pointer-events-none absolute inset-0" />
        <PulseLine className="absolute inset-x-0 bottom-16 h-24 w-full opacity-60" />
        <div className="pointer-events-none absolute -right-40 top-10 h-[560px] w-[560px] rounded-full bg-teal-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 bottom-0 h-[380px] w-[380px] rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-28 pt-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pb-36 lg:pt-20">
          <div className="auth-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-teal-100 backdrop-blur">
              <span className="ok-ping relative h-2 w-2 rounded-full bg-emerald-400" />
              Live OPD queues for India&apos;s clinics
            </span>
            <h1 className="mt-6 text-[44px] font-black leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[60px] xl:text-[68px]">
              Know your queue.
              <br />
              <span className="bg-gradient-to-r from-teal-200 via-teal-300 to-emerald-300 bg-clip-text text-transparent">Skip the wait.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-teal-50/75">
              Book a serial token with your doctor, watch the clinic queue move from home, and walk in just in time. Clinics run the whole OPD from one simple console — free.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-teal-400 to-emerald-400 px-7 py-4 text-[15px] font-extrabold text-navy-950 shadow-[0_18px_40px_-14px_rgba(45,212,191,0.85)] transition hover:-translate-y-0.5">
                <span className="auth-shine pointer-events-none absolute inset-0" />
                Register your clinic — free
                <Icon name="arrow" className="h-5 w-5 transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#how" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-7 py-4 text-[15px] font-bold text-white backdrop-blur transition hover:bg-white/10">
                <Icon name="play" className="h-5 w-5" />
                See how it works
              </a>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-teal-50/70">
              {['English · বাংলা · हिन्दी', 'Works on any Android phone', 'Pay at clinic or UPI'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Icon name="check" className="h-4 w-4 text-emerald-300" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="auth-rise relative flex justify-center [animation-delay:120ms]">
            <PhoneShot src="/landing/clinic.webp" alt="Clinic page in the Okidoc app" tilt={-9} className="absolute -left-2 top-16 hidden opacity-90 xl:block" />
            <LiveQueuePhone />
          </div>
        </div>
        <svg className="absolute inset-x-0 bottom-[-1px] h-12 w-full text-[#f6f9f9]" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden>
          <path d="M0 48h1440V0C1140 32 840 48 720 48S300 32 0 0z" fill="currentColor" />
        </svg>
      </section>

      {/* ---------------------------------------------------------- stats */}
      <section className="relative z-10 mx-auto -mt-4 max-w-6xl px-5 sm:px-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-slate-200/70 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.v} className="bg-white px-6 py-7 text-center">
              <div className="bg-gradient-to-br from-navy-900 to-teal-600 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">{s.k}</div>
              <div className="mt-1.5 text-sm font-semibold text-slate-500">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- specialties marquee */}
      <section className="py-12" aria-label="Doctors and clinics on Okidoc">
        <p className="mb-5 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-slate-400">Every kind of chamber, one app</p>
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
          <div className="lp-marquee flex w-max gap-3">
            {[...SPECIALTIES, ...SPECIALTIES].map((s, i) => (
              <span key={i} className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-navy-800 shadow-sm">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- before / after */}
      <section className="lp-warm relative overflow-hidden py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHead eyebrow="Why Okidoc" title="The waiting room, moved to your sofa" body="Most chambers in India run on a serial number. Everyone arrives at the start time and waits for hours. Okidoc tells you when to leave home instead." />
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <CompareCard tone="before" title="Without Okidoc" art={<WaitingRoomArt className="h-auto w-full" />} points={['Queue up at 5 PM for a 5 PM sitting', 'No idea how many are ahead', 'Doctor late? You find out at the clinic', 'Missed your number? Start again']} />
            <CompareCard tone="after" title="With Okidoc" art={<AtHomeArt className="h-auto w-full" />} points={['Book a token from home in seconds', 'See now serving and patients ahead, live', 'Get told if the doctor is late or cancels', 'Missed your turn? Rejoin, or move to the next sitting']} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- how it works */}
      <section id="how" className="lp-mesh relative scroll-mt-16 overflow-hidden py-24 lg:py-28">
        <div className="lp-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHead eyebrow="How it works" title="From booking to your turn in four steps" body="Real screens from the Okidoc app." />
          <ol className="mt-14 flex snap-x gap-6 overflow-x-auto pb-6 lg:grid lg:grid-cols-4 lg:overflow-visible">
            {STEPS.map((s, i) => (
              <li key={s.n} className="flex w-[260px] shrink-0 snap-center flex-col items-center text-center lg:w-auto">
                <PhoneShot src={s.img} alt={s.alt} className={cx('w-[230px] transition duration-500 hover:-translate-y-2', i % 2 === 1 && 'lg:mt-10')} />
                <span className="mt-6 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-xs font-black text-white shadow-md">{s.n}</span>
                <h3 className="mt-3 text-lg font-extrabold text-navy-900">{s.title}</h3>
                <p className="mt-1.5 max-w-[240px] text-[14.5px] leading-relaxed text-slate-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------- patients: feature rows */}
      <section id="patients" className="scroll-mt-16 bg-white py-24 lg:py-28">
        <div className="mx-auto max-w-7xl space-y-24 px-5 sm:px-8">
          <FeatureRow
            eyebrow="For patients"
            title="Every clinic near you, in one place"
            body="Open any clinic or pharmacy chamber to see who sits there today, their fees and timings, then call or get directions in one tap."
            points={['Verified doctors with experience and ratings', 'Fees shown before you book — no surprises', 'Book for your family from one account']}
            visual={
              <div className="relative flex justify-center">
                <div className="absolute inset-0 m-auto h-72 w-72 rounded-full bg-teal-100 blur-2xl" />
                <PhoneShot src="/landing/clinic.webp" alt="Clinic page with today’s doctors" tilt={-4} className="relative z-10" />
                <PhoneShot src="/landing/doctor.webp" alt="Doctor profile with sittings" tilt={6} className="relative -ml-16 mt-16 hidden sm:block" />
              </div>
            }
          />
          <FeatureRow
            flip
            eyebrow="Not sure whom to see?"
            title="Ask the assistant which doctor fits"
            body="Describe what is wrong in your own words. The assistant suggests the right kind of specialist and the doctors near you. It never diagnoses, and points you to 108 for emergencies."
            points={['Understands English, Bengali and Hindi', 'Suggests a specialty, then shows nearby doctors', 'Clear medical disclaimer on every answer']}
            visual={
              <div className="relative flex justify-center">
                <div className="absolute inset-0 m-auto h-72 w-72 rounded-full bg-sky-100 blur-2xl" />
                <PhoneShot src="/landing/assistant.webp" alt="Okidoc assistant suggesting a specialty" className="relative" />
                <div className="absolute -left-2 top-24 hidden w-56 rounded-2xl bg-white p-4 shadow-[0_24px_40px_-24px_rgba(15,23,42,0.5)] ring-1 ring-slate-100 sm:block">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">You asked</div>
                  <div className="mt-1 text-sm font-bold text-navy-900">“Knee pain when I walk”</div>
                  <div className="mt-3 rounded-xl bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800">→ Bone &amp; joint doctors near you</div>
                </div>
              </div>
            }
          />
          <div className="relative overflow-hidden rounded-[36px] bg-navy-950 p-8 text-white sm:p-12">
            <div className="ok-dots pointer-events-none absolute inset-0" />
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
            <div className="relative grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-300">Your language</div>
                <h3 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Alerts you can read at a glance</h3>
                <p className="mt-4 text-teal-50/70">Every screen and every alert in English, বাংলা or हिन्दी — chosen on first launch, changeable any time.</p>
              </div>
              <div className="grid gap-3">
                {[
                  ['English', 'Your turn is near', '2 patients ahead of token #14. Please reach the clinic.'],
                  ['বাংলা', 'আপনার পালা কাছে', 'টোকেন #14-এর আগে 2 জন। দয়া করে ক্লিনিকে পৌঁছান।'],
                  ['हिन्दी', 'आपकी बारी पास है', 'टोकन #14 से पहले 2 मरीज़। कृपया क्लिनिक पहुँचें।'],
                ].map(([lang, title, body], i) => (
                  <div key={lang} className={cx('flex items-start gap-4 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 backdrop-blur', i === 1 && 'lg:ml-10', i === 2 && 'lg:ml-20')}>
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-teal-500 text-white">
                      <Icon name="bell" className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold">{title}</span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-teal-100">{lang}</span>
                      </div>
                      <div className="mt-0.5 text-sm text-teal-50/70">{body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- clinics (dark) */}
      <section id="clinics" className="ok-aurora relative scroll-mt-16 overflow-hidden py-24 text-white lg:py-28">
        <div className="ok-dots pointer-events-none absolute inset-0" />
        <PulseLine className="absolute inset-x-0 top-10 h-24 w-full opacity-40" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-300">For clinics & pharmacy chambers</div>
              <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-[44px]">Run the whole OPD from one screen</h2>
              <p className="mt-4 text-lg leading-relaxed text-teal-50/75">Built for reception desks: big buttons, live counts and nothing to learn. Use the browser on the counter PC or the app on any phone — your Queue Manager gets their own login with only the queue.</p>
              <ul className="mt-6 space-y-2.5 text-[15px] text-teal-50/85">
                {['Today’s bookings at a glance: online, walk-in, present, late', 'Call or WhatsApp a patient from their token', 'Changes reach every patient’s phone within seconds'].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                      <Icon name="check" className="h-3.5 w-3.5" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-400 to-emerald-400 px-6 py-3.5 text-sm font-extrabold text-navy-950 transition hover:-translate-y-0.5">
                  Register your clinic <Icon name="arrow" className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">
                  Clinic log in
                </Link>
              </div>
            </div>
            <div className="relative sm:pb-48 sm:pr-24">
              <ConsoleMock />
              <PhoneShot src="/landing/console.webp" alt="Queue console in the Okidoc app" tilt={4} className="absolute bottom-0 right-0 hidden w-[190px] sm:block" />
            </div>
          </div>
          <div className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CLINIC_FEATURES.map((f) => (
              <div key={f.title} className="rounded-[24px] bg-white/[0.06] p-6 ring-1 ring-white/10 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.09]">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-400/15 text-teal-200 ring-1 ring-teal-300/20">
                  <Icon name={f.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-extrabold">{f.title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-teal-50/70">{f.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-16 grid items-center gap-10 rounded-[32px] bg-white p-8 text-navy-900 sm:p-10 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-600">Today’s doctors poster</div>
              <h3 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Put a QR on the counter. Patients book themselves.</h3>
              <p className="mt-3 max-w-xl text-slate-600">Okidoc makes a poster of who is sitting today with a QR code for your clinic. Print it, or share it on WhatsApp groups in one tap.</p>
            </div>
            <PhoneShot src="/landing/poster.webp" alt="Today’s doctors poster with QR code" tilt={4} className="mx-auto w-[200px]" />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- missed turn */}
      <section id="late" className="lp-warm scroll-mt-16 py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
                <Icon name="clock" className="h-4 w-4" /> Running late?
              </span>
              <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight text-navy-900 sm:text-[44px]">Missed your turn? You are not out of the queue.</h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">Traffic, a long bus ride, a child who would not get ready — it happens. Okidoc keeps it fair for everyone.</p>
              <ol className="mt-8 space-y-4">
                <LateStep n={1} tone="amber" icon="bell" title="We tell you at once" body="The moment your token is called and you are not there, the app (and an SMS) lets you know." />
                <LateStep n={2} tone="teal" icon="check" title="Tap “I’m here” when you reach" body="Reception sees it instantly and taps Arrived. You rejoin after a couple of patients — the clinic sets how many." />
                <LateStep n={3} tone="navy" icon="calendar" title="Can’t make it today?" body="Move the visit to the doctor’s next sitting with a new token. Any online payment carries over." />
              </ol>
            </div>
            <div className="relative flex justify-center">
              <div className="absolute inset-0 m-auto h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
              <PhoneShot src="/landing/missed.webp" alt="You missed your turn — with I’m here and move to next sitting" tilt={-5} className="relative z-10" />
              <PhoneShot src="/landing/rejoined.webp" alt="Welcome back — you are in the queue again" tilt={5} className="relative -ml-14 mt-20 hidden sm:block" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- trust */}
      <section className="lp-mesh relative overflow-hidden py-24 lg:py-28">
        <div className="lp-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHead eyebrow="Trust & safety" title="Built carefully, for healthcare" />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST.map((f) => (
              <div key={f.title} className="group rounded-[26px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.5)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-teal-200">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-[0_10px_22px_-10px_rgba(13,148,136,0.9)] transition group-hover:scale-105">
                  <Icon name={f.icon} className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-navy-900">{f.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- doctors + app */}
      <section id="app" className="scroll-mt-16 bg-white py-24 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 sm:px-8 lg:grid-cols-2">
          <div className="ok-aurora relative overflow-hidden rounded-[32px] p-8 text-white sm:p-10">
            <div className="ok-dots pointer-events-none absolute inset-0" />
            <div className="relative">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <Icon name="phone" className="h-6 w-6 text-teal-200" />
              </span>
              <h3 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">One app. Three ways to care.</h3>
              <p className="mt-3 max-w-md leading-relaxed text-teal-50/75">Patients book and track. Doctors manage chambers and earnings. Clinics run the queue. Sign in with your phone, then just a passcode or fingerprint.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-3 text-navy-900">
                  <Icon name="play" className="h-6 w-6 text-teal-600" />
                  <span className="leading-tight">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Coming soon on</span>
                    <span className="text-[15px] font-extrabold">Google Play</span>
                  </span>
                </span>
                <span className="inline-flex items-center rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-teal-50/80">iPhone app on the way</span>
              </div>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <MiniCard icon="stethoscope" title="For doctors" body="Accept clinic requests, set sittings across chambers, see today’s queue and per-chamber earnings." />
            <MiniCard icon="users" title="For families" body="Save family members once and book for your parents or children from your own phone." />
            <MiniCard icon="star" title="Honest ratings" body="Only patients who actually visited can rate the doctor and the clinic." />
            <MiniCard icon="folder" title="Reports in one place" body="Keep prescriptions and reports for the family, and share them with the doctor for a visit." />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- free */}
      <section id="free" className="lp-mesh scroll-mt-16 py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHead eyebrow="Free" title="Free for clinics and patients" body="Every feature, no card, no contract." />
          <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-[32px] bg-white shadow-[0_40px_80px_-40px_rgba(15,23,42,0.4)] ring-1 ring-slate-200/70">
            <div className="grid md:grid-cols-[1fr_1.2fr]">
              <div className="ok-aurora relative p-8 text-white sm:p-10">
                <div className="ok-dots pointer-events-none absolute inset-0" />
                <div className="relative">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">Okidoc</div>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-6xl font-black tracking-tight">₹0</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-teal-50/75">For clinics, pharmacy chambers, the doctors who sit there and their patients.</p>
                  <Link href="/signup" className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-400 to-emerald-400 px-6 py-3.5 text-sm font-extrabold text-navy-950 transition hover:-translate-y-0.5">
                    Get started <Icon name="arrow" className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <ul className="grid gap-3.5 p-8 text-[14.5px] text-slate-700 sm:p-10">
                {['Unlimited doctors, sittings and tokens', 'Queue console on web, tablet and phone', 'Walk-ins with SMS tokens', 'Queue Manager login for reception', 'Late-arrival and next-sitting handling', 'Online payments (UPI, cards) when you want them', 'Doctors poster with QR', 'Help from the Okidoc team by email'].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <Icon name="check" className="h-3.5 w-3.5" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- faq */}
      <section id="faq" className="scroll-mt-16 bg-white py-24 lg:py-28">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <SectionHead eyebrow="Questions" title="Good to know" />
          <div className="mt-12 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-slate-200/80 bg-slate-50/40 px-6 py-5 transition open:border-teal-200 open:bg-white open:shadow-[0_18px_40px_-30px_rgba(13,148,136,0.6)]">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-[15.5px] font-bold text-navy-900">
                  {f.q}
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white ring-1 ring-slate-200 transition group-open:rotate-45 group-open:bg-teal-500 group-open:text-white group-open:ring-teal-500">
                    <Icon name="plus" className="h-4 w-4" />
                  </span>
                </summary>
                <p className="mt-3 pr-10 text-[14.5px] leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- final cta + footer */}
      <footer className="auth-aurora relative overflow-hidden text-white">
        <div className="auth-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-5 pt-24 sm:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="text-center lg:text-left">
              <h2 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">Give your patients their evenings back.</h2>
              <p className="mt-5 max-w-xl text-lg text-teal-50/75 lg:max-w-none">Set up your clinic in minutes. Your first doctor can be online today.</p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 text-[15px] font-extrabold text-navy-900 shadow-xl transition hover:-translate-y-0.5">
                  Register your clinic <Icon name="arrow" className="h-5 w-5" />
                </Link>
                <a href="mailto:support@okidoc.in" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-7 py-4 text-[15px] font-bold text-white transition hover:bg-white/10">
                  <Icon name="mail" className="h-5 w-5" /> Talk to us
                </a>
              </div>
            </div>
            <div className="relative hidden h-[360px] lg:block">
              <PhoneShot src="/landing/intro.webp" alt="Okidoc app" tilt={-8} className="absolute left-6 top-6 w-[210px]" />
              <PhoneShot src="/landing/rejoined.webp" alt="Okidoc live queue" tilt={7} glow className="absolute right-4 top-0 w-[210px]" />
            </div>
          </div>
          <div className="mt-16 grid gap-10 border-t border-white/10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Logo />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-teal-50/60">Know your queue. Skip the wait. Clinic queues and doctor booking for India.</p>
            </div>
            <FooterCol title="Product" links={[['How it works', '#how'], ['For patients', '#patients'], ['For clinics', '#clinics'], ['Missed turn', '#late']]} />
            <FooterCol title="Clinics" links={[['Register a clinic', '/signup'], ['Clinic log in', '/login'], ['Forgot password', '/forgot']]} />
            <FooterCol title="Help" links={[['support@okidoc.in', 'mailto:support@okidoc.in'], ['FAQ', '#faq']]} />
          </div>
          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-xs text-teal-50/50 sm:flex-row">
            <span>© {new Date().getFullYear()} Okidoc. Made in India.</span>
            <span>Okidoc does not give medical advice. In an emergency call 108 or 112.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function SectionHead({ eyebrow, title, body, align = 'center' }: { eyebrow: string; title: string; body?: string; align?: 'center' | 'left' }) {
  return (
    <div className={cx(align === 'center' && 'mx-auto max-w-2xl text-center')}>
      <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-600">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-navy-900 sm:text-[42px]">{title}</h2>
      {body && <p className="mt-4 text-lg leading-relaxed text-slate-600">{body}</p>}
    </div>
  );
}

function CompareCard({ tone, title, art, points }: { tone: 'before' | 'after'; title: string; art: ReactNode; points: string[] }) {
  const after = tone === 'after';
  return (
    <div className={cx('overflow-hidden rounded-[32px] bg-white p-6 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.45)] ring-1 sm:p-8', after ? 'ring-teal-200' : 'ring-orange-200')}>
      <div className="flex items-center gap-3">
        <span className={cx('flex h-9 w-9 items-center justify-center rounded-xl text-white', after ? 'bg-gradient-to-br from-teal-500 to-emerald-500' : 'bg-gradient-to-br from-orange-400 to-rose-400')}>
          <Icon name={after ? 'check' : 'close'} className="h-5 w-5" />
        </span>
        <h3 className="text-xl font-extrabold text-navy-900">{title}</h3>
      </div>
      <div className="mt-6">{art}</div>
      <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-[14.5px] text-slate-700">
            <span className={cx('mt-1.5 h-2 w-2 flex-none rounded-full', after ? 'bg-emerald-500' : 'bg-orange-400')} />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeatureRow({ eyebrow, title, body, points, visual, flip }: { eyebrow: string; title: string; body: string; points: string[]; visual: ReactNode; flip?: boolean }) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <div className={cx(flip && 'lg:order-2')}>
        <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-600">{eyebrow}</div>
        <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-navy-900 sm:text-[40px]">{title}</h2>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">{body}</p>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[15px] text-slate-700">
              <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-100">
                <Icon name="check" className="h-3.5 w-3.5" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={cx(flip && 'lg:order-1')}>{visual}</div>
    </div>
  );
}

function LateStep({ n, icon, title, body, tone }: { n: number; icon: IconName; title: string; body: string; tone: 'amber' | 'teal' | 'navy' }) {
  const tones = { amber: 'from-amber-400 to-orange-400', teal: 'from-teal-500 to-emerald-500', navy: 'from-navy-800 to-navy-700' };
  return (
    <li className="flex gap-4 rounded-[22px] bg-white/90 p-5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/60 backdrop-blur">
      <span className={cx('flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md', tones[tone])}>
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-slate-300">0{n}</span>
          <h3 className="font-extrabold text-navy-900">{title}</h3>
        </div>
        <p className="mt-1 text-[14.5px] leading-relaxed text-slate-600">{body}</p>
      </div>
    </li>
  );
}

function MiniCard({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="rounded-[28px] border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_40px_-28px_rgba(13,148,136,0.5)]">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-extrabold text-navy-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-200/80">{title}</div>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([label, href]) => (
          <li key={label}>
            <a href={href} className="text-teal-50/70 transition hover:text-white">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Illustrated clinic console (sample data). */
function ConsoleMock() {
  const tiles = [
    ['24', 'Total', 'bg-navy-900'],
    ['15', 'Online', 'bg-teal-500'],
    ['9', 'Walk-in', 'bg-sky-500'],
    ['2', 'Late', 'bg-amber-500'],
  ];
  const rows: [string, string, string, string][] = [
    ['#11', 'Rina Das', 'With doctor', 'bg-teal-500 text-white'],
    ['#12', 'Walk-in · Ramesh', 'Present', 'bg-emerald-50 text-emerald-700'],
    ['#13', 'Arjun Paul', 'Came back · after 2', 'bg-amber-50 text-amber-700'],
    ['#14', 'Sima Roy', 'Booked', 'bg-slate-100 text-slate-600'],
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-teal-300/30 to-sky-300/20 blur-2xl" />
      <div className="relative overflow-hidden rounded-[26px] bg-white text-navy-900 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] ring-1 ring-white/20" aria-label="Clinic queue console (sample)">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-rose-300" />
          <span className="h-3 w-3 rounded-full bg-amber-300" />
          <span className="h-3 w-3 rounded-full bg-emerald-300" />
          <span className="ml-3 flex-1 truncate rounded-lg bg-white px-3 py-1 text-xs text-slate-400 ring-1 ring-slate-200">okidoc.in/console · Queue</span>
        </div>
        <div className="p-5">
          <div className="ok-aurora relative overflow-hidden rounded-2xl p-4 text-white">
            <div className="ok-dots pointer-events-none absolute inset-0" />
            <div className="relative flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-200">Dr. A. Mukherjee · 5–8 PM</div>
                <div className="mt-1 text-sm font-bold">Now serving</div>
              </div>
              <div className="text-4xl font-black tabular-nums">#11</div>
            </div>
            <div className="relative mt-3 h-9 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 text-center text-sm font-extrabold leading-9 text-navy-950">Call next →</div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {tiles.map(([n, l, dot]) => (
              <div key={l} className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
                <div className="text-xl font-black tabular-nums text-navy-900">{n}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                  <span className={cx('h-1.5 w-1.5 rounded-full', dot)} />
                  {l}
                </div>
              </div>
            ))}
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {rows.map(([t, n, s, c]) => (
              <li key={t} className="flex items-center gap-3 py-2.5">
                <span className="w-10 text-sm font-black tabular-nums text-navy-900">{t}</span>
                <span className="flex-1 truncate text-sm font-semibold text-slate-700">{n}</span>
                <span className={cx('rounded-full px-2.5 py-0.5 text-[11px] font-bold', c)}>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
