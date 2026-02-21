import type { ContactInfo } from '../types/contact';
import {
  createPerson,
  ensurePersonType,
  listPeopleByType,
  removePersonType,
  type PersonRecord,
  updatePerson,
} from './peopleService';

export interface ClientRecord {
  id: string;
  user_id: string;
  nome: string;
  contact: ContactInfo;
  created_at: string;
  updated_at: string;
}

function mapPersonToClient(row: PersonRecord): ClientRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    nome: row.name,
    contact: row.contact,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listClientsByUser(userId: string): Promise<ClientRecord[]> {
  const rows = await listPeopleByType(userId, 'customer');
  return rows.map(mapPersonToClient);
}

export async function createClient(input: {
  userId: string;
  nome: string;
  contact?: ContactInfo;
}): Promise<ClientRecord> {
  const row = await createPerson({
    userId: input.userId,
    name: input.nome,
    types: ['customer'],
    contact: input.contact,
  });
  return mapPersonToClient(row);
}

export async function updateClient(
  clientId: string,
  input: { nome?: string; contact?: ContactInfo },
): Promise<ClientRecord> {
  let row = await updatePerson(clientId, {
    name: input.nome,
    contact: input.contact,
  });
  row = await ensurePersonType(row.id, 'customer');
  return mapPersonToClient(row);
}

export async function deleteClient(clientId: string): Promise<void> {
  await removePersonType(clientId, 'customer', { deleteIfNoTypes: true });
}
