import { storageReadJson, storageWriteJson } from './safeLocalStorage';

export interface RegisteredUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface UsersRegistryConfig {
  initial_credits_after_signup: number;
}

const USERS_REGISTRY_KEY = 'perfilsolo_users_registry_v1';
const USERS_CONFIG_KEY = 'perfilsolo_users_registry_config_v1';
const DEFAULT_INITIAL_CREDITS = 0;

export const USERS_REGISTRY_UPDATED_EVENT = 'perfilsolo-users-registry-updated';

function readUsers(): RegisteredUser[] {
  const parsed = storageReadJson<RegisteredUser[]>(USERS_REGISTRY_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((row) => row?.id && row?.email);
}

function writeUsers(rows: RegisteredUser[]): void {
  const saved = storageWriteJson(USERS_REGISTRY_KEY, rows);
  if (!saved) return;
  window.dispatchEvent(new CustomEvent(USERS_REGISTRY_UPDATED_EVENT));
}

function readConfig(): UsersRegistryConfig {
  const parsed = storageReadJson<Partial<UsersRegistryConfig>>(USERS_CONFIG_KEY, {});
  const initial = Number(parsed.initial_credits_after_signup);
  return {
    initial_credits_after_signup: Number.isFinite(initial)
      ? Math.max(0, Math.round(initial))
      : DEFAULT_INITIAL_CREDITS,
  };
}

function writeConfig(config: UsersRegistryConfig): void {
  const saved = storageWriteJson(USERS_CONFIG_KEY, config);
  if (!saved) return;
  window.dispatchEvent(new CustomEvent(USERS_REGISTRY_UPDATED_EVENT));
}

function normalizeEmail(input: string): string {
  return String(input ?? '').trim().toLowerCase();
}

function normalizeName(input: string, email: string): string {
  const cleaned = String(input ?? '').trim();
  if (cleaned) return cleaned;
  const fallback = email.split('@')[0] ?? 'Usuário';
  return fallback || 'Usuário';
}

export function listRegisteredUsers(): RegisteredUser[] {
  return [...readUsers()].sort((a, b) => a.email.localeCompare(b.email));
}

export function getRegisteredUserById(userId: string): RegisteredUser | null {
  const needle = String(userId ?? '').trim();
  if (!needle) return null;
  return readUsers().find((row) => row.id === needle) ?? null;
}

export function registerOrUpdateUserAccount(input: {
  id: string;
  email: string;
  name?: string;
}): RegisteredUser {
  const id = String(input.id ?? '').trim();
  const email = normalizeEmail(input.email);
  if (!id || !email) {
    throw new Error('ID e email sao obrigatorios para registrar usuário.');
  }

  const now = new Date().toISOString();
  const rows = readUsers();
  const index = rows.findIndex((row) => row.id === id || row.email === email);
  if (index >= 0) {
    const current = rows[index];
    const next: RegisteredUser = {
      ...current,
      id,
      email,
      name: normalizeName(input.name ?? current.name, email),
      updated_at: now,
    };
    rows[index] = next;
    writeUsers(rows);
    return next;
  }

  const created: RegisteredUser = {
    id,
    email,
    name: normalizeName(input.name ?? '', email),
    created_at: now,
    updated_at: now,
  };
  rows.push(created);
  writeUsers(rows);
  return created;
}

export function getInitialCreditsAfterSignup(): number {
  return readConfig().initial_credits_after_signup;
}

export function setInitialCreditsAfterSignup(value: number): number {
  const normalized = Math.max(0, Math.round(Number(value) || 0));
  writeConfig({ initial_credits_after_signup: normalized });
  return normalized;
}
