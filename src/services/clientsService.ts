import type { ContactInfo } from '../types/contact';

const CLIENTS_KEY = 'perfilsolo_clients_v1';

export interface ClientRecord {
  id: string;
  user_id: string;
  nome: string;
  contact: ContactInfo;
  created_at: string;
  updated_at: string;
}

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readAll(): ClientRecord[] {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClientRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeAll(rows: ClientRecord[]) {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(rows));
}

export async function listClientsByUser(userId: string): Promise<ClientRecord[]> {
  const rows = readAll()
    .filter((row) => row.user_id === userId)
    .sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return bTime - aTime;
    });
  return rows;
}

export async function createClient(input: {
  userId: string;
  nome: string;
  contact?: ContactInfo;
}): Promise<ClientRecord> {
  const createdAt = nowIso();
  const row: ClientRecord = {
    id: createId(),
    user_id: input.userId,
    nome: input.nome.trim(),
    contact: input.contact ?? {},
    created_at: createdAt,
    updated_at: createdAt,
  };
  const rows = readAll();
  rows.push(row);
  writeAll(rows);
  return row;
}

export async function updateClient(
  clientId: string,
  input: { nome?: string; contact?: ContactInfo },
): Promise<ClientRecord> {
  const rows = readAll();
  const index = rows.findIndex((row) => row.id === clientId);
  if (index < 0) throw new Error('Cliente nao encontrado.');

  const current = rows[index];
  const updated: ClientRecord = {
    ...current,
    nome: input.nome?.trim() || current.nome,
    contact: input.contact ?? current.contact,
    updated_at: nowIso(),
  };
  rows[index] = updated;
  writeAll(rows);
  return updated;
}

export async function deleteClient(clientId: string): Promise<void> {
  const rows = readAll().filter((row) => row.id !== clientId);
  writeAll(rows);
}
