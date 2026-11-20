import { useId, type ReactNode } from 'react';

/** Okidoc web icon set — 24px line icons, inherit `currentColor`. No icon library needed. */
const PATHS = {
  phone: <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />,
  lock: (<><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  users: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6" /></>),
  eye: (<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  eyeOff: (<><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 18l-6-6 6-6" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  shield: (<><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>),
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>),
  key: (<><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></>),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alert: (<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></>),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  dashboard: (<><rect x="3" y="3" width="7.5" height="9" rx="2" /><rect x="13.5" y="3" width="7.5" height="5.5" rx="2" /><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2" /><rect x="3" y="15" width="7.5" height="6" rx="2" /></>),
  clinic: (<><path d="M3 21h18M5 21V8l7-4 7 4v13" /><path d="M10 21v-5h4v5M12 8.5v4M10 10.5h4" /></>),
  stethoscope: (<><path d="M5 3v6a5 5 0 0 0 10 0V3" /><path d="M10 14v1.5a5.5 5.5 0 0 0 11 0V13" /><circle cx="21" cy="11" r="2" /></>),
  link: (<><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></>),
  rupee: (<><path d="M6 4h12M6 9h12M9 4c4.5 0 6 2.2 6 5s-2 5-6 5H7l8 7" /></>),
  card: (<><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /></>),
  layers: (<><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>),
  megaphone: (<><path d="M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1z" /><path d="M15 8.5a4.5 4.5 0 0 1 0 7M18 6a8 8 0 0 1 0 12" /></>),
  swap: (<><path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" /></>),
  bank: (<><path d="M3 9l9-5 9 5M5 9v9M19 9v9M9.5 9v9M14.5 9v9M3 21h18" /></>),
  ban: (<><circle cx="12" cy="12" r="9" /><path d="M5.7 5.7l12.6 12.6" /></>),
  sliders: (<><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>),
  gift: (<><rect x="3" y="8" width="18" height="5" rx="1.5" /><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3 8 3.8C5.6 4.6 7 8 12 8zM12 8s1.5-5 4-4.2C18.4 4.6 17 8 12 8z" /></>),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  language: (<><path d="M4 5h9M8.5 3v2M6 5c.7 3.5 3.3 6.3 6 7.5M11 5c-.8 3.8-3.5 6.8-7 8" /><path d="M13 21l4-9 4 9M14.5 18h5" /></>),
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M4 7l8 6 8-6" /></>),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />,
  receipt: (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>),
  play: (<><circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l6-3.5z" /></>),
  clipboard: (<><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h3" /></>),
  print: (<><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>),
  chair: (<><path d="M7 3h10v8H7zM5 11h14v3H5zM7 14v7M17 14v7" /></>),
  ticket: (<><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" /><path d="M14 6v12" strokeDasharray="2 2" /></>),
  logout: (<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  trend: (<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>),
  heart: <path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.4 3.6 4 7 4c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8C19.5 15.4 12 20 12 20z" />,
  sparkles: (<><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>),
  bell: (<><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  inbox: (<><path d="M3 13l2.5-8h13L21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M3 13h5l1.5 2.5h5L16 13h5" /></>),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;
export const isIconName = (v: unknown): v is IconName => typeof v === 'string' && v in PATHS;

export function Icon({ name, className = 'h-5 w-5', strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

/** The Okidoc mark: magnifier with a pulse line (same artwork as the favicon). */
export function BrandMark({ size = 40 }: { size?: number }) {
  // Unique per instance: a gradient defined inside a hidden copy (e.g. the desktop sidebar on phones) would not paint.
  const gid = `okm-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0 drop-shadow-[0_6px_18px_rgba(20,184,166,0.45)]">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${gid})`} />
      <circle cx="29" cy="29" r="14" fill="none" stroke="#fff" strokeWidth="6" />
      <path d="M39 39l10 10" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <path d="M21 29h4l2-4 4 8 2-4h4" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
