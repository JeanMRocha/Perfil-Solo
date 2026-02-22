import { storageReadJson, storageWriteJson } from './safeLocalStorage';
import { isOwnerSuperUser } from './superAccessService';

export type AppUserMode = 'normal' | 'super';

export interface UserViewPreferences {
  menu_text_visible: boolean;
}

export interface UserPreferences {
  mode: AppUserMode;
  view: UserViewPreferences;
}

const USER_PREFERENCES_KEY_PREFIX = 'perfilsolo_user_preferences_v1';
export const USER_PREFERENCES_UPDATED_EVENT = 'perfilsolo-user-preferences-updated';

function normalizeUserId(input: string | undefined | null): string {
  return String(input ?? '').trim();
}

function defaultPreferences(): UserPreferences {
  return {
    mode: 'normal',
    view: {
      menu_text_visible: true,
    },
  };
}

function normalizeMode(value: unknown, superAccessIdentity?: unknown): AppUserMode {
  if (value !== 'super') return 'normal';
  return isOwnerSuperUser(superAccessIdentity) ? 'super' : 'normal';
}

function normalizeView(input?: Partial<UserViewPreferences>): UserViewPreferences {
  return {
    menu_text_visible:
      typeof input?.menu_text_visible === 'boolean'
        ? input.menu_text_visible
        : true,
  };
}

function normalizePreferences(
  input?: Partial<UserPreferences>,
  superAccessIdentity?: unknown,
): UserPreferences {
  const defaults = defaultPreferences();
  return {
    mode: normalizeMode(input?.mode ?? defaults.mode, superAccessIdentity),
    view: normalizeView({
      ...defaults.view,
      ...(input?.view ?? {}),
    }),
  };
}

function storageKeyForUser(userId: string): string {
  return `${USER_PREFERENCES_KEY_PREFIX}:${userId}`;
}

function readUserPreferences(userId: string, superAccessIdentity?: unknown): UserPreferences {
  const parsed = storageReadJson<Partial<UserPreferences>>(
    storageKeyForUser(userId),
    {},
  );
  return normalizePreferences(parsed, superAccessIdentity);
}

function emitUpdated(userId: string, prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(USER_PREFERENCES_UPDATED_EVENT, {
      detail: { userId, prefs },
    }),
  );
}

function writeUserPreferences(userId: string, next: UserPreferences): UserPreferences {
  const saved = storageWriteJson(storageKeyForUser(userId), next);
  if (saved) {
    emitUpdated(userId, next);
  }
  return next;
}

export function getUserPreferences(
  userId?: string,
  superAccessIdentity?: unknown,
): UserPreferences {
  const normalized = normalizeUserId(userId);
  if (!normalized) return defaultPreferences();
  return readUserPreferences(normalized, superAccessIdentity);
}

export function getUserAppMode(userId?: string, superAccessIdentity?: unknown): AppUserMode {
  return getUserPreferences(userId, superAccessIdentity).mode;
}

export function getUserMenuTextVisible(userId?: string, superAccessIdentity?: unknown): boolean {
  return getUserPreferences(userId, superAccessIdentity).view.menu_text_visible;
}

export function updateUserAppMode(
  mode: AppUserMode,
  userId?: string,
  superAccessIdentity?: unknown,
): UserPreferences {
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    return normalizePreferences({
      ...defaultPreferences(),
      mode: normalizeMode(mode, superAccessIdentity),
    }, superAccessIdentity);
  }

  const current = readUserPreferences(normalized, superAccessIdentity);
  const next = normalizePreferences({
    ...current,
    mode: normalizeMode(mode, superAccessIdentity),
  }, superAccessIdentity);
  if (next.mode === current.mode) return current;
  return writeUserPreferences(normalized, next);
}

export function updateUserMenuTextVisible(
  menuTextVisible: boolean,
  userId?: string,
  superAccessIdentity?: unknown,
): UserPreferences {
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    return normalizePreferences({
      ...defaultPreferences(),
      view: { menu_text_visible: menuTextVisible },
    }, superAccessIdentity);
  }

  const current = readUserPreferences(normalized, superAccessIdentity);
  const next = normalizePreferences({
    ...current,
    view: {
      ...current.view,
      menu_text_visible: menuTextVisible,
    },
  }, superAccessIdentity);
  if (next.view.menu_text_visible === current.view.menu_text_visible) return current;
  return writeUserPreferences(normalized, next);
}

export function subscribeUserPreferences(
  userId: string,
  listener: (prefs: UserPreferences) => void,
  superAccessIdentity?: unknown,
): () => void {
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    listener(defaultPreferences());
    return () => undefined;
  }

  const onUpdated = (event: Event) => {
    const custom = event as CustomEvent<{ userId?: string; prefs?: UserPreferences }>;
    const changedUserId = normalizeUserId(custom.detail?.userId);
    if (changedUserId && changedUserId !== normalized) return;
    if (custom.detail?.prefs) {
      listener(normalizePreferences(custom.detail.prefs, superAccessIdentity));
      return;
    }
    listener(readUserPreferences(normalized, superAccessIdentity));
  };

  const onStorage = (event: Event) => {
    const storageEvent = event as StorageEvent;
    if (storageEvent.key && storageEvent.key !== storageKeyForUser(normalized)) return;
    listener(readUserPreferences(normalized, superAccessIdentity));
  };

  window.addEventListener(USER_PREFERENCES_UPDATED_EVENT, onUpdated);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(USER_PREFERENCES_UPDATED_EVENT, onUpdated);
    window.removeEventListener('storage', onStorage);
  };
}
