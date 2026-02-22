import { storageReadJson, storageWriteJson } from './safeLocalStorage';

const LOGIN_HISTORY_KEY = 'perfilsolo_login_history_v1';
const MAX_LOGIN_HISTORY_PER_USER = 10;

export const LOGIN_HISTORY_UPDATED_EVENT = 'perfilsolo-login-history-updated';

export interface LoginHistoryEntry {
  id: string;
  user_id: string;
  email: string;
  provider: 'local' | 'supabase' | 'unknown';
  source: string;
  created_at: string;
  browser: string;
  platform: string;
}

type LoginHistoryMap = Record<string, LoginHistoryEntry[]>;

function normalizeUserId(input: unknown): string {
  return String(input ?? '').trim();
}

function normalizeEmail(input: unknown): string {
  return String(input ?? '').trim().toLowerCase();
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function resolvePlatform(): string {
  if (typeof navigator === 'undefined') return 'desconhecido';
  const value =
    String((navigator as any).userAgentData?.platform ?? '').trim() ||
    String(navigator.platform ?? '').trim();
  return value || 'desconhecido';
}

function resolveBrowserFromUserAgent(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (!ua) return 'desconhecido';
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
  if (ua.includes('chrome/')) return 'Chrome';
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari';
  if (ua.includes('firefox/')) return 'Firefox';
  if (ua.includes('trident/') || ua.includes('msie')) return 'Internet Explorer';
  return 'desconhecido';
}

function readHistoryMap(): LoginHistoryMap {
  const rows = storageReadJson<LoginHistoryMap>(LOGIN_HISTORY_KEY, {});
  if (!rows || typeof rows !== 'object' || Array.isArray(rows)) return {};
  return rows;
}

function emitHistoryUpdated(userId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(LOGIN_HISTORY_UPDATED_EVENT, {
      detail: { userId },
    }),
  );
}

function writeHistoryMap(map: LoginHistoryMap, changedUserId: string): void {
  const saved = storageWriteJson(LOGIN_HISTORY_KEY, map);
  if (!saved) return;
  emitHistoryUpdated(changedUserId);
}

export function listLoginHistoryForUser(
  userId: string,
  limit = MAX_LOGIN_HISTORY_PER_USER,
): LoginHistoryEntry[] {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return [];
  const max = Math.max(1, Math.round(Number(limit) || MAX_LOGIN_HISTORY_PER_USER));
  const map = readHistoryMap();
  const rows = Array.isArray(map[normalizedUserId]) ? map[normalizedUserId] : [];
  return rows
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, max);
}

export function registerLoginHistoryEntry(input: {
  user_id: string;
  email?: string;
  provider?: 'local' | 'supabase' | 'unknown';
  source?: string;
  created_at?: string;
  user_agent?: string;
  platform?: string;
}): LoginHistoryEntry | null {
  const userId = normalizeUserId(input.user_id);
  if (!userId) return null;

  const map = readHistoryMap();
  const current = Array.isArray(map[userId]) ? map[userId].slice() : [];
  const now = input.created_at && String(input.created_at).trim() ? String(input.created_at) : nowIso();
  const email = normalizeEmail(input.email);
  const source = String(input.source ?? 'login').trim() || 'login';
  const provider = input.provider ?? 'unknown';
  const browser = resolveBrowserFromUserAgent(
    String(input.user_agent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')),
  );
  const platform = String(input.platform ?? resolvePlatform()).trim() || 'desconhecido';

  const mostRecent = current[0];
  if (mostRecent) {
    const deltaMs = Math.abs(new Date(now).getTime() - new Date(mostRecent.created_at).getTime());
    if (
      Number.isFinite(deltaMs) &&
      deltaMs <= 15_000 &&
      mostRecent.source === source &&
      mostRecent.provider === provider
    ) {
      return mostRecent;
    }
  }

  const row: LoginHistoryEntry = {
    id: makeId('login'),
    user_id: userId,
    email,
    provider,
    source,
    created_at: now,
    browser,
    platform,
  };

  const nextRows = [row, ...current]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, MAX_LOGIN_HISTORY_PER_USER);

  map[userId] = nextRows;
  writeHistoryMap(map, userId);
  return row;
}
