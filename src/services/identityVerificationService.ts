import {
  storageReadJson,
  storageRemove,
  storageWriteJson,
} from './safeLocalStorage';

export type IdentityChallengeReason = 'login' | 'recovery';

interface IdentityChallenge {
  email: string;
  reason: IdentityChallengeReason;
  code: string;
  sent_at: string;
  expires_at: string;
  attempts: number;
}

interface IdentityChallengeRequestResult {
  email: string;
  reason: IdentityChallengeReason;
  expires_at: string;
  debug_code: string;
}

const CHALLENGE_STORAGE_KEY = 'perfilsolo_identity_challenges_v1';
const VERIFIED_EMAILS_SESSION_KEY = 'perfilsolo_identity_verified_emails_v1';
const CODE_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_ATTEMPTS = 5;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeEmail(input?: string): string {
  return String(input ?? '').trim().toLowerCase();
}

function normalizeCode(input?: string): string {
  return String(input ?? '').trim().replace(/\s+/g, '');
}

function readChallenges(): IdentityChallenge[] {
  const parsed = storageReadJson<IdentityChallenge[]>(CHALLENGE_STORAGE_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeChallenges(rows: IdentityChallenge[]): void {
  storageWriteJson(CHALLENGE_STORAGE_KEY, rows);
}

function readVerifiedEmails(): string[] {
  const parsed = storageReadJson<string[]>(VERIFIED_EMAILS_SESSION_KEY, [], 'session');
  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.map((row) => normalizeEmail(row)).filter(Boolean))];
}

function writeVerifiedEmails(rows: string[]): void {
  storageWriteJson(VERIFIED_EMAILS_SESSION_KEY, rows, 'session');
}

function removeChallenge(email: string, reason: IdentityChallengeReason): void {
  const rows = readChallenges().filter(
    (row) => !(row.email === email && row.reason === reason),
  );
  writeChallenges(rows);
}

function buildCode(): string {
  const random = Math.floor(Math.random() * 1000000);
  return random.toString().padStart(6, '0');
}

function isExpired(row: IdentityChallenge): boolean {
  const expiry = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expiry)) return true;
  return Date.now() >= expiry;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function clearExpiredIdentityChallenges(): void {
  const rows = readChallenges().filter((row) => !isExpired(row));
  writeChallenges(rows);
}

export function requestIdentityChallengeCode(input: {
  email: string;
  reason: IdentityChallengeReason;
}): IdentityChallengeRequestResult {
  clearExpiredIdentityChallenges();

  const email = normalizeEmail(input.email);
  const reason = input.reason;

  if (!isValidEmail(email)) {
    throw new Error('Informe um email valido para verificacao de identidade.');
  }

  const rows = readChallenges();
  const current = rows.find((row) => row.email === email && row.reason === reason);
  if (current) {
    const lastSent = new Date(current.sent_at).getTime();
    if (Number.isFinite(lastSent)) {
      const elapsedSeconds = Math.floor((Date.now() - lastSent) / 1000);
      if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
        const wait = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
        throw new Error(`Aguarde ${wait}s para reenviar o codigo.`);
      }
    }
  }

  const code = buildCode();
  const sentAt = nowIso();
  const expiresAt = new Date(
    Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000,
  ).toISOString();
  const nextRow: IdentityChallenge = {
    email,
    reason,
    code,
    sent_at: sentAt,
    expires_at: expiresAt,
    attempts: 0,
  };

  const nextRows = rows.filter(
    (row) => !(row.email === email && row.reason === reason),
  );
  nextRows.push(nextRow);
  writeChallenges(nextRows);

  return {
    email,
    reason,
    expires_at: expiresAt,
    debug_code: code,
  };
}

export function verifyIdentityChallengeCode(input: {
  email: string;
  reason: IdentityChallengeReason;
  code: string;
}): boolean {
  clearExpiredIdentityChallenges();

  const email = normalizeEmail(input.email);
  const code = normalizeCode(input.code);
  const reason = input.reason;

  if (!email || !code) {
    throw new Error('Email e codigo sao obrigatorios para verificacao.');
  }

  const rows = readChallenges();
  const index = rows.findIndex((row) => row.email === email && row.reason === reason);
  if (index < 0) {
    throw new Error('Nao existe codigo pendente para este email.');
  }

  const target = rows[index];
  if (isExpired(target)) {
    removeChallenge(email, reason);
    throw new Error('Codigo expirado. Solicite um novo codigo.');
  }

  if (target.code !== code) {
    const nextAttempts = target.attempts + 1;
    if (nextAttempts >= MAX_ATTEMPTS) {
      removeChallenge(email, reason);
      throw new Error('Limite de tentativas excedido. Solicite um novo codigo.');
    }

    rows[index] = {
      ...target,
      attempts: nextAttempts,
    };
    writeChallenges(rows);
    throw new Error(`Codigo invalido. Tentativa ${nextAttempts}/${MAX_ATTEMPTS}.`);
  }

  removeChallenge(email, reason);
  return true;
}

export function markTwoFactorVerifiedSession(email: string): void {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const rows = readVerifiedEmails();
  if (rows.includes(normalized)) return;
  rows.push(normalized);
  writeVerifiedEmails(rows);
}

export function isTwoFactorVerifiedForEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return readVerifiedEmails().includes(normalized);
}

export function clearTwoFactorVerificationSession(email?: string): void {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    storageRemove(VERIFIED_EMAILS_SESSION_KEY, 'session');
    return;
  }
  const next = readVerifiedEmails().filter((row) => row !== normalized);
  writeVerifiedEmails(next);
}
