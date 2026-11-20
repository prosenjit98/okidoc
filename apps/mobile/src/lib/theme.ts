import type { ViewStyle } from 'react-native';

/** Okidoc design tokens (PRD §12). Same palette as the web app and the app icon. */
export const C = {
  navy950: '#071D29',
  navy900: '#0B2A3A',
  navy800: '#0E3B4A',
  navy700: '#134B5C',
  teal: '#14B8A6',
  tealDark: '#0D9488',
  tealDeep: '#0A766C',
  tealSoft: '#E6F7F4',
  tealGlow: '#5EEAD4',
  emerald: '#10B981',
  mint: '#F3FAF9',
  bg: '#F2F7F7',
  white: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  faint: '#94A3B8',
  border: '#E2E8F0',
  line: '#E8EFF1',
  ok: '#16A34A',
  okSoft: '#DCFCE7',
  warn: '#D97706',
  warnSoft: '#FEF3C7',
  bad: '#DC2626',
  badSoft: '#FEE2E2',
  info: '#0284C7',
  infoSoft: '#E0F2FE',
  /** Text on dark (navy) surfaces */
  onDark: '#FFFFFF',
  onDarkMuted: '#A7C4CC',
};

export const R = { card: 20, lg: 24, pill: 999, sm: 12 };
/** Header / hero gradient (navy → deep teal). */
export const GRADIENT = [C.navy950, C.navy800, '#0F5560'] as const;
/** Primary action gradient (teal → emerald). */
export const GRADIENT_CTA = ['#14B8A6', '#10B981'] as const;
/** Brand tile gradient (matches the app icon). */
export const GRADIENT_BRAND = ['#2DD4BF', '#14B8A6', '#0A766C'] as const;
export const TAB_BAR_SPACE = 110;

/** Soft elevation presets (Android uses elevation; iOS uses the shadow props). */
export const SHADOW: Record<'card' | 'raised' | 'glow', ViewStyle> = {
  card: { shadowColor: '#0B2A3A', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  raised: { shadowColor: '#0B2A3A', shadowOpacity: 0.14, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  glow: { shadowColor: '#14B8A6', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
};
