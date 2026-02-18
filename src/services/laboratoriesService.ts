const LABORATORIES_KEY = 'perfilsolo_laboratories_v1';

export interface LaboratoryService {
  id: string;
  nome: string;
  preco: number;
  descricao?: string;
}

export interface LaboratoryRecord {
  id: string;
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
  try {
    const raw = localStorage.getItem(LABORATORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LaboratoryRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeAllLabs(rows: LaboratoryRecord[]) {
  localStorage.setItem(LABORATORIES_KEY, JSON.stringify(rows));
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

export async function listLaboratories(): Promise<LaboratoryRecord[]> {
  return readAllLabs().sort((a, b) => {
    const aTime = new Date(a.updated_at ?? a.created_at).getTime();
    const bTime = new Date(b.updated_at ?? b.created_at).getTime();
    return bTime - aTime;
  });
}

export async function upsertLaboratory(input: {
  id?: string;
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
): Promise<LaboratoryRecord | null> {
  const candidate = labName?.trim().toLowerCase();
  if (!candidate) return null;
  const rows = await listLaboratories();
  return (
    rows.find((row) => row.nome.trim().toLowerCase() === candidate) ?? null
  );
}
