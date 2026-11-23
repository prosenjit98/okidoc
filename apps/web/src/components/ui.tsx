'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { BrandMark, Icon, isIconName, type IconName } from './icons';

export { Icon, type IconName };
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ================================================================== buttons */

type Tone = 'primary' | 'ghost' | 'danger' | 'outline' | 'dark';
export function Button({ tone = 'primary', loading, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; loading?: boolean }) {
  const tones: Record<Tone, string> = {
    primary:
      'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-[0_8px_20px_-8px_rgba(13,148,136,0.75)] hover:shadow-[0_12px_26px_-8px_rgba(13,148,136,0.85)] hover:brightness-[1.04]',
    dark: 'bg-navy-900 text-white shadow-[0_8px_20px_-10px_rgba(7,29,41,0.8)] hover:bg-navy-800',
    ghost: 'text-navy-800 hover:bg-teal-50',
    outline: 'border border-slate-200 bg-white text-navy-900 shadow-sm hover:border-teal-300 hover:bg-teal-50/40',
    danger: 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-[0_8px_20px_-8px_rgba(220,38,38,0.7)] hover:brightness-105',
  };
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
        tones[tone],
        className,
      )}
    >
      {loading && <span className={cx('h-4 w-4 animate-spin rounded-full border-2', tone === 'outline' || tone === 'ghost' ? 'border-teal-200 border-t-teal-600' : 'border-white/40 border-t-white')} />}
      {children}
    </button>
  );
}

/* ================================================================== surfaces */

