import { normalizeCanonicalAddress, type CanonicalAddress } from '../modules/address';
import {
  mapCanonicalPointsToContactInfo,
  mapContactInfoToCanonicalPoints,
} from '../modules/contact';
import type { ContactInfo } from '../types/contact';
import type { UserProfile } from './profileService';
import { storageReadJson, storageWriteJson } from './safeLocalStorage';

const COMPANIES_STORAGE_KEY = 'perfilsolo_companies_v1';
const ACTIVE_COMPANY_STORAGE_KEY = 'perfilsolo_active_company_by_user_v1';

export const COMPANY_MEMBERSHIP_UPDATED_EVENT = 'perfilsolo-company-membership-updated';

export interface CompanyMembership {
  id: string;
  user_id: string;
  razao_social: string;
  cnpj: string;
  ie: string;
  im: string;
  cnae: string;
  address: CanonicalAddress;
  contact: ContactInfo;
  notes: string;
  created_at: string;
  updated_at: string;
}

type CompanyMap = Record<string, CompanyMembership[]>;
type ActiveCompanyMap = Record<string, string | null>;

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeText(input: unknown): string {
  return String(input ?? '').trim();
}

function normalizeUserId(input: unknown): string {
  return normalizeText(input);
}

function normalizeContact(input: ContactInfo | null | undefined): ContactInfo {
  const points = mapContactInfoToCanonicalPoints(input ?? {});
  return mapCanonicalPointsToContactInfo(points, input ?? {});
}

function normalizeCompanyRow(
  userId: string,
  row: Partial<CompanyMembership>,
): CompanyMembership {
  return {
    id: normalizeText(row.id) || makeId('company'),
    user_id: userId,
    razao_social: normalizeText(row.razao_social),
    cnpj: normalizeText(row.cnpj),
    ie: normalizeText(row.ie),
    im: normalizeText(row.im),
    cnae: normalizeText(row.cnae),
    address: normalizeCanonicalAddress(row.address ?? {}),
    contact: normalizeContact(row.contact ?? {}),
    notes: normalizeText(row.notes),
    created_at: normalizeText(row.created_at) || nowIso(),
    updated_at: normalizeText(row.updated_at) || nowIso(),
  };
}

function emitUpdated(userId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(COMPANY_MEMBERSHIP_UPDATED_EVENT, {
      detail: { userId },
    }),
  );
}

function readCompanyMap(): CompanyMap {
  const parsed = storageReadJson<CompanyMap>(COMPANIES_STORAGE_KEY, {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed;
}

function writeCompanyMap(map: CompanyMap, changedUserId: string): void {
  const saved = storageWriteJson(COMPANIES_STORAGE_KEY, map);
  if (!saved) return;
  emitUpdated(changedUserId);
}

function readActiveCompanyMap(): ActiveCompanyMap {
  const parsed = storageReadJson<ActiveCompanyMap>(ACTIVE_COMPANY_STORAGE_KEY, {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed;
}

function writeActiveCompanyMap(map: ActiveCompanyMap): void {
  storageWriteJson(ACTIVE_COMPANY_STORAGE_KEY, map);
}

export function listCompaniesByUser(userId: string): CompanyMembership[] {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return [];
  const map = readCompanyMap();
  const rows = Array.isArray(map[normalizedUserId]) ? map[normalizedUserId] : [];
  return rows
    .map((row) => normalizeCompanyRow(normalizedUserId, row))
    .sort((a, b) => a.razao_social.localeCompare(b.razao_social, 'pt-BR'));
}

export function getActiveCompanyIdByUser(userId: string): string | null {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return null;
  const map = readActiveCompanyMap();
  const candidate = normalizeText(map[normalizedUserId]);
  return candidate || null;
}

export function setActiveCompanyByUser(userId: string, companyId: string | null): void {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return;
  const map = readActiveCompanyMap();
  map[normalizedUserId] = companyId ? normalizeText(companyId) : null;
  writeActiveCompanyMap(map);
  emitUpdated(normalizedUserId);
}

export function saveCompanyForUser(
  userId: string,
  input: Partial<CompanyMembership>,
): CompanyMembership {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    throw new Error('Usuário inválido para empresa.');
  }

  const map = readCompanyMap();
  const currentRows = Array.isArray(map[normalizedUserId]) ? map[normalizedUserId].slice() : [];
  const targetId = normalizeText(input.id);
  const now = nowIso();
  const idx = currentRows.findIndex((row) => normalizeText(row.id) === targetId);

  const nextRow = normalizeCompanyRow(normalizedUserId, {
    ...input,
    id: targetId || undefined,
    created_at: idx >= 0 ? currentRows[idx].created_at : now,
    updated_at: now,
  });

  if (idx >= 0) currentRows[idx] = nextRow;
  else currentRows.unshift(nextRow);

  map[normalizedUserId] = currentRows.map((row) =>
    normalizeCompanyRow(normalizedUserId, row),
  );
  writeCompanyMap(map, normalizedUserId);

  const activeCompanyId = getActiveCompanyIdByUser(normalizedUserId);
  if (!activeCompanyId) {
    setActiveCompanyByUser(normalizedUserId, nextRow.id);
  }

  return nextRow;
}

export function ensureCompanyBootstrapFromLegacyProfile(
  userId: string,
  profile: UserProfile | null | undefined,
): CompanyMembership[] {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return [];

  const existing = listCompaniesByUser(normalizedUserId);
  if (existing.length > 0) return existing;

  const producer = profile?.producer;
  if (!producer) return [];

  const hasLegacyCompanyData = Boolean(
    normalizeText(producer.razao_social) ||
      normalizeText(producer.cnpj) ||
      normalizeText(producer.ie) ||
      normalizeText(producer.im) ||
      normalizeText(producer.cnae) ||
      normalizeText(producer.notes) ||
      normalizeText(producer.endereco) ||
      normalizeText(producer.cidade) ||
      normalizeText(producer.estado) ||
      normalizeText(producer.contact_email) ||
      normalizeText(producer.contact_phone),
  );
  if (!hasLegacyCompanyData) return [];

  saveCompanyForUser(normalizedUserId, {
    razao_social:
      normalizeText(producer.razao_social) ||
      normalizeText(profile?.company_name) ||
      'Empresa 1',
    cnpj: normalizeText(producer.cnpj),
    ie: normalizeText(producer.ie),
    im: normalizeText(producer.im),
    cnae: normalizeText(producer.cnae),
    notes: normalizeText(producer.notes),
    address: {
      cep: producer.cep,
      street: producer.endereco,
      number: producer.numero,
      complement: producer.complemento,
      neighborhood: producer.bairro,
      city: producer.cidade,
      state: producer.estado,
    },
    contact: {
      email: producer.contact_email,
      phone: producer.contact_phone,
      website: producer.website,
    },
  });

  return listCompaniesByUser(normalizedUserId);
}
