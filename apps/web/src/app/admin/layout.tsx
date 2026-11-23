'use client';

import { Logo, Shell, Spinner, UserChip, type NavItem } from '@/components/ui';
import { logout } from '@/lib/api';
import { useRequireAuth } from '@/lib/hooks';

const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard', group: 'Overview' },
  { href: '/admin/clinics', label: 'Clinics', icon: 'clinic', group: 'Network' },
  { href: '/admin/doctors', label: 'Doctors', icon: 'stethoscope', group: 'Network' },
  { href: '/admin/links', label: 'Clinic–doctor links', icon: 'link', group: 'Network' },
  { href: '/admin/users', label: 'Users', icon: 'users', group: 'Network' },
  { href: '/admin/revenue', label: 'Revenue switches', icon: 'bolt', group: 'Money' },
  { href: '/admin/payments', label: 'Payment config', icon: 'card', group: 'Money' },
  { href: '/admin/plans', label: 'Plans', icon: 'layers', group: 'Money' },
  { href: '/admin/ads', label: 'Ads manager', icon: 'megaphone', group: 'Money' },
  { href: '/admin/transactions', label: 'Transactions', icon: 'swap', group: 'Money' },
  { href: '/admin/settlements', label: 'Settlements', icon: 'bank', group: 'Money' },
  { href: '/admin/bonuses', label: 'Bonuses & prizes', icon: 'gift', group: 'Money' },
  { href: '/admin/blocks', label: 'No-show blocks', icon: 'ban', group: 'Trust & rules' },
  { href: '/admin/rules', label: 'Business rules', icon: 'sliders', group: 'Trust & rules' },
  { href: '/admin/reviews', label: 'Reviews', icon: 'star', group: 'Trust & rules' },
  { href: '/admin/audit', label: 'Audit log', icon: 'receipt', group: 'Trust & rules' },
  { href: '/admin/taxonomy', label: 'Specialties & areas', icon: 'folder', group: 'Content & support' },
  { href: '/admin/translations', label: 'Translations', icon: 'language', group: 'Content & support' },
  { href: '/admin/tickets', label: 'Support tickets', icon: 'mail', group: 'Content & support' },
];

const roleLabel = (roles: string[]) =>
  roles
    .filter((r) => r.startsWith('ADMIN'))
    .map((r) => r.replace('ADMIN_', '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()))
    .join(' · ') || 'Admin';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = useRequireAuth({ admin: true });
  if (!session) return <Spinner />;
  return (
    <Shell
      brand={
        <div>
          <Logo light />
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-200 ring-1 ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Admin portal
          </span>
        </div>
      }
      nav={NAV}
      topRight={<UserChip name={session.user.name} role={roleLabel(session.user.roles)} onLogout={() => logout()} />}
      footer={
        <div className="text-xs leading-relaxed text-teal-50/60">
          <div className="font-semibold text-white">West Bengal pilot</div>
          Changes here apply platform-wide and are recorded in the audit log.
        </div>
      }
    >
      {children}
    </Shell>
  );
}
