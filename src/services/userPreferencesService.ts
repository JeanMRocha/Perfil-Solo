import { storageReadJson, storageWriteJson } from './safeLocalStorage';

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

function normalizeMode(value: unknown): AppUserMode {
  return value === 'super' ? 'super' : 'normal';
}

function normalizeView(input?: Partial<UserViewPreferences>): UserViewPreferences {
  return {
    menu_text_visible:
      typeof input?.menu_text_visible === 'boolean'
        ? input.menu_text_visible
        : true,
  };
}

function normalizePreferences(input?: Partial<UserPreferences>): UserPreferences {
  const defaults = defaultPreferences();
  return {
    mode: normalizeMode(input?.mode ?? defaults.mode),
    view: normalizeView({
      ...defaults.view,
      ...(input?.view ?? {}),
    }),
  };
}

function storageKeyForUser(userId: string): string {
  return `${USER_PREFERENCES_KEY_PREFIX}:${userId}`;
}

function readUserPreferences(userId: string): UserPreferences {
  const parsed = storageReadJson<Partial<UserPreferences>>(
    storageKeyForUser(userId),
    {},
  );
  return normalizePreferences(parsed);
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

export function getUserPreferences(userId?: string): UserPreferences {
  const normalized = normalizeUserId(userId);
  if (!normalized) return defaultPreferences();
  return readUserPreferences(normalized);
}

export function getUserAppMode(userId?: string): AppUserMode {
  return getUserPreferences(userId).mode;
}

export function getUserMenuTextVisible(userId?: string): boolean {
  return getUserPreferences(userId).view.menu_text_visible;
}

export function updateUserAppMode(mode: AppUserMode, userId?: string): UserPreferences {
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    return normalizePreferences({
      ...defaultPreferences(),
      mode: normalizeMode(mode),
    });
  }

  const current = readUserPreferences(normalized);
  const next = normalizePreferences({
    ...current,
    mode: normalizeMode(mode),
  });
  return writeUserPreferences(normalized, next);
}

export function updateUserMenuTextVisible(
  menuTextVisible: boolean,
  userId?: string,
): UserPreferences {
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    return normalizePreferences({
      ...defaultPreferences(),
      view: { menu_text_visible: menuTextVisible },
    });
  }

  const current = readUserPreferences(normalized);
  const next = normalizePreferences({
    ...current,
    view: {
      ...current.view,
      menu_text_visible: menuTextVisible,
    },
  });
  return writeUserPreferences(normalized, next);
}

export function subscribeUserPreferences(
  userId: string,
  listener: (prefs: UserPreferences) => void,
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
      listener(normalizePreferences(custom.detail.prefs));
      return;
    }
    listener(readUserPreferences(normalized));
  };

  const onStorage = (event: Event) => {
    const storageEvent = event as StorageEvent;
    if (storageEvent.key && storageEvent.key !== storageKeyForUser(normalized)) return;
    listener(readUserPreferences(normalized));
  };

  window.addEventListener(USER_PREFERENCES_UPDATED_EVENT, onUpdated);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(USER_PREFERENCES_UPDATED_EVENT, onUpdated);
    window.removeEventListener('storage', onStorage);
  };
}
