import { storageGetRaw, storageWriteJson } from './safeLocalStorage';

const NOTIFICATIONS_KEY_PREFIX = 'perfilsolo_notifications_v1';
const NOTIFICATION_RETENTION_DAYS = 20;
const MAX_NOTIFICATIONS_PER_USER = 400;
const MAX_NOTIFICATION_TITLE_LENGTH = 120;
const MAX_NOTIFICATION_MESSAGE_LENGTH = 1500;

export const APP_NOTIFICATIONS_UPDATED_EVENT = 'perfilsolo:notifications-updated';

export type AppNotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  level: AppNotificationLevel;
  created_at: string;
  read_at?: string | null;
  expires_at?: string | null;
}

type NotificationInsertInput = {
  title: string;
  message: string;
  level?: AppNotificationLevel;
  expires_at?: string | null;
};

type TemporaryNotificationTemplate = {
  title: string;
  message: string;
  level: AppNotificationLevel;
  expires_in_days: number;
};

const TEMP_PROGRESS_NOTIFICATIONS: TemporaryNotificationTemplate[] = [
  {
    title: 'Trilha Fase 1 ativa',
    message:
      'A base gamificada foi iniciada. Cards e graficos antigos foram removidos para reconstruir o painel.',
    level: 'success',
    expires_in_days: 30,
  },
  {
    title: 'Missao em progresso: propriedades',
    message:
      'Definir mapa de propriedades e talhoes como base de jogo. Esta missao e temporaria e pode mudar por fase.',
    level: 'info',
    expires_in_days: 30,
  },
  {
    title: 'Missao em progresso: analises',
    message:
      'Conectar o fluxo de analises ao novo painel gamificado. Notificacao temporaria para acompanhamento da fase.',
    level: 'info',
    expires_in_days: 30,
  },
  {
    title: 'Missao pendente: economia',
    message:
      'Adicionar conquistas e moedas no loop principal do produto. Item temporario para planejamento da fase atual.',
    level: 'warning',
    expires_in_days: 30,
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function addDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function toTime(dateLike: string | null | undefined): number {
  if (!dateLike) return 0;
  const time = new Date(dateLike).getTime();
  return Number.isFinite(time) ? time : 0;
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `notif-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getStorageKey(userId: string): string {
  return `${NOTIFICATIONS_KEY_PREFIX}:${userId}`;
}

function cleanText(input: unknown, maxLength: number, fallback = ''): string {
  const raw = String(input ?? fallback);
  const compact = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (!compact) return fallback;
  return compact.slice(0, maxLength);
}

function emitUpdated(userId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(APP_NOTIFICATIONS_UPDATED_EVENT, {
      detail: { userId },
    }),
  );
}

function parseRows(raw: string | null, userId: string): AppNotification[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Partial<AppNotification>[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((row): row is Partial<AppNotification> => row != null)
      .map((row) => ({
        id: row.id ?? createId(),
        user_id: row.user_id ?? userId,
        title: cleanText(row.title, MAX_NOTIFICATION_TITLE_LENGTH, 'Notificacao'),
        message: cleanText(row.message, MAX_NOTIFICATION_MESSAGE_LENGTH, ''),
        level:
          row.level === 'success' ||
          row.level === 'warning' ||
          row.level === 'error'
            ? row.level
            : 'info',
        created_at: row.created_at ?? nowIso(),
        read_at: row.read_at ?? null,
        expires_at: row.expires_at ?? null,
      }));
  } catch {
    return [];
  }
}

function readRows(userId: string): AppNotification[] {
  const raw = storageGetRaw(getStorageKey(userId));
  return parseRows(raw, userId).slice(0, MAX_NOTIFICATIONS_PER_USER);
}

function writeRows(userId: string, rows: AppNotification[]): boolean {
  const trimmed = rows.slice(0, MAX_NOTIFICATIONS_PER_USER);
  const saved = storageWriteJson(getStorageKey(userId), trimmed);
  if (saved) {
    return true;
  }
  const fallback = trimmed.slice(0, Math.max(50, Math.floor(trimmed.length / 2)));
  return storageWriteJson(getStorageKey(userId), fallback);
}

function isExpired(row: AppNotification, nowTime = Date.now()): boolean {
  const expiry = toTime(row.expires_at);
  if (!expiry) return false;
  return nowTime >= expiry;
}

function shouldDeleteRow(row: AppNotification, nowTime = Date.now()): boolean {
  const retentionMs = NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const readTime = toTime(row.read_at);
  if (readTime > 0 && nowTime - readTime >= retentionMs) return true;

  const expiry = toTime(row.expires_at);
  if (expiry > 0 && nowTime - expiry >= retentionMs) return true;

  return false;
}

function sortDesc(rows: AppNotification[]): AppNotification[] {
  return [...rows].sort(
    (a, b) => toTime(b.created_at) - toTime(a.created_at),
  );
}

export async function cleanupNotifications(userId: string): Promise<void> {
  const rows = readRows(userId);
  const nowTime = Date.now();
  const cleaned = rows.filter((row) => !shouldDeleteRow(row, nowTime));
  if (cleaned.length !== rows.length) {
    if (writeRows(userId, cleaned)) {
      emitUpdated(userId);
    }
  }
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  await cleanupNotifications(userId);
  return sortDesc(readRows(userId));
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  await cleanupNotifications(userId);
  const nowTime = Date.now();
  return readRows(userId).filter(
    (row) => !row.read_at && !isExpired(row, nowTime),
  ).length;
}

export async function createNotification(
  userId: string,
  input: NotificationInsertInput,
): Promise<AppNotification> {
  const normalizedUserId = cleanText(userId, 120, '');
  if (!normalizedUserId) {
    throw new Error('Usuario invalido para notificacao.');
  }

  const rows = readRows(normalizedUserId);
  const row: AppNotification = {
    id: createId(),
    user_id: normalizedUserId,
    title: cleanText(input.title, MAX_NOTIFICATION_TITLE_LENGTH, 'Notificacao'),
    message: cleanText(input.message, MAX_NOTIFICATION_MESSAGE_LENGTH, ''),
    level: input.level ?? 'info',
    created_at: nowIso(),
    read_at: null,
    expires_at: input.expires_at ?? null,
  };

  if (writeRows(normalizedUserId, [row, ...rows])) {
    emitUpdated(normalizedUserId);
  }
  return row;
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  const rows = readRows(userId);
  const next = rows.map((row) =>
    row.id === notificationId ? { ...row, read_at: row.read_at ?? nowIso() } : row,
  );
  if (writeRows(userId, next)) {
    emitUpdated(userId);
  }
}

export async function markNotificationUnread(
  userId: string,
  notificationId: string,
): Promise<void> {
  const rows = readRows(userId);
  const next = rows.map((row) =>
    row.id === notificationId ? { ...row, read_at: null } : row,
  );
  if (writeRows(userId, next)) {
    emitUpdated(userId);
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const now = nowIso();
  const nowTime = Date.now();
  const rows = readRows(userId);
  const next = rows.map((row) => {
    if (row.read_at) return row;
    if (isExpired(row, nowTime)) return row;
    return { ...row, read_at: now };
  });
  if (writeRows(userId, next)) {
    emitUpdated(userId);
  }
}

export async function deleteNotification(
  userId: string,
  notificationId: string,
): Promise<void> {
  const rows = readRows(userId);
  const next = rows.filter((row) => row.id !== notificationId);
  if (writeRows(userId, next)) {
    emitUpdated(userId);
  }
}

export async function clearAllNotifications(userId: string): Promise<void> {
  if (writeRows(userId, [])) {
    emitUpdated(userId);
  }
}

export async function ensureTemporaryProgressNotifications(
  userId: string,
): Promise<void> {
  const normalizedUserId = cleanText(userId, 120, '');
  if (!normalizedUserId) return;

  const rows = readRows(normalizedUserId);
  const existingSignatures = new Set(
    rows.map((row) => `${row.title}::${row.message}`),
  );

  const missing = TEMP_PROGRESS_NOTIFICATIONS.filter((template) => {
    const signature = `${template.title}::${template.message}`;
    return !existingSignatures.has(signature);
  });

  if (missing.length === 0) return;

  const createdRows: AppNotification[] = missing.map((template) => ({
    id: createId(),
    user_id: normalizedUserId,
    title: template.title,
    message: template.message,
    level: template.level,
    created_at: nowIso(),
    read_at: null,
    expires_at: addDaysIso(template.expires_in_days),
  }));

  if (writeRows(normalizedUserId, [...createdRows, ...rows])) {
    emitUpdated(normalizedUserId);
  }
}
