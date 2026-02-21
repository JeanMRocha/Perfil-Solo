import type { AppThemeMode, BrandPalette } from '../mantine/brand';
import { storageReadJson, storageRemove, storageWriteJson } from './safeLocalStorage';

type PartialBrandPalette = {
  [Section in keyof BrandPalette]?: Partial<BrandPalette[Section]>;
};

type BrandThemeOverrides = Partial<Record<AppThemeMode, PartialBrandPalette>>;

const BRAND_THEME_OVERRIDES_KEY = 'perfilsolo_brand_theme_overrides_v1';
export const BRAND_THEME_UPDATED_EVENT = 'perfilsolo-brand-theme-updated';

const ALLOWED_OVERRIDE_KEYS: {
  [Section in keyof BrandPalette]: readonly string[];
} = {
  header: ['background', 'border', 'text', 'textMuted'],
  footer: ['background', 'border', 'text', 'textMuted'],
  menu: ['superRowBackground', 'mainRowBackground'],
  credits: [
    'ringPurchased',
    'ringPromotional',
    'ringConsumed',
    'ringIdle',
    'textPurchased',
    'textPromotional',
    'textConsumed',
    'textMuted',
  ],
  typography: ['title', 'subtitle', 'body'],
  actions: ['primaryButtonBackground', 'primaryButtonText'],
};

function sanitizeHexColor(value: unknown): string | null {
  const parsed = String(value ?? '').trim();
  if (!parsed) return null;
  const normalized = parsed.startsWith('#') ? parsed : `#${parsed}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return normalized.toLowerCase();
}

function sanitizePaletteSection<T extends Record<string, unknown>>(
  input: unknown,
  allowedKeys: readonly string[],
): Partial<T> {
  if (!input || typeof input !== 'object') return {};

  return Object.entries(input as Record<string, unknown>).reduce<Partial<T>>(
    (acc, [key, value]) => {
      if (!allowedKeys.includes(key)) return acc;
      const sanitized = sanitizeHexColor(value);
      if (!sanitized) return acc;
      return {
        ...acc,
        [key]: sanitized,
      };
    },
    {},
  );
}

function sanitizePalette(input: unknown): PartialBrandPalette {
  if (!input || typeof input !== 'object') return {};

  const parsed = input as PartialBrandPalette;
  const header = sanitizePaletteSection<BrandPalette['header']>(
    parsed.header,
    ALLOWED_OVERRIDE_KEYS.header,
  );
  const footer = sanitizePaletteSection<BrandPalette['footer']>(
    parsed.footer,
    ALLOWED_OVERRIDE_KEYS.footer,
  );
  const menu = sanitizePaletteSection<BrandPalette['menu']>(
    parsed.menu,
    ALLOWED_OVERRIDE_KEYS.menu,
  );
  const credits = sanitizePaletteSection<BrandPalette['credits']>(
    parsed.credits,
    ALLOWED_OVERRIDE_KEYS.credits,
  );
  const typography = sanitizePaletteSection<BrandPalette['typography']>(
    parsed.typography,
    ALLOWED_OVERRIDE_KEYS.typography,
  );
  const actions = sanitizePaletteSection<BrandPalette['actions']>(
    parsed.actions,
    ALLOWED_OVERRIDE_KEYS.actions,
  );

  return {
    ...(Object.keys(header).length > 0 ? { header } : {}),
    ...(Object.keys(footer).length > 0 ? { footer } : {}),
    ...(Object.keys(menu).length > 0 ? { menu } : {}),
    ...(Object.keys(credits).length > 0 ? { credits } : {}),
    ...(Object.keys(typography).length > 0 ? { typography } : {}),
    ...(Object.keys(actions).length > 0 ? { actions } : {}),
  };
}

function sanitizeAllModes(input: unknown): BrandThemeOverrides {
  if (!input || typeof input !== 'object') return {};
  const parsed = input as BrandThemeOverrides;

  return {
    light: sanitizePalette(parsed.light),
    dark: sanitizePalette(parsed.dark),
  };
}

function dispatchThemeUpdated(): void {
  window.dispatchEvent(new CustomEvent(BRAND_THEME_UPDATED_EVENT));
}

function readOverrides(): BrandThemeOverrides {
  const raw = storageReadJson<BrandThemeOverrides>(BRAND_THEME_OVERRIDES_KEY, {});
  return sanitizeAllModes(raw);
}

function writeOverrides(next: BrandThemeOverrides): BrandThemeOverrides {
  const sanitized = sanitizeAllModes(next);
  const hasLight = Object.keys(sanitized.light ?? {}).length > 0;
  const hasDark = Object.keys(sanitized.dark ?? {}).length > 0;

  if (!hasLight && !hasDark) {
    storageRemove(BRAND_THEME_OVERRIDES_KEY);
    dispatchThemeUpdated();
    return {};
  }

  const saved = storageWriteJson(BRAND_THEME_OVERRIDES_KEY, sanitized);
  if (saved) dispatchThemeUpdated();
  return sanitized;
}

export function getBrandThemeOverridesForMode(mode: AppThemeMode): PartialBrandPalette {
  const overrides = readOverrides();
  return sanitizePalette(overrides[mode]);
}

export function updateBrandThemeMode(
  mode: AppThemeMode,
  patch: PartialBrandPalette,
): PartialBrandPalette {
  const current = readOverrides();
  const currentMode = sanitizePalette(current[mode]);
  const nextPatch = sanitizePalette(patch);

  const nextMode: PartialBrandPalette = {
    header: { ...(currentMode.header ?? {}), ...(nextPatch.header ?? {}) },
    footer: { ...(currentMode.footer ?? {}), ...(nextPatch.footer ?? {}) },
    menu: { ...(currentMode.menu ?? {}), ...(nextPatch.menu ?? {}) },
    credits: { ...(currentMode.credits ?? {}), ...(nextPatch.credits ?? {}) },
    typography: { ...(currentMode.typography ?? {}), ...(nextPatch.typography ?? {}) },
    actions: { ...(currentMode.actions ?? {}), ...(nextPatch.actions ?? {}) },
  };

  const compactMode = Object.entries(nextMode).reduce<PartialBrandPalette>(
    (acc, [section, values]) => {
      if (!values || Object.keys(values).length === 0) return acc;
      return {
        ...acc,
        [section]: values,
      };
    },
    {},
  );

  const nextAll: BrandThemeOverrides = {
    ...current,
    [mode]: compactMode,
  };

  writeOverrides(nextAll);
  return compactMode;
}

export function resetBrandThemeMode(mode: AppThemeMode): void {
  const current = readOverrides();
  const next: BrandThemeOverrides = { ...current };
  delete next[mode];
  writeOverrides(next);
}

export function resetBrandThemeAll(): void {
  writeOverrides({});
}

export function subscribeBrandTheme(listener: () => void): () => void {
  const onThemeUpdated = () => listener();
  const onStorage = (event: Event) => {
    const storageEvent = event as StorageEvent;
    if (storageEvent.key && storageEvent.key !== BRAND_THEME_OVERRIDES_KEY) return;
    listener();
  };

  window.addEventListener(BRAND_THEME_UPDATED_EVENT, onThemeUpdated);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(BRAND_THEME_UPDATED_EVENT, onThemeUpdated);
    window.removeEventListener('storage', onStorage);
  };
}
