import localforage from 'localforage';
import type { Property, Talhao } from '../types/property';
import {
  getPrimaryEmail,
  getPrimaryPhone,
  type ContactInfo,
} from '../types/contact';
import { storageRemove } from './safeLocalStorage';

type LocalForage = ReturnType<typeof localforage.createInstance>;

export type AnalysisRow = {
  id: string;
  user_id: string;
  property_id: string;
  talhao_id: string;
  data_amostragem: string;
  profundidade: string;
  laboratorio_id?: string;
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

const LOCAL_CULTURE_PROFILES_KEY = 'perfilsolo_culture_profiles_v1';
const LOCAL_LABORATORIES_KEY = 'perfilsolo_laboratories_v1';

export async function clearLocalDb(): Promise<void> {
  await Promise.all([
    propertiesStore.clear(),
    talhoesStore.clear(),
    analysesStore.clear(),
  ]);
  storageRemove(LOCAL_CULTURE_PROFILES_KEY);
  storageRemove(LOCAL_LABORATORIES_KEY);
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

function normalizeRequiredPropertyName(input: string): string {
  const normalized = String(input ?? '').trim();
  if (!normalized) {
    throw new Error('Informe o nome da propriedade.');
  }
  return normalized;
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

function sanitizePropertyPatch(patch?: Partial<Property>): Partial<Property> {
  if (!patch) return {};
  const {
    id,
    user_id,
    created_at,
    updated_at,
    nome,
    contato,
    ...safePatch
  } = patch;
  void id;
  void user_id;
  void created_at;
  void updated_at;
  void nome;
  void contato;
  return safePatch;
}

function mergePropertyPatch(
  current: Property,
  patch?: Partial<Property>,
): Property {
  const safePatch = sanitizePropertyPatch(patch);
  if (Object.keys(safePatch).length === 0) return current;

  return {
    ...current,
    ...safePatch,
    contato_detalhes:
      safePatch.contato_detalhes !== undefined
        ? {
            ...(current.contato_detalhes ?? {}),
            ...(safePatch.contato_detalhes ?? {}),
          }
        : current.contato_detalhes,
    documentos:
      safePatch.documentos !== undefined
        ? {
            ...(current.documentos ?? {}),
            ...(safePatch.documentos ?? {}),
          }
        : current.documentos,
    fiscal:
      safePatch.fiscal !== undefined
        ? {
            ...(current.fiscal ?? {}),
            ...(safePatch.fiscal ?? {}),
            cartao_cnpj:
              safePatch.fiscal?.cartao_cnpj !== undefined
                ? {
                    ...(current.fiscal?.cartao_cnpj ?? {}),
                    ...(safePatch.fiscal?.cartao_cnpj ?? {}),
                  }
                : current.fiscal?.cartao_cnpj,
            nfe:
              safePatch.fiscal?.nfe !== undefined
                ? {
                    ...(current.fiscal?.nfe ?? {}),
                    ...(safePatch.fiscal?.nfe ?? {}),
                  }
                : current.fiscal?.nfe,
            cnaes:
              safePatch.fiscal?.cnaes !== undefined
                ? safePatch.fiscal.cnaes
                : current.fiscal?.cnaes,
          }
        : current.fiscal,
    proprietario_principal:
      safePatch.proprietario_principal !== undefined
        ? safePatch.proprietario_principal
        : current.proprietario_principal,
    area_allocations:
      safePatch.area_allocations !== undefined
        ? safePatch.area_allocations
        : current.area_allocations,
  };
}

export async function getPropertiesByUser(userId: string): Promise<Property[]> {
  const all = await listAll<Property>(propertiesStore);
  return sortByCreatedAsc(all.filter((row) => row.user_id === userId));
}

export async function getPropertyByIdLocal(
  propertyId: string,
): Promise<Property | null> {
  const row = (await propertiesStore.getItem(propertyId)) as Property | null;
  return row ?? null;
}

export async function createPropertyLocal(input: {
  userId: string;
  nome: string;
  contact?: ContactInfo;
  patch?: Partial<Property>;
}): Promise<Property> {
  const normalizedName = normalizeRequiredPropertyName(input.nome);
  const createdAt = nowIso();
  const baseProperty: Property = {
    id: createId(),
    user_id: input.userId,
    nome: normalizedName,
    contato: getPrimaryEmail(input.contact) ?? getPrimaryPhone(input.contact) ?? '',
    contato_detalhes: input.contact ?? {},
    created_at: createdAt,
    updated_at: createdAt,
  };
  const merged = mergePropertyPatch(baseProperty, input.patch);
  const contactDetails = input.contact ?? merged.contato_detalhes ?? {};
  const property: Property = {
    ...merged,
    contato_detalhes: contactDetails,
    contato:
      getPrimaryEmail(contactDetails) ??
      getPrimaryPhone(contactDetails) ??
      merged.contato ??
      '',
  };
  await propertiesStore.setItem(property.id, property);
  return property;
}

export async function updatePropertyLocal(input: {
  propertyId: string;
  nome?: string;
  contact?: ContactInfo;
  patch?: Partial<Property>;
}): Promise<Property> {
  const current = (await propertiesStore.getItem(input.propertyId)) as
    | Property
    | null;

  if (!current) {
    throw new Error('Propriedade não encontrada para atualizacao.');
  }

  const normalizedName =
    input.nome === undefined ? undefined : normalizeRequiredPropertyName(input.nome);

  const merged = mergePropertyPatch(current, input.patch);
  const mergedContactDetails =
    input.contact != null ? input.contact : merged.contato_detalhes;

  const updated: Property = {
    ...merged,
    nome: normalizedName ?? merged.nome,
    contato:
      input.contact != null
        ? getPrimaryEmail(input.contact) ?? getPrimaryPhone(input.contact) ?? ''
        : merged.contato ??
          getPrimaryEmail(mergedContactDetails) ??
          getPrimaryPhone(mergedContactDetails) ??
          '',
    contato_detalhes: mergedContactDetails,
    updated_at: nowIso(),
  };

  await propertiesStore.setItem(updated.id, updated);
  return updated;
}

export async function deletePropertyLocal(propertyId: string): Promise<void> {
  const [allTalhoes, allAnalyses] = await Promise.all([
    listAll<Talhao>(talhoesStore),
    listAll<AnalysisRow>(analysesStore),
  ]);

  const talhoesToDelete = allTalhoes.filter((t) => t.property_id === propertyId);
  const analysesToDelete = allAnalyses.filter((a) => a.property_id === propertyId);

  await Promise.all([
    propertiesStore.removeItem(propertyId),
    ...talhoesToDelete.map((row) => talhoesStore.removeItem(row.id)),
    ...analysesToDelete.map((row) => analysesStore.removeItem(row.id)),
  ]);
}

export async function getTalhoesByProperty(
  propertyId: string,
): Promise<Talhao[]> {
  const all = await listAll<Talhao>(talhoesStore);
  return sortByCreatedAsc(all.filter((row) => row.property_id === propertyId));
}

export async function getTalhoesByProperties(
  propertyIds: string[],
): Promise<Talhao[]> {
  if (propertyIds.length === 0) return [];
  const propertyIdSet = new Set(propertyIds);
  const all = await listAll<Talhao>(talhoesStore);
  return sortByCreatedAsc(
    all.filter((row) => propertyIdSet.has(row.property_id)),
  );
}

export async function getTalhaoByIdLocal(
  talhaoId: string,
): Promise<Talhao | null> {
  const row = (await talhoesStore.getItem(talhaoId)) as Talhao | null;
  return row ?? null;
}

export async function createTalhaoLocal(input: {
  propertyId: string;
  nome: string;
  coordenadas_svg: string;
  cor_identificacao: string;
  area_ha?: number;
  tipo_solo?: string;
  historico_culturas?: {
    cultura: string;
    cultivar?: string;
    especie_nome_comum?: string;
    especie_nome_cientifico?: string;
    grupo_especie?: string;
    rnc_detail_url?: string;
    technical_profile_id?: string;
    technical_priority?: 'species' | 'cultivar';
    data_inicio: string;
    data_fim: string;
    safra?: string;
    fonte?: string;
  }[];
}): Promise<Talhao> {
  const createdAt = nowIso();
  const talhao: Talhao = {
    id: createId(),
    property_id: input.propertyId,
    nome: input.nome,
    area_ha: input.area_ha,
    tipo_solo: input.tipo_solo,
    coordenadas_svg: input.coordenadas_svg,
    cor_identificacao: input.cor_identificacao,
    historico_culturas: input.historico_culturas,
    created_at: createdAt,
    updated_at: createdAt,
  };
  await talhoesStore.setItem(talhao.id, talhao);
  return talhao;
}

export async function updateTalhaoLocal(input: {
  talhaoId: string;
  nome?: string;
  area_ha?: number;
  tipo_solo?: string | null;
  coordenadas_svg?: string;
  cor_identificacao?: string;
  historico_culturas?: {
    cultura: string;
    cultivar?: string;
    especie_nome_comum?: string;
    especie_nome_cientifico?: string;
    grupo_especie?: string;
    rnc_detail_url?: string;
    technical_profile_id?: string;
    technical_priority?: 'species' | 'cultivar';
    data_inicio: string;
    data_fim: string;
    safra?: string;
    fonte?: string;
  }[];
}): Promise<Talhao> {
  const current = (await talhoesStore.getItem(input.talhaoId)) as Talhao | null;
  if (!current) {
    throw new Error('Talhão não encontrado para atualizacao.');
  }

  const updated: Talhao = {
    ...current,
    nome: input.nome ?? current.nome,
    area_ha: input.area_ha ?? current.area_ha,
    tipo_solo:
      input.tipo_solo === undefined ? current.tipo_solo : input.tipo_solo ?? undefined,
    coordenadas_svg: input.coordenadas_svg ?? current.coordenadas_svg,
    cor_identificacao: input.cor_identificacao ?? current.cor_identificacao,
    historico_culturas:
      input.historico_culturas ?? current.historico_culturas,
    updated_at: nowIso(),
  };

  await talhoesStore.setItem(updated.id, updated);
  return updated;
}

export async function deleteTalhaoLocal(talhaoId: string): Promise<void> {
  const allAnalyses = await listAll<AnalysisRow>(analysesStore);
  const analysesToDelete = allAnalyses.filter((row) => row.talhao_id === talhaoId);

  await Promise.all([
    talhoesStore.removeItem(talhaoId),
    ...analysesToDelete.map((row) => analysesStore.removeItem(row.id)),
  ]);
}

export async function getAnalysesByProperty(
  propertyId: string,
): Promise<AnalysisRow[]> {
  const [allAnalyses, property, allTalhoes] = await Promise.all([
    listAll<AnalysisRow>(analysesStore),
    getPropertyByIdLocal(propertyId),
    listAll<Talhao>(talhoesStore),
  ]);
  if (!property) return [];
  const talhaoById = new Map(allTalhoes.map((row) => [row.id, row]));
  return sortByCreatedDesc(
    allAnalyses.filter((row) => {
      if (row.property_id !== propertyId) return false;
      const talhao = talhaoById.get(row.talhao_id);
      if (!talhao) return false;
      if (talhao.property_id !== propertyId) return false;
      if (row.user_id !== property.user_id) return false;
      return true;
    }),
  );
}

export async function getAnalysesByProperties(
  propertyIds: string[],
): Promise<AnalysisRow[]> {
  const normalizedIds = propertyIds
    .map((id) => String(id ?? '').trim())
    .filter((id) => id.length > 0);
  if (normalizedIds.length === 0) return [];

  const propertyIdSet = new Set(normalizedIds);
  const [allAnalyses, allProperties, allTalhoes] = await Promise.all([
    listAll<AnalysisRow>(analysesStore),
    listAll<Property>(propertiesStore),
    listAll<Talhao>(talhoesStore),
  ]);

  const propertyById = new Map(
    allProperties
      .filter((row) => propertyIdSet.has(row.id))
      .map((row) => [row.id, row]),
  );
  const talhaoById = new Map(allTalhoes.map((row) => [row.id, row]));

  return sortByCreatedDesc(
    allAnalyses.filter((row) => {
      if (!propertyIdSet.has(row.property_id)) return false;
      const property = propertyById.get(row.property_id);
      if (!property) return false;
      const talhao = talhaoById.get(row.talhao_id);
      if (!talhao) return false;
      if (talhao.property_id !== row.property_id) return false;
      if (row.user_id !== property.user_id) return false;
      return true;
    }),
  );
}

export async function getAnalysesByTalhao(
  talhaoId: string,
): Promise<AnalysisRow[]> {
  const [allAnalyses, talhao] = await Promise.all([
    listAll<AnalysisRow>(analysesStore),
    getTalhaoByIdLocal(talhaoId),
  ]);
  if (!talhao) return [];
  const property = await getPropertyByIdLocal(talhao.property_id);
  if (!property) return [];
  return sortByCreatedDesc(
    allAnalyses.filter((row) => {
      if (row.talhao_id !== talhaoId) return false;
      if (row.property_id !== talhao.property_id) return false;
      if (row.user_id !== property.user_id) return false;
      return true;
    }),
  );
}

export async function getAllAnalysesLocal(): Promise<AnalysisRow[]> {
  const [allAnalyses, allProperties, allTalhoes] = await Promise.all([
    listAll<AnalysisRow>(analysesStore),
    listAll<Property>(propertiesStore),
    listAll<Talhao>(talhoesStore),
  ]);
  const propertyById = new Map(allProperties.map((row) => [row.id, row]));
  const talhaoById = new Map(allTalhoes.map((row) => [row.id, row]));
  return sortByCreatedDesc(
    allAnalyses.filter((row) => {
      const property = propertyById.get(row.property_id);
      if (!property) return false;
      const talhao = talhaoById.get(row.talhao_id);
      if (!talhao) return false;
      if (talhao.property_id !== row.property_id) return false;
      if (property.user_id !== row.user_id) return false;
      return true;
    }),
  );
}

export async function getAnalysesByUserLocal(
  userId: string,
): Promise<AnalysisRow[]> {
  const rows = await getAllAnalysesLocal();
  return rows.filter((row) => !row.user_id || row.user_id === userId);
}

export async function createAnalysisLocal(
  input: Omit<AnalysisRow, 'id' | 'created_at' | 'updated_at'>,
): Promise<AnalysisRow> {
  const [property, talhao] = await Promise.all([
    getPropertyByIdLocal(input.property_id),
    getTalhaoByIdLocal(input.talhao_id),
  ]);

  if (!property) {
    throw new Error('Propriedade vinculada a análise não encontrada.');
  }
  if (!talhao) {
    throw new Error('Talhão vinculado a análise não encontrado.');
  }
  if (talhao.property_id !== input.property_id) {
    throw new Error('Integridade inválida: talhão não pertence a propriedade informada.');
  }
  if (property.user_id !== input.user_id) {
    throw new Error('Integridade inválida: usuário não corresponde ao dono da propriedade.');
  }

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
