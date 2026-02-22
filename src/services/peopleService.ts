import {
  mapCanonicalPointsToContactInfo,
  mapContactInfoToCanonicalPoints,
} from '../modules/contact';
import {
  normalizePersonType,
  normalizePersonTypes,
  type PersonTypeIdentifier,
} from '../modules/people';
import type { ContactInfo } from '../types/contact';
import { storageReadJson, storageWriteJson } from './safeLocalStorage';
import { trackGamificationEvent } from './gamificationService';

const PEOPLE_KEY = 'perfilsolo_people_v1';
const LEGACY_CLIENTS_KEY = 'perfilsolo_clients_v1';

interface LegacyClientRecord {
  id: string;
  user_id: string;
  nome: string;
  contact?: ContactInfo;
  created_at?: string;
  updated_at?: string;
}

export interface PersonRecord {
  id: string;
  user_id: string;
  name: string;
  document: string;
  types: PersonTypeIdentifier[];
  contact: ContactInfo;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ListPeopleOptions {
  types?: PersonTypeIdentifier[];
  search?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(input: unknown): string {
  return String(input ?? '').trim();
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `person-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeContact(contact?: ContactInfo): ContactInfo {
  const canonicalPoints = mapContactInfoToCanonicalPoints(contact ?? {});
  const normalizedByModule = mapCanonicalPointsToContactInfo(
    canonicalPoints,
    contact ?? {},
  );
  return {
    ...normalizedByModule,
    email: normalizeText(normalizedByModule.email),
    phone: normalizeText(normalizedByModule.phone),
    website: normalizeText(normalizedByModule.website),
    address: normalizeText(normalizedByModule.address),
  };
}

function normalizePersonRecord(
  row: Partial<PersonRecord>,
  fallbackType: PersonTypeIdentifier[] = ['customer'],
): PersonRecord {
  const createdAt = normalizeText(row.created_at) || nowIso();
  const updatedAt = normalizeText(row.updated_at) || createdAt;
  return {
    id: normalizeText(row.id) || createId(),
    user_id: normalizeText(row.user_id),
    name: normalizeText(row.name),
    document: normalizeText(row.document),
    types: normalizePersonTypes(row.types, fallbackType),
    contact: normalizeContact(row.contact),
    notes: normalizeText(row.notes),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function readLegacyClients(): LegacyClientRecord[] {
  const parsed = storageReadJson<LegacyClientRecord[]>(LEGACY_CLIENTS_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

function writeAll(rows: PersonRecord[]) {
  storageWriteJson(PEOPLE_KEY, rows);
}

function readAll(): PersonRecord[] {
  const parsed = storageReadJson<PersonRecord[]>(PEOPLE_KEY, []);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    const legacyRows = readLegacyClients();
    if (!legacyRows.length) return [];

    const migratedRows = legacyRows
      .map((row) =>
        normalizePersonRecord(
          {
            id: row.id,
            user_id: row.user_id,
            name: row.nome,
            contact: row.contact,
            created_at: row.created_at,
            updated_at: row.updated_at,
            types: ['customer'],
          },
          ['customer'],
        ),
      )
      .filter((row) => row.user_id && row.name);

    writeAll(migratedRows);
    return migratedRows;
  }

  const rows = parsed
    .map((row) => normalizePersonRecord(row))
    .filter((row) => row.user_id && row.name);

  writeAll(rows);
  return rows;
}

function findById(rows: PersonRecord[], personId: string): number {
  return rows.findIndex((row) => row.id === personId);
}

function matchesSearch(row: PersonRecord, query: string): boolean {
  const q = normalizeText(query).toLowerCase();
  if (!q) return true;
  const values = [
    row.name,
    row.document,
    row.contact.email,
    row.contact.phone,
    row.contact.website,
    row.contact.address,
    ...row.types,
  ];
  return values.some((value) => normalizeText(value).toLowerCase().includes(q));
}

export async function listPeopleByUser(
  userId: string,
  options?: ListPeopleOptions,
): Promise<PersonRecord[]> {
  const normalizedUserId = normalizeText(userId);
  const typeSet = new Set(
    (options?.types ?? [])
      .map((row) => normalizePersonType(row))
      .filter(Boolean),
  );
  const hasTypeFilter = typeSet.size > 0;

  const rows = readAll()
    .filter((row) => row.user_id === normalizedUserId)
    .filter((row) => !hasTypeFilter || row.types.some((type) => typeSet.has(type)))
    .filter((row) => matchesSearch(row, options?.search ?? ''))
    .sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return bTime - aTime;
    });

  return rows;
}

export async function listPeopleByType(
  userId: string,
  type: PersonTypeIdentifier,
): Promise<PersonRecord[]> {
  return listPeopleByUser(userId, { types: [type] });
}

export async function createPerson(input: {
  userId: string;
  name: string;
  document?: string;
  types?: PersonTypeIdentifier[];
  contact?: ContactInfo;
  notes?: string;
}): Promise<PersonRecord> {
  const name = normalizeText(input.name);
  if (name.length < 3) {
    throw new Error('Use pelo menos 3 caracteres para o nome da pessoa.');
  }

  const createdAt = nowIso();
  const row: PersonRecord = normalizePersonRecord(
    {
      id: createId(),
      user_id: normalizeText(input.userId),
      name,
      document: normalizeText(input.document),
      types: normalizePersonTypes(input.types, ['customer']),
      contact: normalizeContact(input.contact),
      notes: normalizeText(input.notes),
      created_at: createdAt,
      updated_at: createdAt,
    },
    ['customer'],
  );

  const rows = readAll();
  rows.push(row);
  writeAll(rows);
  if (row.user_id) {
    void trackGamificationEvent(row.user_id, 'person_created').catch(() => null);
  }
  return row;
}

export async function updatePerson(
  personId: string,
  input: {
    name?: string;
    document?: string;
    types?: PersonTypeIdentifier[];
    contact?: ContactInfo;
    notes?: string;
  },
): Promise<PersonRecord> {
  const rows = readAll();
  const index = findById(rows, personId);
  if (index < 0) throw new Error('Pessoa não encontrada.');

  const current = rows[index];
  const nextNameRaw =
    input.name === undefined ? current.name : normalizeText(input.name);
  if (nextNameRaw.length < 3) {
    throw new Error('Use pelo menos 3 caracteres para o nome da pessoa.');
  }

  const updated: PersonRecord = normalizePersonRecord(
    {
      ...current,
      name: nextNameRaw,
      document:
        input.document === undefined
          ? current.document
          : normalizeText(input.document),
      types:
        input.types === undefined
          ? current.types
          : normalizePersonTypes(input.types, current.types),
      contact:
        input.contact === undefined
          ? current.contact
          : normalizeContact(input.contact),
      notes: input.notes === undefined ? current.notes : normalizeText(input.notes),
      updated_at: nowIso(),
    },
    current.types,
  );

  rows[index] = updated;
  writeAll(rows);
  return updated;
}

export async function ensurePersonType(
  personId: string,
  type: PersonTypeIdentifier,
): Promise<PersonRecord> {
  const normalizedType = normalizePersonType(type);
  const rows = readAll();
  const index = findById(rows, personId);
  if (index < 0) throw new Error('Pessoa não encontrada.');

  const current = rows[index];
  if (current.types.includes(normalizedType)) return current;

  const updated = await updatePerson(personId, {
    types: [...current.types, normalizedType],
  });
  return updated;
}

export async function removePersonType(
  personId: string,
  type: PersonTypeIdentifier,
  options?: { deleteIfNoTypes?: boolean },
): Promise<PersonRecord | null> {
  const rows = readAll();
  const index = findById(rows, personId);
  if (index < 0) throw new Error('Pessoa não encontrada.');

  const current = rows[index];
  const normalizedType = normalizePersonType(type);
  const remainingTypes = current.types.filter((row) => row !== normalizedType);
  const deleteIfNoTypes = options?.deleteIfNoTypes ?? true;

  if (remainingTypes.length === 0 && deleteIfNoTypes) {
    rows.splice(index, 1);
    writeAll(rows);
    return null;
  }

  if (remainingTypes.length === current.types.length) {
    return current;
  }

  const updated = await updatePerson(personId, { types: remainingTypes });
  return updated;
}

export async function deletePerson(personId: string): Promise<void> {
  const rows = readAll().filter((row) => row.id !== personId);
  writeAll(rows);
}

export async function upsertUserProfilePerson(input: {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
}): Promise<PersonRecord> {
  const normalizedUserId = normalizeText(input.userId);
  if (!normalizedUserId) {
    throw new Error('Usuário inválido para sincronizar pessoa de perfil.');
  }

  const byType = await listPeopleByType(normalizedUserId, 'user_profile');
  const byName = byType.find(
    (row) => row.name.toLowerCase() === normalizeText(input.name).toLowerCase(),
  );
  const row = byName ?? byType[0];

  const contact: ContactInfo = normalizeContact({
    email: normalizeText(input.email),
    phone: normalizeText(input.phone),
    website: normalizeText(input.website),
    address: normalizeText(input.address),
  });

  if (row) {
    return updatePerson(row.id, {
      name: normalizeText(input.name) || row.name,
      contact: {
        ...row.contact,
        ...contact,
      },
      types: row.types.includes('user_profile')
        ? row.types
        : [...row.types, 'user_profile'],
    });
  }

  return createPerson({
    userId: normalizedUserId,
    name: normalizeText(input.name) || 'Usuário',
    types: ['user_profile'],
    contact,
  });
}

export async function listCustomersByUser(userId: string): Promise<PersonRecord[]> {
  return listPeopleByType(userId, 'customer');
}

export async function listSuppliersByUser(userId: string): Promise<PersonRecord[]> {
  return listPeopleByType(userId, 'supplier');
}

export async function listAdministratorsByUser(
  userId: string,
): Promise<PersonRecord[]> {
  return listPeopleByType(userId, 'administrator');
}
