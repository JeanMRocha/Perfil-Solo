import localforage from 'localforage';
import type { Property, Talhao } from '../types/property';

type LocalForage = ReturnType<typeof localforage.createInstance>;

export type AnalysisRow = {
  id: string;
  user_id: string;
  property_id: string;
  talhao_id: string;
  data_amostragem: string;
  profundidade: string;
  laboratorio?: string;
  raw: Record<string, any>;
  normalized: Record<string, any>;
  executions: Record<string, any>;
  alerts: any[];
  ruleset_frozen: boolean;
  created_at: string;
  updated_at: string;
};

const dbName = 'perfilsolo_local_db';

const propertiesStore = localforage.createInstance({
  name: dbName,
  storeName: 'properties',
});

const talhoesStore = localforage.createInstance({
  name: dbName,
  storeName: 'talhoes',
});

const analysesStore = localforage.createInstance({
  name: dbName,
  storeName: 'analises_solo',
});

export async function clearLocalDb(): Promise<void> {
  await Promise.all([
    propertiesStore.clear(),
    talhoesStore.clear(),
    analysesStore.clear(),
  ]);
}

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function listAll<T>(store: LocalForage): Promise<T[]> {
  const rows: T[] = [];
  await store.iterate((value: unknown) => {
    rows.push(value as T);
  });
  return rows;
}

function sortByCreatedAsc<T extends { created_at?: string }>(rows: T[]) {
  return rows.sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aTime - bTime;
  });
}

function sortByCreatedDesc<T extends { created_at?: string }>(rows: T[]) {
  return rows.sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
}

export async function getPropertiesByUser(userId: string): Promise<Property[]> {
  const all = await listAll<Property>(propertiesStore);
  return sortByCreatedAsc(all.filter((row) => row.user_id === userId));
}

export async function createPropertyLocal(input: {
  userId: string;
  nome: string;
}): Promise<Property> {
  const createdAt = nowIso();
  const property: Property = {
    id: createId(),
    user_id: input.userId,
    nome: input.nome,
    created_at: createdAt,
    updated_at: createdAt,
  };
  await propertiesStore.setItem(property.id, property);
  return property;
}

export async function getTalhoesByProperty(
  propertyId: string,
): Promise<Talhao[]> {
  const all = await listAll<Talhao>(talhoesStore);
  return sortByCreatedAsc(all.filter((row) => row.property_id === propertyId));
}

export async function createTalhaoLocal(input: {
  propertyId: string;
  nome: string;
  coordenadas_svg: string;
  cor_identificacao: string;
}): Promise<Talhao> {
  const createdAt = nowIso();
  const talhao: Talhao = {
    id: createId(),
    property_id: input.propertyId,
    nome: input.nome,
    coordenadas_svg: input.coordenadas_svg,
    cor_identificacao: input.cor_identificacao,
    created_at: createdAt,
    updated_at: createdAt,
  };
  await talhoesStore.setItem(talhao.id, talhao);
  return talhao;
}

export async function getAnalysesByProperty(
  propertyId: string,
): Promise<AnalysisRow[]> {
  const all = await listAll<AnalysisRow>(analysesStore);
  return sortByCreatedDesc(all.filter((row) => row.property_id === propertyId));
}

export async function getAllAnalysesLocal(): Promise<AnalysisRow[]> {
  const all = await listAll<AnalysisRow>(analysesStore);
  return sortByCreatedDesc(all);
}

export async function createAnalysisLocal(
  input: Omit<AnalysisRow, 'id' | 'created_at' | 'updated_at'>,
): Promise<AnalysisRow> {
  const createdAt = nowIso();
  const analysis: AnalysisRow = {
    ...input,
    id: createId(),
    created_at: createdAt,
    updated_at: createdAt,
  };
  await analysesStore.setItem(analysis.id, analysis);
  return analysis;
}
