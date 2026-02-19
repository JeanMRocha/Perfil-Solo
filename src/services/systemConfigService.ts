import { storageReadJson, storageWriteJson } from './safeLocalStorage';

export type AppUserMode = 'normal' | 'super';

export interface SystemBrandConfig {
  name: string;
  logo_url: string;
}

export interface SystemViewConfig {
  menu_text_visible: boolean;
}

export interface SystemConfig {
  mode: AppUserMode;
  brand: SystemBrandConfig;
  view: SystemViewConfig;
}

const LOCAL_SYSTEM_CONFIG_KEY = 'perfilsolo_system_config_v1';
export const SYSTEM_CONFIG_UPDATED_EVENT = 'perfilsolo-system-config-updated';

const DEFAULT_SYSTEM_NAME = 'PerfilSolo';

function defaultConfig(): SystemConfig {
  return {
    mode: 'normal',
    brand: {
      name: DEFAULT_SYSTEM_NAME,
      logo_url: '',
    },
    view: {
      menu_text_visible: true,
    },
  };
}

function normalizeMode(value: unknown): AppUserMode {
  return value === 'super' ? 'super' : 'normal';
}

function normalizeName(value: unknown): string {
  const parsed = String(value ?? '').trim();
  return parsed || DEFAULT_SYSTEM_NAME;
}

function normalizeLogo(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeBrand(input?: Partial<SystemBrandConfig>): SystemBrandConfig {
  return {
    name: normalizeName(input?.name),
    logo_url: normalizeLogo(input?.logo_url),
  };
}

function normalizeView(input?: Partial<SystemViewConfig>): SystemViewConfig {
  return {
    menu_text_visible:
      typeof input?.menu_text_visible === 'boolean'
        ? input.menu_text_visible
        : true,
  };
}

function readLocalConfig(): Partial<SystemConfig> {
  return storageReadJson<Partial<SystemConfig>>(LOCAL_SYSTEM_CONFIG_KEY, {});
}

function mergeConfig(base: SystemConfig, input: Partial<SystemConfig>): SystemConfig {
  return {
    mode: normalizeMode(input.mode ?? base.mode),
    brand: normalizeBrand({
      ...base.brand,
      ...(input.brand ?? {}),
    }),
    view: normalizeView({
      ...base.view,
      ...(input.view ?? {}),
    }),
  };
}

function dispatchUpdated(config: SystemConfig): void {
  window.dispatchEvent(
    new CustomEvent<SystemConfig>(SYSTEM_CONFIG_UPDATED_EVENT, {
      detail: config,
    }),
  );
}

function writeLocalConfig(config: SystemConfig): void {
  const saved = storageWriteJson(LOCAL_SYSTEM_CONFIG_KEY, config);
  if (!saved) return;
  dispatchUpdated(config);
}

export function getSystemConfig(): SystemConfig {
  const base = defaultConfig();
  return mergeConfig(base, readLocalConfig());
}

export function getSystemBrand(): SystemBrandConfig {
  return getSystemConfig().brand;
}

export function getAppUserMode(): AppUserMode {
  return getSystemConfig().mode;
}

export function isSuperUserMode(): boolean {
  return getAppUserMode() === 'super';
}

export function getMenuTextVisible(): boolean {
  return getSystemConfig().view.menu_text_visible;
}

export function updateAppUserMode(mode: AppUserMode): SystemConfig {
  const current = getSystemConfig();
  const next: SystemConfig = {
    ...current,
    mode: normalizeMode(mode),
  };
  writeLocalConfig(next);
  return next;
}

export function updateSystemBrand(updated: Partial<SystemBrandConfig>): SystemConfig {
  const current = getSystemConfig();
  const next: SystemConfig = {
    ...current,
    brand: normalizeBrand({
      ...current.brand,
      ...updated,
    }),
  };
  writeLocalConfig(next);
  return next;
}

export function resetSystemBrand(): SystemConfig {
  return updateSystemBrand({ name: DEFAULT_SYSTEM_NAME, logo_url: '' });
}

export function updateMenuTextVisible(menuTextVisible: boolean): SystemConfig {
  const current = getSystemConfig();
  const next: SystemConfig = {
    ...current,
    view: normalizeView({
      ...current.view,
      menu_text_visible: menuTextVisible,
    }),
  };
  writeLocalConfig(next);
  return next;
}

export function subscribeSystemConfig(
  listener: (config: SystemConfig) => void,
): () => void {
  const onUpdated = (event: Event) => {
    const customEvent = event as CustomEvent<SystemConfig>;
    if (customEvent.detail) {
      listener(customEvent.detail);
      return;
    }
    listener(getSystemConfig());
  };

  const onStorage = (event: Event) => {
    const storageEvent = event as StorageEvent;
    if (storageEvent.key && storageEvent.key !== LOCAL_SYSTEM_CONFIG_KEY) {
      return;
    }
    listener(getSystemConfig());
  };

  window.addEventListener(SYSTEM_CONFIG_UPDATED_EVENT, onUpdated);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(SYSTEM_CONFIG_UPDATED_EVENT, onUpdated);
    window.removeEventListener('storage', onStorage);
  };
}
