import { addDays, formatINR, formatTime12, istDateString } from '@okidoc/shared';

export const inr = (paise?: number | null) => formatINR(paise ?? 0);
export const t12 = (hm?: string | null) => (hm ? formatTime12(hm) : '');
export const todayIST = () => istDateString(new Date());
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const days = (w: number[]) =>
  w.length === 7 ? 'Every day' : [...w].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAYS[d]).join(', ');

export function dayLabel(date: string, t?: (k: 'common.today' | 'common.tomorrow') => string) {
  const today = todayIST();
  if (date === today) return t ? t('common.today') : 'Today';
  if (date === addDays(today, 1)) return t ? t('common.tomorrow') : 'Tomorrow';
  const d = new Date(`${date}T00:00:00+05:30`);
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

export const dateShort = (date: string) =>
  new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

export const timeOf = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';

export const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';

export const istClock = () => new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

/** "2 h 29 min" until an IST HH:mm today. */
export function startsIn(date: string, hm: string) {
  const [h, m] = hm.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  const target = Date.UTC(y, mo - 1, d, h, m) - 330 * 60_000;
  const mins = Math.round((target - Date.now()) / 60_000);
  if (mins <= 0) return null;
  return mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
}

export const initials = (name: string) =>
  name
    .replace(/^Dr\.?\s*/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

export const normalizePhone = (p: string) => p.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');

/** "2026-11-23 18:30" (a moved booking's original sitting) → "Mon, 23 Nov · 6:30 PM". */
export const sittingLabel = (v: string) => {
  const [d, hm] = v.split(' ');
  return `${dateShort(d)} · ${t12(hm)}`;
};
