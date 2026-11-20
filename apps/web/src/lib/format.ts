import { formatINR, formatTime12 } from '@okidoc/shared';

export const inr = (paise?: number | null) => formatINR(paise ?? 0);
export const t12 = (hm?: string | null) => (hm ? formatTime12(hm) : '');
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const days = (w: number[]) =>
  w.length === 7 ? 'Every day' : [...w].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAYS[d]).join(', ');
export const dt = (iso?: string | Date | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
export const dOnly = (iso?: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const todayIST = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
export const rupeesToPaise = (v: string) => Math.round(Number(v || 0) * 100);

/** "2026-11-23 18:30" (a moved booking's original sitting) → "Mon, 23 Nov · 6:30 PM". */
export const sittingLabel = (v: string) => {
  const [d, hm] = v.split(' ');
  return `${new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} · ${t12(hm)}`;
};
