import type { MantineColorsTuple } from '@mantine/core';
import { getBrandThemeOverridesForMode } from '../services/brandThemeService';

export type AppThemeMode = 'light' | 'dark';

export const BRAND_COLORS: MantineColorsTuple = [
  '#eefcf4',
  '#ddf7e7',
  '#bcefd0',
  '#8ce2b0',
  '#58cf8b',
  '#35bd72',
  '#26a460',
  '#1e814d',
  '#1b6640',
  '#165334',
];

export const BRAND_ACCENT_COLORS: MantineColorsTuple = [
  '#eff6ff',
  '#dbeafe',
  '#bfdbfe',
  '#93c5fd',
  '#60a5fa',
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#1e40af',
  '#1e3a8a',
];

type SemanticSection = {
  background: string;
  border: string;
  text: string;
  textMuted: string;
};

type CreditPalette = {
  ringPurchased: string;
  ringPromotional: string;
  ringConsumed: string;
  ringIdle: string;
  textPurchased: string;
  textPromotional: string;
  textConsumed: string;
  textMuted: string;
};

export type BrandPalette = {
  header: SemanticSection & {
    brandTitle: string;
    logoBorder: string;
    logoFallback: string;
  };
  footer: SemanticSection;
  menu: {
    superRowBackground: string;
    mainRowBackground: string;
  };
  credits: CreditPalette;
  typography: {
    title: string;
    subtitle: string;
    body: string;
  };
  actions: {
    primaryButtonBackground: string;
    primaryButtonText: string;
  };
};

const LIGHT_PALETTE: BrandPalette = {
  header: {
    background: 'linear-gradient(180deg, #e2e9e5 0%, #d9e3dc 100%)',
    border: '#adc0b3',
    text: '#0f172a',
    textMuted: '#334155',
    brandTitle: '#14532d',
    logoBorder: '#6fb98b',
    logoFallback: '#15803d',
  },
  footer: {
    background: '#ecf1ee',
    border: '#d3dad4',
    text: '#0f172a',
    textMuted: '#475569',
  },
  menu: {
    superRowBackground: 'linear-gradient(180deg, #e9e4d9 0%, #ddd4c4 100%)',
    mainRowBackground: 'linear-gradient(180deg, #dbe6de 0%, #ccdcd0 100%)',
  },
  credits: {
    ringPurchased: '#16a34a',
    ringPromotional: '#2563eb',
    ringConsumed: '#dc2626',
    ringIdle: '#cbd5e1',
    textPurchased: '#166534',
    textPromotional: '#1d4ed8',
    textConsumed: '#b91c1c',
    textMuted: '#475569',
  },
  typography: {
    title: '#14532d',
    subtitle: '#334155',
    body: '#0f172a',
  },
  actions: {
    primaryButtonBackground: '#16a34a',
    primaryButtonText: '#ffffff',
  },
};

const DARK_PALETTE: BrandPalette = {
  header: {
    background: '#111827',
    border: '#1f2937',
    text: '#f3f4f6',
    textMuted: '#94a3b8',
    brandTitle: '#86efac',
    logoBorder: '#1f6f45',
    logoFallback: '#4ade80',
  },
  footer: {
    background: '#0b1220',
    border: '#1f2937',
    text: '#f3f4f6',
    textMuted: '#94a3b8',
  },
  menu: {
    superRowBackground: '#1f2937',
    mainRowBackground: '#0f172a',
  },
  credits: {
    ringPurchased: '#22c55e',
    ringPromotional: '#60a5fa',
    ringConsumed: '#f87171',
    ringIdle: '#334155',
    textPurchased: '#86efac',
    textPromotional: '#93c5fd',
    textConsumed: '#fca5a5',
    textMuted: '#94a3b8',
  },
  typography: {
    title: '#86efac',
    subtitle: '#94a3b8',
    body: '#f3f4f6',
  },
  actions: {
    primaryButtonBackground: '#16a34a',
    primaryButtonText: '#ffffff',
  },
};

export function getBrandPalette(mode: AppThemeMode): BrandPalette {
  const base = mode === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  const overrides = getBrandThemeOverridesForMode(mode);

  return {
    header: { ...base.header, ...(overrides.header ?? {}) },
    footer: { ...base.footer, ...(overrides.footer ?? {}) },
    menu: { ...base.menu, ...(overrides.menu ?? {}) },
    credits: { ...base.credits, ...(overrides.credits ?? {}) },
    typography: { ...base.typography, ...(overrides.typography ?? {}) },
    actions: { ...base.actions, ...(overrides.actions ?? {}) },
  };
}
