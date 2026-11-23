'use client';

import Link from 'next/link';
import { use } from 'react';
import { ErrorBox, Icon, Logo, Shell, Spinner, StatusBadge, UserChip, type NavItem } from '@/components/ui';
import { logout } from '@/lib/api';
import { useApi, useRequireAuth } from '@/lib/hooks';
import { ClinicContext } from './clinic-context';

export default function ClinicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useRequireAuth();
  const { data: clinic, error } = useApi<any>(['clinic', id], session ? `/clinic/${id}` : null);
  if (error) return <div className="p-8"><ErrorBox error={error} /><Link href="/console" className="mt-4 block text-teal-600">← Your clinics</Link></div>;
  if (!session || !clinic) return <Spinner />;
  const owner = clinic.myRole === 'CLINIC_OWNER';
  const f = clinic.entitlements.features;
  const base = `/console/${id}`;
  const nav: NavItem[] = [
    { href: `${base}/queue`, label: 'Live queue', icon: 'play', group: 'Today' },
    ...(owner ? [{ href: `${base}/doctors`, label: 'Doctors & sittings', icon: 'stethoscope', group: 'Today' }] : []),
    ...(f.RECORDS ? [{ href: `${base}/register`, label: 'Visit register', icon: 'clipboard', group: 'Today' }] : []),
    ...(owner
      ? [
          ...(f.EARNINGS ? [{ href: `${base}/earnings`, label: 'Earnings & history', icon: 'trend', group: 'Business' }] : []),
          { href: `${base}/fees`, label: 'Fees & payments', icon: 'card', group: 'Business' },
          { href: `${base}/subscription`, label: 'Plan & features', icon: 'layers', group: 'Business' },
          ...(f.BONUSES ? [{ href: `${base}/bonuses`, label: 'Bonuses & prizes', icon: 'gift', group: 'Business' }] : []),
          { href: `${base}/profile`, label: 'Clinic profile & photos', icon: 'clinic', group: 'Clinic' },
          ...(f.QUEUE_MANAGER ? [{ href: `${base}/staff`, label: 'Queue Manager accounts', icon: 'users', group: 'Clinic' }] : []),
          ...(f.DOCTORS_POSTER ? [{ href: `${base}/poster`, label: "Today's doctors poster", icon: 'print', group: 'Clinic' }] : []),
          ...(f.OPEN_SLOTS ? [{ href: `${base}/open-slots`, label: 'Open slots', icon: 'chair', group: 'Clinic' }] : []),
          { href: `${base}/reviews`, label: 'Ratings & reviews', icon: 'star', group: 'Patients' },
          { href: `${base}/blocks`, label: 'Blocked patients', icon: 'ban', group: 'Patients' },
        ]
      : []),
    { href: `${base}/support`, label: 'Contact & support', icon: 'mail', group: 'Help' },
  ];

  return (
    <ClinicContext.Provider value={clinic}>
      <Shell
        brand={
          <div>
            <Logo light />
            <Link href="/console" className="group mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 transition hover:bg-white/[0.1]" title="Switch clinic">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-300/30 to-emerald-400/20 text-teal-100 ring-1 ring-white/10">
                <Icon name="clinic" className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-white">{clinic.name}</span>
                <span className="block truncate text-[11px] text-teal-100/60">
                  {clinic.code} · {owner ? 'Owner' : 'Queue Manager'}
                </span>
              </span>
              <Icon name="swap" className="h-4 w-4 shrink-0 text-teal-100/50 transition group-hover:text-white" />
            </Link>
          </div>
        }
        nav={nav}
        topRight={<UserChip name={session!.user.name} role={owner ? 'Clinic owner' : 'Queue Manager'} onLogout={() => logout()} />}
        footer={
          <div className="flex items-center gap-2.5 text-xs text-teal-50/70">
            {clinic.ratingCount ? (
              <>
                <Icon name="star" className="h-4 w-4 text-amber-300" />
                <span>
                  <b className="text-white">{clinic.ratingAvg?.toFixed(1)}</b> clinic rating · {clinic.ratingCount} reviews
                </span>
              </>
            ) : (
              <>
                <StatusBadge status={clinic.verification} />
                <span>verification</span>
              </>
            )}
          </div>
        }
      >
        {clinic.verification !== 'APPROVED' && (
          <div className="no-print mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/40 p-4 text-sm text-amber-900">
            <Icon name="shield" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            {clinic.verification === 'PENDING'
              ? 'Okidoc is verifying your clinic. Patients will see it once approved — you can set up doctors and sittings now.'
              : clinic.verification === 'INFO_REQUESTED'
                ? `Okidoc needs more information: ${clinic.verificationNote ?? 'please check your clinic profile.'}`
                : `Verification was not approved: ${clinic.verificationNote ?? ''}`}
          </div>
        )}
        {children}
      </Shell>
    </ClinicContext.Provider>
  );
}