export function Card({ title, actions, children, className, icon, subtitle }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; icon?: IconName; subtitle?: ReactNode }) {
  return (
    <section className={cx('ok-card rounded-[22px] border border-slate-200/60 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-18px_rgba(15,23,42,0.18)] sm:p-6', className)}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {icon && (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-700 ring-1 ring-teal-100">
                <Icon name={icon} className="h-[18px] w-[18px]" />
              </span>
            )}
            <div>
              {title && <h3 className="text-[15px] font-bold tracking-tight text-navy-900">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="ok-rise mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow && <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-teal-600">{eyebrow}</p>}
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Hero({ eyebrow, title, hint, right }: { eyebrow: string; title: string; hint?: string; right?: ReactNode }) {
  return (
    <div className="ok-aurora ok-rise relative mb-5 overflow-hidden rounded-[24px] p-6 text-white shadow-[0_24px_50px_-28px_rgba(7,29,41,0.9)] sm:p-7">
      <div className="ok-dots pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-400/20 blur-2xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-teal-200">
            <span className="ok-ping relative h-2 w-2 rounded-full bg-emerald-300" />
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight">{title}</h2>
          {hint && <p className="mt-1.5 max-w-2xl text-sm text-teal-50/70">{hint}</p>}
        </div>
        {right && <div className="relative">{right}</div>}
      </div>
    </div>
  );
}

const statAccent = {
  default: { bar: 'from-teal-400 to-emerald-400', icon: 'bg-teal-50 text-teal-700 ring-teal-100', value: 'text-navy-900' },
  ok: { bar: 'from-emerald-400 to-green-500', icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100', value: 'text-emerald-700' },
  warn: { bar: 'from-amber-300 to-orange-400', icon: 'bg-amber-50 text-amber-700 ring-amber-100', value: 'text-amber-600' },
  bad: { bar: 'from-rose-400 to-red-500', icon: 'bg-rose-50 text-rose-700 ring-rose-100', value: 'text-rose-600' },
};
export function Stats({ items }: { items: { label: string; value: ReactNode; tone?: 'ok' | 'warn' | 'bad'; icon?: IconName; hint?: ReactNode }[] }) {
  const cols = items.length >= 5 ? 'sm:grid-cols-3 xl:grid-cols-5' : items.length === 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : items.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <div className={cx('mb-5 grid grid-cols-2 gap-3 sm:gap-4', cols)}>
      {items.map((s, i) => {
        const a = statAccent[s.tone ?? 'default'];
        return (
          <div
            key={s.label}
            className="ok-rise group relative overflow-hidden rounded-[20px] border border-slate-200/60 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-18px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-18px_rgba(15,23,42,0.28)] sm:p-5"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <span className={cx('absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r opacity-80', a.bar)} />
            <div className="flex items-start justify-between gap-2">
              <div className="text-[12px] font-semibold leading-snug text-slate-500">{s.label}</div>
              {s.icon && (
                <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1', a.icon)}>
                  <Icon name={s.icon} className="h-4 w-4" />
                </span>
              )}
            </div>
            <div className={cx('mt-2 text-[28px] font-extrabold leading-none tracking-tight tabular-nums', a.value)}>{s.value}</div>
            {s.hint && <div className="mt-2 text-xs text-slate-400">{s.hint}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================== badges */

const badgeTones: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200/80',
  bad: 'bg-rose-50 text-rose-700 ring-rose-200/80',
  info: 'bg-teal-50 text-teal-700 ring-teal-200/80',
  muted: 'bg-slate-100 text-slate-600 ring-slate-200/80',
};
const badgeDots: Record<string, string> = { ok: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500', info: 'bg-teal-500', muted: 'bg-slate-400' };
export function Badge({ tone = 'muted', children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset', badgeTones[tone])}>
      <span className={cx('h-1.5 w-1.5 rounded-full', badgeDots[tone])} />
      {children}
    </span>
  );
}

export const statusTone = (s?: string): keyof typeof badgeTones =>
  ({
    APPROVED: 'ok', ACTIVE: 'ok', SERVED: 'ok', PAID: 'ok', PRESENT: 'ok', ONLINE: 'ok', PROCESSED: 'ok', RESOLVED: 'ok',
    PENDING: 'warn', PENDING_PAYMENT: 'warn', LATE: 'warn', SKIPPED: 'warn', PAUSED: 'warn', DUE: 'warn', INFO_REQUESTED: 'warn', GRACE: 'warn', TRIAL: 'info', OPEN: 'warn',
    REJECTED: 'bad', DECLINED: 'bad', CANCELLED: 'bad', NO_SHOW: 'bad', FAILED: 'bad', BLOCKED: 'bad', REMOVED: 'bad', EXPIRED: 'bad',
    IN_CONSULTATION: 'info', BOOKED: 'info', SCHEDULED: 'muted', ENDED: 'muted', DRAFT: 'muted',
  })[s ?? ''] ?? 'muted';

export function StatusBadge({ status }: { status?: string }) {
  return <Badge tone={statusTone(status)}>{status === 'NO_SHOW' ? 'absent' : (status ?? '—').replace(/_/g, ' ').toLowerCase()}</Badge>;
}

/* ================================================================== forms */

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-navy-900/80">{label}</span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-medium text-rose-600">{error}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/15 disabled:cursor-not-allowed disabled:opacity-60';
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, 'ok-select cursor-pointer pr-9', p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, p.className)} />;

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full transition duration-200 focus-visible:ring-4 focus-visible:ring-teal-500/25 disabled:opacity-50',
        checked ? 'bg-gradient-to-r from-teal-500 to-emerald-500 shadow-[0_4px_12px_-4px_rgba(13,148,136,0.7)]' : 'bg-slate-200',
      )}
    >
      <span className={cx('inline-block h-[20px] w-[20px] rounded-full bg-white shadow-md transition duration-200', checked ? 'translate-x-[23px]' : 'translate-x-[3px]')} />
    </button>
  );
}

/* ================================================================== overlays */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ok-fade no-print fixed inset-0 z-50 flex items-center justify-center bg-navy-950/45 p-4 backdrop-blur-[3px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('ok-pop max-h-[90vh] w-full overflow-y-auto rounded-[24px] border border-white bg-white p-6 shadow-[0_40px_90px_-30px_rgba(7,29,41,0.55)] sm:p-7', wide ? 'max-w-3xl' : 'max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-lg font-extrabold tracking-tight text-navy-900">{title}</h3>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-navy-900" aria-label="Close">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ================================================================== data */

export function Table<T>({ rows, cols, empty = 'Nothing here yet', onRow }: { rows: T[] | undefined; cols: { h: string; c: (r: T) => ReactNode; className?: string }[]; empty?: string; onRow?: (r: T) => void }) {
  if (!rows) return <Spinner />;
  if (!rows.length) return <Empty text={empty} />;
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th
                key={c.h || `col-${i}`}
                className={cx(
                  'border-y border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 first:rounded-l-xl first:border-l last:rounded-r-xl last:border-r',
                  c.className,
                )}
              >
                {c.h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} onClick={onRow ? () => onRow(r) : undefined} className={cx('group transition', onRow && 'cursor-pointer')}>
              {cols.map((c, j) => (
                <td
                  key={c.h || `col-${j}`}
                  className={cx(
                    'border-b border-slate-100 px-3.5 py-3 align-top text-navy-900/90 transition group-last:border-0',
                    onRow ? 'group-hover:bg-teal-50/60' : 'group-hover:bg-slate-50/70',
                    c.className,
                  )}
                >
                  {c.c(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Spinner = () => (
  <div className="flex justify-center py-12" role="status" aria-label="Loading">
    <span className="relative flex h-10 w-10 items-center justify-center">
      <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-teal-100 border-t-teal-500" />
      <span className="h-2 w-2 rounded-full bg-teal-500" />
    </span>
  </div>
);

export const Empty = ({ text, action, icon = 'inbox' }: { text: string; action?: ReactNode; icon?: IconName }) => (
  <div className="rounded-[20px] border border-dashed border-slate-300/80 bg-gradient-to-b from-slate-50/80 to-white px-6 py-10 text-center">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-sm ring-1 ring-slate-200">
      <Icon name={icon} className="h-6 w-6" />
    </span>
    <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-500">{text}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const e = error as { message?: string; code?: string };
  if (e.code === 'FEATURE_LOCKED')
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/40 p-4 text-sm text-amber-900">
        <Icon name="lock" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <b>Not enabled for your clinic.</b> {e.message}
        </div>
      </div>
    );
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
      <div>{e.message ?? 'Something went wrong'}</div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white p-1 shadow-sm">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition',
            value === t.id ? 'bg-navy-900 text-white shadow-[0_6px_16px_-8px_rgba(7,29,41,0.9)]' : 'text-slate-500 hover:bg-slate-50 hover:text-navy-900',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Confirm({ label, onConfirm, tone = 'danger', prompt, children }: { label: string; onConfirm: (reason: string) => void; tone?: Tone; prompt?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <>
      <Button tone={tone === 'danger' ? 'outline' : tone} onClick={() => setOpen(true)}>
        {children ?? label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        {prompt && (
          <Field label={prompt}>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button tone="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            tone={tone}
            disabled={!!prompt && reason.trim().length < 3}
            onClick={() => {
              onConfirm(reason);
              setOpen(false);
              setReason('');
            }}
          >
            {label}
          </Button>
        </div>
      </Modal>
    </>
  );
}

/* ================================================================== app shell */

export interface NavItem {
  href: string;
  label: string;
  /** An icon name from components/icons, or a short text glyph. */
  icon?: string;
  /** Sidebar section heading this item belongs to. */
  group?: string;
}

const NavIcon = ({ icon, active }: { icon?: string; active: boolean }) => (
  <span
    className={cx(
      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition',
      active ? 'bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-[0_6px_16px_-6px_rgba(45,212,191,0.8)]' : 'bg-white/[0.06] text-teal-100/70 group-hover:bg-white/10 group-hover:text-white',
    )}
  >
    {isIconName(icon) ? <Icon name={icon} className="h-[17px] w-[17px]" /> : <span className="text-sm">{icon}</span>}
  </span>
);

function isActive(path: string, href: string) {
  return path === href || (href.split('/').length > 2 && path.startsWith(href + '/'));
}

function SideNav({ nav, path, onNavigate }: { nav: NavItem[]; path: string; onNavigate?: () => void }) {
  const groups: { name?: string; items: NavItem[] }[] = [];
  for (const n of nav) {
    const last = groups[groups.length - 1];
    if (last && last.name === n.group) last.items.push(n);
    else groups.push({ name: n.group, items: [n] });
  }
  const navRef = useRef<HTMLElement>(null);
  // Keep the current section visible when the menu is longer than the screen.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [path]);
  return (
    <nav ref={navRef} className="ok-scroll flex-1 space-y-5 overflow-y-auto pr-1">
      {groups.map((g, gi) => (
        <div key={g.name ?? gi}>
          {g.name && <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-200/45">{g.name}</p>}
          <div className="space-y-0.5">
            {g.items.map((n) => {
              const active = isActive(path, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'group relative flex items-center gap-3 rounded-xl px-2 py-1.5 text-[13.5px] transition',
                    active ? 'bg-white/[0.11] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'text-teal-50/70 hover:bg-white/[0.06] hover:text-white',
                  )}
                >
                  {active && <span className="absolute -left-4 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-teal-300 to-emerald-400" />}
                  <NavIcon icon={n.icon} active={active} />
                  <span className="truncate">{n.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

const todayLabel = () => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }).format(new Date());

/**
 * App frame for the admin portal and clinic console: dark aurora sidebar with grouped navigation, a glassy top bar
 * (current section, today's date, `topRight` slot) and a slide-in drawer on small screens.
 */
export function Shell({ brand, nav, children, footer, topRight }: { brand: ReactNode; nav: NavItem[]; children: ReactNode; footer?: ReactNode; topRight?: ReactNode }) {
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [date, setDate] = useState('');
  useEffect(() => setDate(todayLabel()), []);
  useEffect(() => setDrawer(false), [path]);
  const current = [...nav].sort((a, b) => b.href.length - a.href.length).find((n) => isActive(path, n.href));

  const sidebar = (onNavigate?: () => void) => (
    <>
      <div className="ok-dots pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative mb-7 px-2">{brand}</div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <SideNav nav={nav} path={path} onNavigate={onNavigate} />
      </div>
      {footer && <div className="relative mt-4 rounded-2xl border border-white/10 bg-white/[0.05] p-3">{footer}</div>}
    </>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="ok-aurora no-print sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col overflow-hidden p-4 pl-4 text-white md:flex">{sidebar()}</aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="ok-fade no-print fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-sm md:hidden" onClick={() => setDrawer(false)}>
          <aside className="ok-aurora ok-slide relative flex h-full w-[280px] flex-col overflow-hidden p-4 text-white" onClick={(e) => e.stopPropagation()}>
            {sidebar(() => setDrawer(false))}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 md:px-8">
            <button className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-900 ring-1 ring-slate-200 md:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {current?.group ?? 'Okidoc'}
                {current && <Icon name="chevron" className="h-3 w-3" />}
              </div>
              <div className="truncate text-[15px] font-bold text-navy-900">{current?.label ?? ''}</div>
            </div>
            <div className="hidden items-center gap-2 rounded-xl bg-slate-100/80 px-3 py-2 text-xs font-semibold text-slate-600 lg:flex">
              <Icon name="calendar" className="h-4 w-4 text-teal-600" />
              {date}
            </div>
            {topRight}
          </div>
        </header>
        <main className="ok-main min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Round initials avatar with a gradient. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-300 to-emerald-500 font-extrabold text-navy-950 ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials || '•'}
    </span>
  );
}

/** Signed-in user chip for the top bar, with a log-out button. */
export function UserChip({ name, role, onLogout }: { name: string; role: string; onLogout: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/70 bg-white py-1.5 pl-1.5 pr-1.5 shadow-sm sm:pr-2">
      <Avatar name={name} size={32} />
      <div className="hidden min-w-0 leading-tight sm:block">
        <div className="max-w-[160px] truncate text-[13px] font-bold text-navy-900">{name}</div>
        <div className="max-w-[160px] truncate text-[11px] text-slate-500">{role}</div>
      </div>
      <button onClick={onLogout} className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" aria-label="Log out" title="Log out">
        <Icon name="logout" className="h-4 w-4" />
      </button>
    </div>
  );
}

export const Logo = ({ light, size = 36 }: { light?: boolean; size?: number }) => (
  <div className="flex items-center gap-2.5">
    <BrandMark size={size} />
    <span className={cx('text-[21px] font-extrabold tracking-tight', light ? 'text-white' : 'text-navy-900')}>
      <span className={light ? 'bg-gradient-to-r from-teal-200 to-emerald-200 bg-clip-text text-transparent' : 'text-teal-600'}>Oki</span>doc
    </span>
  </div>
);
