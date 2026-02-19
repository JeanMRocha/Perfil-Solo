export type StorageKind = 'local' | 'session';

function resolveStorage(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function storageGetRaw(
  key: string,
  kind: StorageKind = 'local',
): string | null {
  const storage = resolveStorage(kind);
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSetRaw(
  key: string,
  value: string,
  kind: StorageKind = 'local',
): boolean {
  const storage = resolveStorage(kind);
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(
  key: string,
  kind: StorageKind = 'local',
): boolean {
  const storage = resolveStorage(kind);
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function storageReadJson<T>(
  key: string,
  fallback: T,
  kind: StorageKind = 'local',
): T {
  const raw = storageGetRaw(key, kind);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function storageWriteJson<T>(
  key: string,
  value: T,
  kind: StorageKind = 'local',
): boolean {
  try {
    return storageSetRaw(key, JSON.stringify(value), kind);
  } catch {
    return false;
  }
}
