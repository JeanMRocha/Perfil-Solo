function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function isTruthyFlag(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const normalized = normalizeToken(value);
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

const SUPER_ROLE_TOKENS = new Set([
  'super',
  'super_user',
  'superuser',
  'owner',
  'root',
  'admin',
  'administrator',
]);

const SUPER_FLAG_KEYS = [
  'super_user',
  'is_super_user',
  'is_superuser',
  'superuser',
  'owner_super',
  'is_owner_super',
  'admin',
  'is_admin',
] as const;

const SUPER_ROLE_KEYS = [
  'role',
  'roles',
  'user_role',
  'app_role',
  'permission',
  'permissions',
] as const;

type GenericRecord = Record<string, any>;

function asRecord(value: unknown): GenericRecord | null {
  if (!value || typeof value !== 'object') return null;
  return value as GenericRecord;
}

function collectCandidateEmails(input: unknown): string[] {
  const directEmail = normalizeEmail(input);
  if (directEmail) return [directEmail];

  const record = asRecord(input);
  if (!record) return [];
  const appMeta = asRecord(record.app_metadata);
  const userMeta = asRecord(record.user_metadata);

  const candidates = [
    normalizeEmail(record.email),
    normalizeEmail(record.user_email),
    normalizeEmail(appMeta?.email),
    normalizeEmail(userMeta?.email),
  ].filter((value) => value.length > 0);

  return Array.from(new Set(candidates));
}

function isSuperRoleValue(value: unknown): boolean {
  if (value == null) return false;

  if (Array.isArray(value)) {
    return value.some((item) => isSuperRoleValue(item));
  }

  if (typeof value === 'object') {
    const bag = value as GenericRecord;
    return (
      isSuperRoleValue(bag.role) ||
      isSuperRoleValue(bag.name) ||
      isSuperRoleValue(bag.id) ||
      isSuperRoleValue(bag.value)
    );
  }

  const token = normalizeToken(value);
  return SUPER_ROLE_TOKENS.has(token);
}

function hasSuperRoleOrFlag(input: unknown): boolean {
  const record = asRecord(input);
  if (!record) return false;

  const sources = [record, asRecord(record.app_metadata), asRecord(record.user_metadata)].filter(
    (item): item is GenericRecord => Boolean(item),
  );

  return sources.some((source) => {
    const hasFlag = SUPER_FLAG_KEYS.some((key) => isTruthyFlag(source[key]));
    if (hasFlag) return true;
    return SUPER_ROLE_KEYS.some((key) => isSuperRoleValue(source[key]));
  });
}

export function parseOwnerSuperEmails(input: unknown): string[] {
  const raw = String(input ?? '');
  if (!raw.trim()) return [];

  const emails = raw
    .split(/[,\s;]+/g)
    .map((item) => normalizeEmail(item))
    .filter((item) => item.length > 0);

  return Array.from(new Set(emails));
}

function resolveConfiguredOwnerEmails(): string[] {
  return Array.from(
    new Set([
      ...parseOwnerSuperEmails(import.meta.env.VITE_OWNER_SUPER_EMAIL),
      ...parseOwnerSuperEmails(import.meta.env.VITE_OWNER_SUPER_EMAILS),
    ]),
  );
}

const OWNER_SUPER_EMAILS = resolveConfiguredOwnerEmails();

export function getOwnerSuperEmails(): string[] {
  return [...OWNER_SUPER_EMAILS];
}

export function isOwnerSuperUser(
  identity: unknown,
  allowedEmails: readonly string[] = OWNER_SUPER_EMAILS,
): boolean {
  const normalizedAllowed = allowedEmails.map((item) => normalizeEmail(item));
  const candidateEmails = collectCandidateEmails(identity);
  if (candidateEmails.some((email) => normalizedAllowed.includes(email))) {
    return true;
  }

  return hasSuperRoleOrFlag(identity);
}
