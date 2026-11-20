'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Empty, ErrorBox, Icon, Logo, Spinner, StatusBadge, UserChip } from '@/components/ui';
import { logout } from '@/lib/api';
import { useApi, useRequireAuth } from '@/lib/hooks';

/** Choose a clinic (owners can have several) or register the first one. */
export default function ConsoleHome() {
  const session = useRequireAuth();
  const router = useRouter();
  const { data, error } = useApi<any[]>(['clinic', 'mine'], session ? '/clinic/mine' : null);
  useEffect(() => {
    if (data?.length === 1) router.replace(`/console/${data[0].id}/queue`);
  }, [data, router]);
  if (!session || !data) return error ? <div className="p-8"><ErrorBox error={error} /></div> : <Spinner />;
  const owner = session.user.roles.includes('CLINIC_OWNER');
  return (
    <div className="ok-main min-h-screen">
      <div className="ok-aurora relative overflow-hidden px-6 pb-28 pt-6 text-white">
        <div className="ok-dots pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="relative mx-auto flex max-w-4xl items-center justify-between">
          <Logo light />
          <UserChip name={session.user.name} role={owner ? 'Clinic owner' : 'Queue Manager'} onLogout={() => logout()} />
        </div>
        <div className="relative mx-auto mt-12 max-w-4xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-200">Clinic console</p>
          <h1 className="mt-2 text-[34px] font-extrabold tracking-tight">Your clinics</h1>
          <p className="mt-2 max-w-lg text-sm text-teal-50/70">Pick a clinic to run today&apos;s queue, manage doctors and sittings, and see bookings live.</p>
        </div>
      </div>

      <div className="relative mx-auto -mt-16 max-w-4xl px-6 pb-16">
        {data.length === 0 ? (
          <div className="rounded-[24px] bg-white p-6 shadow-[0_24px_60px_-30px_rgba(7,29,41,0.45)]">
            <Empty
              icon="clinic"
              text="You have not registered a clinic yet. Start your clinic on Okidoc to run your OPD queue online."
              action={
                owner ? (
                  <Link href="/console/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-10px_rgba(13,148,136,0.8)]">
                    <Icon name="plus" className="h-4 w-4" /> Register a clinic
                  </Link>
                ) : (
                  <p className="text-xs">Ask your clinic owner to add you as a Queue Manager.</p>
                )
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.map((c, i) => (
              <Link
                key={c.id}
                href={`/console/${c.id}/queue`}
                className="ok-rise group relative overflow-hidden rounded-[24px] border border-white bg-white p-5 shadow-[0_24px_60px_-30px_rgba(7,29,41,0.45)] transition hover:-translate-y-1 hover:shadow-[0_30px_70px_-30px_rgba(7,29,41,0.55)]"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 to-emerald-500 opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-700 ring-1 ring-teal-100">
                    <Icon name="clinic" className="h-6 w-6" />
                  </span>
                  <StatusBadge status={c.verification} />
                </div>
                <h3 className="mt-4 text-lg font-extrabold tracking-tight text-navy-900">{c.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {c.code} · {c.area.name}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                  <span className="font-semibold text-slate-600">{c.myRole === 'CLINIC_OWNER' ? 'Owner' : 'Queue Manager'}</span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-teal-700">
                    Open console <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
            {owner && (
              <Link
                href="/console/register"
                className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-slate-300 bg-white/60 p-5 text-center text-slate-500 transition hover:border-teal-400 hover:bg-white hover:text-teal-700"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  <Icon name="plus" className="h-6 w-6" />
                </span>
                <span className="font-bold">Register another clinic</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
