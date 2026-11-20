'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Card, ErrorBox, Field, Icon, Input, Select, Spinner, Stats, Textarea, type IconName } from '@/components/ui';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';
import { useAction, useApi, useSession } from '@/lib/hooks';

const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const SITTING_COLORS: Record<string, string> = {
  ONLINE: 'from-emerald-400 to-green-500',
  SCHEDULED: 'from-sky-300 to-sky-500',
  PAUSED: 'from-amber-300 to-orange-400',
  ENDED: 'from-slate-300 to-slate-400',
  CANCELLED: 'from-rose-300 to-rose-500',
};

function Row({ label, value, icon }: { label: string; value: React.ReactNode; icon?: IconName }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50">
      <dt className="flex items-center gap-2.5 text-[13px] text-slate-500">
        {icon && <Icon name={icon} className="h-4 w-4 text-slate-400" />}
        {label}
      </dt>
      <dd className="text-[14px] font-bold tabular-nums text-navy-900">{value}</dd>
    </div>
  );
}

/** ADM-01 dashboard. */
export default function Dashboard() {
  const session = useSession();
  const { data, error } = useApi<any>(['admin', 'dashboard'], '/admin/dashboard', { refetchInterval: 30_000 });
  const [b, setB] = useState({ title: '', body: '', role: '' });
  const broadcast = useAction((v: typeof b) => api('/admin/broadcast', { body: { title: v.title, body: v.body, role: v.role || undefined } }), {
    success: (r: any) => `Sent to ${r.sent} users`,
  });
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Spinner />;
  const r = data.revenue30d;
  const sittings = Object.entries(data.today.sittings as Record<string, number>);
  const totalSittings = sittings.reduce((a, [, v]) => a + Number(v), 0);
  const online = data.today.bookings.ONLINE ?? 0;
  const walkIns = (data.today.bookings.WALK_IN ?? 0) + (data.today.bookings.OFFLINE ?? 0);
  const onlineShare = online + walkIns ? Math.round((100 * online) / (online + walkIns)) : 0;
  const pendingReviews = data.clinics.pending + data.doctors.pending;
  const revenue = [
    { label: 'In-app ads', value: r.adsPaise, icon: 'megaphone' as const },
    { label: 'Subscriptions', value: r.subscriptionsPaise, icon: 'layers' as const },
    { label: 'Booking fees', value: r.bookingFeesPaise, icon: 'ticket' as const },
    { label: 'Commission', value: r.commissionPaise, icon: 'rupee' as const },
  ];
  const maxRev = Math.max(1, ...revenue.map((x) => x.value));
  const totalRev = revenue.reduce((a, x) => a + x.value, 0);

  return (
    <>
      {/* hero */}
      <div className="ok-aurora ok-rise relative mb-6 overflow-hidden rounded-[28px] p-6 text-white shadow-[0_30px_60px_-30px_rgba(7,29,41,0.9)] sm:p-8">
        <div className="ok-dots pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-teal-200">
              <span className="ok-ping relative h-2 w-2 rounded-full bg-emerald-300" /> Live overview · West Bengal pilot
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[34px]">
              {greeting()}, {session?.user.name.split(' ')[0] ?? 'there'}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-teal-50/70">
              {pendingReviews ? (
                <>
                  <b className="text-white">{pendingReviews}</b> verification{pendingReviews === 1 ? '' : 's'} waiting for you. {data.openTickets ? `${data.openTickets} open support tickets.` : 'No open support tickets.'}
                </>
              ) : (
                <>All verifications are done. {data.openTickets ? `${data.openTickets} open support tickets.` : 'No open support tickets.'}</>
              )}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { k: 'Sittings today', v: totalSittings },
              { k: 'Online bookings', v: online },
              { k: 'Walk-ins', v: walkIns },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur-sm">
                <div className="text-2xl font-extrabold tabular-nums">{x.v}</div>
                <div className="mt-0.5 text-[11px] text-teal-50/60">{x.k}</div>
              </div>
            ))}
          </div>
        </div>
        {pendingReviews > 0 && (
          <div className="relative mt-6 flex flex-wrap gap-2">
            {data.clinics.pending > 0 && (
              <Link href="/admin/clinics" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-navy-900 shadow-lg transition hover:-translate-y-0.5">
                <Icon name="clinic" className="h-4 w-4 text-teal-600" /> Review {data.clinics.pending} clinic{data.clinics.pending === 1 ? '' : 's'}
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            )}
            {data.doctors.pending > 0 && (
              <Link href="/admin/doctors" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15">
                <Icon name="stethoscope" className="h-4 w-4" /> Review {data.doctors.pending} doctor{data.doctors.pending === 1 ? '' : 's'}
              </Link>
            )}
          </div>
        )}
      </div>

      <Stats
        items={[
          { label: 'Live clinics', value: data.clinics.live, icon: 'clinic' },
          { label: 'Clinics awaiting review', value: data.clinics.pending, tone: data.clinics.pending ? 'warn' : undefined, icon: 'shield' },
          { label: 'Verified doctors', value: data.doctors.verified, icon: 'stethoscope' },
          { label: 'Doctors awaiting review', value: data.doctors.pending, tone: data.doctors.pending ? 'warn' : undefined, icon: 'clock' },
          { label: 'Patients', value: data.patients, icon: 'users', tone: 'ok' },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Today" subtitle="Sittings across all clinics" icon="calendar">
          {totalSittings ? (
            <>
              <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
                {sittings.map(([k, v]) => (
                  <div key={k} className={`h-full bg-gradient-to-r ${SITTING_COLORS[k] ?? 'from-slate-300 to-slate-400'}`} style={{ width: `${(100 * Number(v)) / totalSittings}%` }} title={`${k}: ${v}`} />
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                {sittings.map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-[13px]">
                    <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${SITTING_COLORS[k] ?? 'from-slate-300 to-slate-400'}`} />
                    <dt className="text-slate-500">{k.toLowerCase()}</dt>
                    <dd className="ml-auto font-bold tabular-nums text-navy-900">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-sm text-slate-500">No sittings scheduled today.</p>
          )}
          <div className="mt-5 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50/60 p-4 ring-1 ring-teal-100">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-semibold text-teal-800">Online share of bookings</span>
              <span className="text-xl font-extrabold tabular-nums text-teal-700">{onlineShare}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500" style={{ width: `${onlineShare}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-teal-800/70">
              <span>{online} online</span>
              <span>{walkIns} walk-in</span>
            </div>
          </div>
        </Card>

        <Card
          title="No-shows & blocks"
          subtitle="Pay-at-clinic bookings only (BR-07)"
          icon="ban"
          actions={
            <Link href="/admin/blocks" className="inline-flex items-center gap-1 text-[13px] font-semibold text-teal-700 hover:underline">
              Manage <Icon name="arrow" className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="mb-4 flex items-center gap-4">
            <div
              className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#f43f5e ${Math.min(100, data.noShowRate30d) * 3.6}deg, #f1f5f9 0deg)` }}
              aria-label={`No-show rate ${data.noShowRate30d}%`}
            >
              <div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-white">
                <span className="text-xl font-extrabold tabular-nums text-navy-900">{data.noShowRate30d}%</span>
                <span className="text-[10px] text-slate-400">30 days</span>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-500">No-show rate for pay-at-clinic bookings. 3 at one clinic or 7 overall blocks the patient.</p>
          </div>
          <dl className="-mx-3">
            <Row label="Clinic-level blocks" value={data.activeBlocks.CLINIC ?? 0} icon="clinic" />
            <Row label="Platform-wide blocks" value={data.activeBlocks.PLATFORM ?? 0} icon="globe" />
            <Row label="Open support tickets" value={data.openTickets} icon="mail" />
          </dl>
        </Card>

        <Card
          title="Revenue"
          subtitle="Last 30 days, by stream"
          icon="trend"
          actions={
            <Link href="/admin/revenue" className="inline-flex items-center gap-1 text-[13px] font-semibold text-teal-700 hover:underline">
              Switches <Icon name="arrow" className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="mb-5">
            <div className="text-[32px] font-extrabold leading-none tracking-tight tabular-nums text-navy-900">{inr(totalRev)}</div>
            <div className="mt-1.5 text-xs text-slate-400">
              {r.adImpressions.toLocaleString('en-IN')} ad impressions · {r.adClicks.toLocaleString('en-IN')} clicks
            </div>
          </div>
          <div className="space-y-3.5">
            {revenue.map((x) => (
              <div key={x.label}>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 text-slate-600">
                    <Icon name={x.icon} className="h-4 w-4 text-slate-400" />
                    {x.label}
                  </span>
                  <span className="font-bold tabular-nums text-navy-900">{inr(x.value)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500" style={{ width: `${(100 * x.value) / maxRev}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Broadcast a notification" subtitle="Sends an in-app and push notification to the chosen audience" icon="bell" className="mt-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Audience">
            <Select value={b.role} onChange={(e) => setB({ ...b, role: e.target.value })}>
              <option value="">Everyone</option>
              <option value="PATIENT">Patients</option>
              <option value="DOCTOR">Doctors</option>
              <option value="CLINIC_OWNER">Clinic owners</option>
            </Select>
          </Field>
          <Field label="Title">
            <Input value={b.title} maxLength={80} onChange={(e) => setB({ ...b, title: e.target.value })} placeholder="e.g. Durga Puja timings" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Message">
              <Textarea rows={1} value={b.body} maxLength={300} onChange={(e) => setB({ ...b, body: e.target.value })} placeholder="What should people know?" />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">{b.body.length}/300</span>
          <Button disabled={!b.title || !b.body} loading={broadcast.isPending} onClick={() => broadcast.mutate(b)}>
            <Icon name="megaphone" className="h-4 w-4" /> Send broadcast
          </Button>
        </div>
      </Card>
    </>
  );
}
