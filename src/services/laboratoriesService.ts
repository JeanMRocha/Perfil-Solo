import { storageReadJson, storageWriteJson } from './safeLocalStorage';

const LABORATORIES_KEY = 'perfilsolo_laboratories_v1';

export interface LaboratoryService {
  id: string;
  nome: string;
  preco: number;
  descricao?: string;
}

export interface LaboratoryRecord {
  id: string;
  user_id: string;
  nome: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  servicos: LaboratoryService[];
  created_at: string;
  updated_at: string;
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'lab') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readAllLabs(): LaboratoryRecord[] {
  const parsed = storageReadJson<Partial<LaboratoryRecord>[]>(LABORATORIES_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((row): row is Partial<LaboratoryRecord> => row != null)
    .map((row) => ({
      id: row.id ?? createId('lab'),
      user_id: row.user_id ?? 'local-user',
      nome: row.nome ?? 'Laboratorio',
      cnpj: row.cnpj,
      email: row.email,
      telefone: row.telefone,
      endereco: row.endereco,
      servicos: Array.isArray(row.servicos) ? row.servicos : [],
      created_at: row.created_at ?? nowIso(),
      updated_at: row.updated_at ?? row.created_at ?? nowIso(),
    }));
}

function writeAllLabs(rows: LaboratoryRecord[]) {
  storageWriteJson(LABORATORIES_KEY, rows);
}

function normalizeText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeServices(
  rows: LaboratoryService[] | null | undefined,
): LaboratoryService[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const nome = row?.nome?.trim() ?? '';
      const preco = Number(row?.preco);
      if (!nome || !Number.isFinite(preco) || preco < 0) return null;
      return {
        id: row.id || createId('srv'),
        nome,
        preco,
        descricao: normalizeText(row.descricao),
      } as LaboratoryService;
    })
    .filter((row): row is LaboratoryService => row != null);
}

export async function listLaboratories(userId?: string): Promise<LaboratoryRecord[]> {
  return readAllLabs()
    .filter((row) => !userId || row.user_id === userId)
    .sort((a, b) => {
    const aTime = new Date(a.updated_at ?? a.created_at).getTime();
    const bTime = new Date(b.updated_at ?? b.created_at).getTime();
    return bTime - aTime;
  });
}

export async function upsertLaboratory(input: {
  id?: string;
  userId?: string;
  nome: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  servicos?: LaboratoryService[];
}): Promise<LaboratoryRecord> {
  const rows = readAllLabs();
  const current = input.id ? rows.find((row) => row.id === input.id) : null;
  const createdAt = current?.created_at ?? nowIso();
  const normalized: LaboratoryRecord = {
    id: current?.id ?? input.id ?? createId('lab'),
    user_id: current?.user_id ?? input.userId ?? 'local-user',
    nome: input.nome.trim(),
    cnpj: normalizeText(input.cnpj),
    email: normalizeText(input.email),
    telefone: normalizeText(input.telefone),
    endereco: normalizeText(input.endereco),
    servicos: normalizeServices(input.servicos),
    created_at: createdAt,
    updated_at: nowIso(),
  };

  const index = rows.findIndex((row) => row.id === normalized.id);
  if (index >= 0) {
    rows[index] = normalized;
  } else {
    rows.push(normalized);
  }
  writeAllLabs(rows);
  return normalized;
}

export async function deleteLaboratory(labId: string): Promise<void> {
  const rows = readAllLabs().filter((row) => row.id !== labId);
  writeAllLabs(rows);
}

export async function findLaboratoryByName(
  labName: string | null | undefined,
  userId?: string,
): Promise<LaboratoryRecord | null> {
  const candidate = labName?.trim().toLowerCase();
  if (!candidate) return null;
  const rows = await listLaboratories(userId);
  return (
    rows.find((row) => row.nome.trim().toLowerCase() === candidate) ?? null
  );
}
