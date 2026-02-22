import { supabaseClient } from '../supabase/supabaseClient';
import type { Property, Talhao } from '../types/property';
import type {
  SoilClassificationRequest,
  SoilResultResponse,
} from './soilClassificationContractService';
import {
  type ContactInfo,
} from '../types/contact';
import { getPropertyAccessPolicyForUser } from './billingPlanService';
import { isLocalDataMode } from './dataProvider';
import {
  type AnalysisRow,
  createAnalysisLocal,
  deletePropertyLocal,
  deleteTalhaoLocal,
  createPropertyLocal,
  createTalhaoLocal,
  getAnalysesByProperty,
  getAnalysesByProperties,
  getAnalysesByTalhao,
  getPropertyByIdLocal,
  getPropertiesByUser,
  getTalhaoByIdLocal,
  getTalhoesByProperty,
  getTalhoesByProperties,
  updateTalhaoLocal,
  updatePropertyLocal,
} from './localDb';
import { claimCreditEngagementReward } from './creditsService';
import { trackGamificationEvent } from './gamificationService';
import { assertStoreQuotaAvailable } from './appStoreService';

export type MapPoint = {
  x: number;
  y: number;
};

export type TalhaoGeometry = {
  points: MapPoint[];
  exclusionZones: MapPoint[][];
  mapReference?: TalhaoMapReference | null;
  soilClassification?: TalhaoSoilClassificationSnapshot | null;
  currentCulture?: string | null;
};

export type TalhaoSoilClassificationSnapshot = {
  request: SoilClassificationRequest;
  response: SoilResultResponse;
  applied_at: string;
};

export type TalhaoMapReference = {
  center: {
    lat: number;
    lon: number;
  };
  zoom: number;
  layerId?: string;
};

export type TalhaoTechnicalStatus =
  | 'unknown'
  | 'critical'
  | 'attention'
  | 'good';

export type TalhaoAnalysisSummary = {
  talhaoId: string;
  status: TalhaoTechnicalStatus;
  lastAnalysisAt: string | null;
};

export type PersistedAnalysisInput = Omit<
  AnalysisRow,
  'id' | 'created_at' | 'updated_at'
>;

const DEFAULT_TALHAO_COLOR = '#81C784';

function applyPropertyVisibilityPolicy(userId: string, rows: Property[]): Property[] {
  const policy = getPropertyAccessPolicyForUser(userId);
  if (!policy.restricted_to_first_property) return rows;
  return rows.slice(0, 1);
}

function toDateLike(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

function extractNumeric(
  source: Record<string, any> | null | undefined,
  key: string,
): number | null {
  const value = source?.[key];
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const num = Number((value as any).value);
    return Number.isFinite(num) ? num : null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function deriveTalhaoStatusFromAnalysis(
  analysisRow: any,
): TalhaoTechnicalStatus {
  const alerts = Array.isArray(analysisRow?.alerts) ? analysisRow.alerts : [];
  const hasHighAlert = alerts.some((alert: any) => alert?.severity === 'high');
  if (hasHighAlert) return 'critical';

  const hasMediumAlert = alerts.some(
    (alert: any) => alert?.severity === 'medium',
  );
  if (hasMediumAlert) return 'attention';

  const normalized = (analysisRow?.normalized ?? analysisRow?.raw ?? {}) as Record<
    string,
    any
  >;
  const ph = extractNumeric(normalized, 'pH');
  const vPercent = extractNumeric(normalized, 'V%');
  const al = extractNumeric(normalized, 'Al');

  if (ph != null && (ph < 5.2 || ph > 7.0)) return 'attention';
  if (al != null && al > 0.5) return 'attention';
  if (vPercent != null && vPercent < 40) return 'critical';
  if (ph != null && ph >= 5.5 && ph <= 6.5) return 'good';
  return 'good';
}

export function statusToTalhaoColor(
  status: TalhaoTechnicalStatus,
  fallbackColor = DEFAULT_TALHAO_COLOR,
): string {
  if (status === 'critical') return '#ef5350';
  if (status === 'attention') return '#ffb300';
  if (status === 'good') return '#66bb6a';
  return fallbackColor;
}

export function statusToLabel(status: TalhaoTechnicalStatus): string {
  if (status === 'critical') return 'Critico';
  if (status === 'attention') return 'Atencao';
  if (status === 'good') return 'Saudavel';
  return 'Sem análise';
}

function parsePointArray(value: unknown): MapPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const point = item as Partial<MapPoint>;
      if (typeof point.x !== 'number' || typeof point.y !== 'number') {
        return null;
      }
      return { x: point.x, y: point.y };
    })
    .filter((point): point is MapPoint => point !== null);
}

function parseMapReference(value: unknown): TalhaoMapReference | null {
  if (!value || typeof value !== 'object') return null;
  const bag = value as {
    center?: { lat?: unknown; lon?: unknown } | null;
    zoom?: unknown;
    layerId?: unknown;
  };
  const lat = Number(bag.center?.lat);
  const lon = Number(bag.center?.lon);
  const zoom = Number(bag.zoom);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return null;
  if (!Number.isFinite(zoom) || zoom < 1 || zoom > 22) return null;
  const layerId =
    typeof bag.layerId === 'string' && bag.layerId.trim().length > 0
      ? bag.layerId
      : undefined;
  return {
    center: { lat, lon },
    zoom: Math.round(zoom),
    layerId,
  };
}

function parseSoilClassificationSnapshot(
  value: unknown,
): TalhaoSoilClassificationSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const bag = value as {
    request?: unknown;
    response?: unknown;
    applied_at?: unknown;
  };
  if (!bag.request || !bag.response || typeof bag.applied_at !== 'string') {
    return null;
  }
  return {
    request: bag.request as SoilClassificationRequest,
    response: bag.response as SoilResultResponse,
    applied_at: bag.applied_at,
  };
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function parseTalhaoGeometry(coordenadas?: string | null): TalhaoGeometry {
  if (!coordenadas) {
    return { points: [], exclusionZones: [], mapReference: null };
  }

  try {
    const parsed = JSON.parse(coordenadas) as unknown;
    if (Array.isArray(parsed)) {
      return {
        points: parsePointArray(parsed),
        exclusionZones: [],
        mapReference: null,
      };
    }

    if (parsed && typeof parsed === 'object') {
      const bag = parsed as {
        points?: unknown;
        exclusionZones?: unknown;
        mapReference?: unknown;
        soilClassification?: unknown;
        currentCulture?: unknown;
      };
      return {
        points: parsePointArray(bag.points),
        exclusionZones: Array.isArray(bag.exclusionZones)
          ? bag.exclusionZones.map((zone) => parsePointArray(zone)).filter((zone) => zone.length >= 3)
          : [],
        mapReference: parseMapReference(bag.mapReference),
        soilClassification: parseSoilClassificationSnapshot(bag.soilClassification),
        currentCulture: parseOptionalString(bag.currentCulture),
      };
    }
  } catch {
    // fallback below
  }

  return { points: [], exclusionZones: [], mapReference: null };
}

export function serializeTalhaoGeometry(geometry: TalhaoGeometry): string {
  return JSON.stringify({
    points: geometry.points,
    exclusionZones: geometry.exclusionZones,
    mapReference: geometry.mapReference ?? undefined,
    soilClassification: geometry.soilClassification ?? undefined,
    currentCulture: parseOptionalString(geometry.currentCulture) ?? undefined,
  });
}

export function parseTalhaoPoints(coordenadas?: string | null): MapPoint[] {
  return parseTalhaoGeometry(coordenadas).points;
}

export function mapTalhaoToDraw(talhao: Talhao) {
  return {
    id: talhao.id,
    name: talhao.nome,
    color: talhao.cor_identificacao ?? DEFAULT_TALHAO_COLOR,
    points: parseTalhaoPoints(talhao.coordenadas_svg),
  };
}

function toPositiveArea(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

function normalizeRequiredPropertyName(input: string): string {
  const normalized = String(input ?? '').trim();
  if (!normalized) {
    throw new Error('Informe o nome da propriedade.');
  }
  return normalized;
}

function sumTalhoesArea(talhoes: Talhao[]): number {
  return talhoes.reduce((sum, row) => sum + toPositiveArea(row.area_ha), 0);
}

function sumNonTalhoesAllocations(property: Property | null): number {
  const rows = Array.isArray(property?.area_allocations)
    ? property?.area_allocations
    : [];
  return rows.reduce((sum, row) => {
    const categoryId = String(row?.category_id ?? '').trim().toLowerCase();
    if (categoryId === 'talhoes') return sum;
    return sum + toPositiveArea(row?.area_ha);
  }, 0);
}

async function findPropertyByIdForSync(propertyId: string): Promise<Property | null> {
  if (isLocalDataMode) {
    return getPropertyByIdLocal(propertyId);
  }

  const { data, error } = await (supabaseClient as any)
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) throw error;
  return (data as Property | null) ?? null;
}

async function persistPropertyTotalArea(
  propertyId: string,
  totalArea: number,
): Promise<void> {
  if (isLocalDataMode) {
    await updatePropertyLocal({
      propertyId,
      patch: { total_area: totalArea },
    });
    return;
  }

  const { error } = await (supabaseClient as any)
    .from('properties')
    .update({
      total_area: totalArea,
      updated_at: new Date().toISOString(),
    })
    .eq('id', propertyId);

  if (error) throw error;
}

async function syncPropertyTotalArea(propertyId: string): Promise<void> {
  const [property, talhoes] = await Promise.all([
    findPropertyByIdForSync(propertyId),
    fetchTalhoesByProperty(propertyId),
  ]);

  if (!property) return;

  const talhoesArea = sumTalhoesArea(talhoes);
  const otherAreas = sumNonTalhoesAllocations(property);
  const nextTotalArea = talhoesArea + otherAreas;
  await persistPropertyTotalArea(propertyId, nextTotalArea);
}

export async function fetchOrCreateUserProperties(
  userId: string,
): Promise<Property[]> {
  if (isLocalDataMode) {
    const list = await getPropertiesByUser(userId);
    if (list.length > 0) return applyPropertyVisibilityPolicy(userId, list);
    const created = await createPropertyLocal({
      userId,
      nome: 'Minha Propriedade',
    });
    return [created];
  }

  const { data, error } = await (supabaseClient as any)
    .from('properties')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (Array.isArray(data) && data.length > 0) {
    return applyPropertyVisibilityPolicy(userId, data as Property[]);
  }

  const { data: created, error: insertError } = await (supabaseClient as any)
    .from('properties')
    .insert({
      user_id: userId,
      nome: 'Minha Propriedade',
    })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return [created as Property];
}

export async function fetchUserProperties(
  userId: string,
): Promise<Property[]> {
  if (isLocalDataMode) {
    const rows = await getPropertiesByUser(userId);
    return applyPropertyVisibilityPolicy(userId, rows);
  }

  const { data, error } = await (supabaseClient as any)
    .from('properties')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return applyPropertyVisibilityPolicy(userId, data as Property[]);
}

export async function createPropertyForUser(
  userId: string,
  nome: string,
  contact?: ContactInfo,
  patch?: Partial<Property>,
): Promise<Property> {
  const normalizedName = normalizeRequiredPropertyName(nome);
  await assertStoreQuotaAvailable({
    user_id: userId,
    resource: 'properties',
    required_units: 1,
  });

  if (isLocalDataMode) {
    const created = await createPropertyLocal({
      userId,
      nome: normalizedName,
      contact,
      patch,
    });
    claimCreditEngagementReward({
      user_id: userId,
      rule_id: 'property_created',
      created_by: userId,
      reference_id: created.id,
    });
    void trackGamificationEvent(userId, 'property_created').catch(() => null);
    return created;
  }

  const basePayload: Record<string, unknown> = {
    user_id: userId,
    nome: normalizedName,
  };
  if (patch?.cidade !== undefined) basePayload.cidade = patch.cidade;
  if (patch?.estado !== undefined) basePayload.estado = patch.estado;

  const extendedPayload: Record<string, unknown> = { ...basePayload };
  if (patch?.proprietario_principal !== undefined) {
    extendedPayload.proprietario_principal = patch.proprietario_principal;
  }
  if (patch?.documentos !== undefined) {
    extendedPayload.documentos = patch.documentos;
  }
  if (patch?.fiscal !== undefined) {
    extendedPayload.fiscal = patch.fiscal;
  }
  if (patch?.area_allocations !== undefined) {
    extendedPayload.area_allocations = patch.area_allocations;
  }

  const hasExtendedFields =
    patch?.proprietario_principal !== undefined ||
    patch?.documentos !== undefined ||
    patch?.fiscal !== undefined ||
    patch?.area_allocations !== undefined;

  const runInsert = (payload: Record<string, unknown>) =>
    (supabaseClient as any)
      .from('properties')
      .insert(payload)
      .select('*')
      .single();

  let { data, error } = await runInsert(extendedPayload);

  if (error && hasExtendedFields) {
    const fallback = await runInsert(basePayload);
    if (!fallback.error) {
      data = fallback.data;
      error = null;
    }
  }

  if (error) throw error;
  const created = data as Property;
  claimCreditEngagementReward({
    user_id: userId,
    rule_id: 'property_created',
    created_by: userId,
    reference_id: created.id,
  });
  void trackGamificationEvent(userId, 'property_created').catch(() => null);
  return created;
}

export async function updatePropertyForUser(
  propertyId: string,
  nome: string,
  contact?: ContactInfo,
  patch?: Partial<Property>,
): Promise<Property> {
  const normalizedName = normalizeRequiredPropertyName(nome);

  if (isLocalDataMode) {
    return updatePropertyLocal({
      propertyId,
      nome: normalizedName,
      contact,
      patch,
    });
  }

  const basePayload: Record<string, unknown> = {
    nome: normalizedName,
    updated_at: new Date().toISOString(),
  };
  if (patch?.cidade !== undefined) basePayload.cidade = patch.cidade;
  if (patch?.estado !== undefined) basePayload.estado = patch.estado;

  const extendedPayload: Record<string, unknown> = { ...basePayload };
  if (patch?.proprietario_principal !== undefined) {
    extendedPayload.proprietario_principal = patch.proprietario_principal;
  }
  if (patch?.documentos !== undefined) {
    extendedPayload.documentos = patch.documentos;
  }
  if (patch?.fiscal !== undefined) {
    extendedPayload.fiscal = patch.fiscal;
  }
  if (patch?.area_allocations !== undefined) {
    extendedPayload.area_allocations = patch.area_allocations;
  }

  const hasExtendedFields =
    patch?.proprietario_principal !== undefined ||
    patch?.documentos !== undefined ||
    patch?.fiscal !== undefined ||
    patch?.area_allocations !== undefined;

  const runUpdate = (payload: Record<string, unknown>) =>
    (supabaseClient as any)
      .from('properties')
      .update(payload)
      .eq('id', propertyId)
      .select('*')
      .single();

  let { data, error } = await runUpdate(extendedPayload);

  if (error && hasExtendedFields) {
    const fallback = await runUpdate(basePayload);
    if (!fallback.error) {
      data = fallback.data;
      error = null;
    }
  }

  if (error) throw error;
  return data as Property;
}

export async function deletePropertyForUser(propertyId: string): Promise<void> {
  if (isLocalDataMode) {
    await deletePropertyLocal(propertyId);
    return;
  }

  const { error } = await (supabaseClient as any)
    .from('properties')
    .delete()
    .eq('id', propertyId);

  if (error) throw error;
}

export async function fetchTalhoesByProperty(
  propertyId: string,
): Promise<Talhao[]> {
  if (isLocalDataMode) {
    return getTalhoesByProperty(propertyId);
  }

  const { data, error } = await (supabaseClient as any)
    .from('talhoes')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Talhao[];
}

export async function fetchTalhoesByProperties(
  propertyIds: string[],
): Promise<Talhao[]> {
  if (propertyIds.length === 0) return [];

  if (isLocalDataMode) {
    return getTalhoesByProperties(propertyIds);
  }

  const { data, error } = await (supabaseClient as any)
    .from('talhoes')
    .select('*')
    .in('property_id', propertyIds)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Talhao[];
}

export async function fetchLatestAnalysisByTalhao(
  propertyId: string,
): Promise<Record<string, TalhaoAnalysisSummary>> {
  let rows: any[] = [];
  if (isLocalDataMode) {
    rows = await getAnalysesByProperty(propertyId);
  } else {
    const { data, error } = await (supabaseClient as any)
      .from('analises_solo')
      .select('talhao_id,created_at,data_amostragem,alerts,normalized,raw')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    rows = Array.isArray(data) ? data : [];
  }

  const result: Record<string, TalhaoAnalysisSummary> = {};
  for (const row of rows) {
    const talhaoId = row?.talhao_id as string | undefined;
    if (!talhaoId || result[talhaoId]) continue;

    const status = deriveTalhaoStatusFromAnalysis(row);
    const lastAnalysisAt =
      toDateLike(row?.data_amostragem) ?? toDateLike(row?.created_at);
    result[talhaoId] = {
      talhaoId,
      status,
      lastAnalysisAt,
    };
  }

  return result;
}

export async function fetchAnalysesByTalhao(
  talhaoId: string,
): Promise<AnalysisRow[]> {
  if (isLocalDataMode) {
    return getAnalysesByTalhao(talhaoId);
  }

  const { data, error } = await (supabaseClient as any)
    .from('analises_solo')
    .select('*')
    .eq('talhao_id', talhaoId)
    .order('data_amostragem', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as AnalysisRow[];
}

export async function fetchAnalysesByProperty(
  propertyId: string,
): Promise<AnalysisRow[]> {
  if (isLocalDataMode) {
    return getAnalysesByProperty(propertyId);
  }

  const { data, error } = await (supabaseClient as any)
    .from('analises_solo')
    .select('*')
    .eq('property_id', propertyId)
    .order('data_amostragem', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as AnalysisRow[];
}

export async function fetchAnalysesByProperties(
  propertyIds: string[],
): Promise<AnalysisRow[]> {
  const normalizedIds = propertyIds
    .map((id) => String(id ?? '').trim())
    .filter((id) => id.length > 0);
  if (normalizedIds.length === 0) return [];

  if (isLocalDataMode) {
    return getAnalysesByProperties(normalizedIds);
  }

  const { data, error } = await (supabaseClient as any)
    .from('analises_solo')
    .select('*')
    .in('property_id', normalizedIds)
    .order('data_amostragem', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as AnalysisRow[];
}

export async function createTalhaoForProperty(input: {
  propertyId: string;
  nome: string;
  points?: MapPoint[];
  exclusionZones?: MapPoint[][];
  mapReference?: TalhaoMapReference | null;
  color?: string;
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
  const property = await findPropertyByIdForSync(input.propertyId);
  if (!property) {
    throw new Error('Propriedade vinculada ao talhão não encontrada.');
  }
  const ownerUserId = String(property.user_id ?? '').trim();
  if (ownerUserId) {
    await assertStoreQuotaAvailable({
      user_id: ownerUserId,
      resource: 'talhoes',
      required_units: 1,
    });
  }

  const coordenadasSvg = serializeTalhaoGeometry({
    points: input.points ?? [],
    exclusionZones: input.exclusionZones ?? [],
    mapReference: input.mapReference ?? null,
  });

  if (isLocalDataMode) {
    const created = await createTalhaoLocal({
      propertyId: input.propertyId,
      nome: input.nome,
      area_ha: input.area_ha,
      tipo_solo: input.tipo_solo,
      coordenadas_svg: coordenadasSvg,
      cor_identificacao: input.color ?? DEFAULT_TALHAO_COLOR,
      historico_culturas: input.historico_culturas,
    });
    await syncPropertyTotalArea(input.propertyId);
    if (ownerUserId) {
      claimCreditEngagementReward({
        user_id: ownerUserId,
        rule_id: 'talhao_created',
        created_by: ownerUserId,
        reference_id: created.id,
      });
    }
    return created;
  }

  const { data, error } = await (supabaseClient as any)
    .from('talhoes')
    .insert({
      property_id: input.propertyId,
      nome: input.nome,
      area_ha: input.area_ha,
      tipo_solo: input.tipo_solo,
      coordenadas_svg: coordenadasSvg,
      cor_identificacao: input.color ?? DEFAULT_TALHAO_COLOR,
      historico_culturas: input.historico_culturas,
    })
    .select('*')
    .single();

  if (error) throw error;
  const created = data as Talhao;
  await syncPropertyTotalArea(input.propertyId);
  if (ownerUserId) {
    claimCreditEngagementReward({
      user_id: ownerUserId,
      rule_id: 'talhao_created',
      created_by: ownerUserId,
      reference_id: created.id,
    });
  }
  return created;
}

export async function updateTalhaoForProperty(input: {
  talhaoId: string;
  nome: string;
  area_ha?: number;
  tipo_solo?: string | null;
  color?: string;
  points?: MapPoint[];
  exclusionZones?: MapPoint[][];
  mapReference?: TalhaoMapReference | null;
  soilClassification?: TalhaoSoilClassificationSnapshot | null;
  currentCulture?: string | null;
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
  const hasGeometryUpdate =
    input.points !== undefined ||
    input.exclusionZones !== undefined ||
    input.mapReference !== undefined ||
    input.soilClassification !== undefined ||
    input.currentCulture !== undefined;
  const coordenadasSvg = hasGeometryUpdate
    ? serializeTalhaoGeometry({
        points: input.points ?? [],
        exclusionZones: input.exclusionZones ?? [],
        mapReference: input.mapReference ?? null,
        soilClassification: input.soilClassification ?? null,
        currentCulture: input.currentCulture ?? undefined,
      })
    : undefined;

  if (isLocalDataMode) {
    const updated = await updateTalhaoLocal({
      talhaoId: input.talhaoId,
      nome: input.nome,
      area_ha: input.area_ha,
      tipo_solo: input.tipo_solo,
      cor_identificacao: input.color,
      coordenadas_svg: coordenadasSvg,
      historico_culturas: input.historico_culturas,
    });
    await syncPropertyTotalArea(updated.property_id);
    return updated;
  }

  const { data, error } = await (supabaseClient as any)
    .from('talhoes')
    .update({
      nome: input.nome,
      area_ha: input.area_ha,
      tipo_solo: input.tipo_solo,
      cor_identificacao: input.color,
      coordenadas_svg: coordenadasSvg,
      historico_culturas: input.historico_culturas,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.talhaoId)
    .select('*')
    .single();

  if (error) throw error;
  const updated = data as Talhao;
  await syncPropertyTotalArea(updated.property_id);
  return updated;
}

export async function deleteTalhaoForProperty(talhaoId: string): Promise<void> {
  if (isLocalDataMode) {
    const current = await getTalhaoByIdLocal(talhaoId);
    await deleteTalhaoLocal(talhaoId);
    if (current?.property_id) {
      await syncPropertyTotalArea(current.property_id);
    }
    return;
  }

  const { data: current, error: readError } = await (supabaseClient as any)
    .from('talhoes')
    .select('property_id')
    .eq('id', talhaoId)
    .maybeSingle();
  if (readError) throw readError;

  const { error } = await (supabaseClient as any)
    .from('talhoes')
    .delete()
    .eq('id', talhaoId);

  if (error) throw error;
  const propertyId = String(current?.property_id ?? '').trim();
  if (propertyId) {
    await syncPropertyTotalArea(propertyId);
  }
}

export async function saveLinkedAnalysis(
  input: PersistedAnalysisInput,
): Promise<void> {
  await assertStoreQuotaAvailable({
    user_id: input.user_id,
    resource: 'analises',
    required_units: 1,
  });
  await assertAnalysisLinkIntegrity(input);

  if (isLocalDataMode) {
    await createAnalysisLocal(input);
    return;
  }

  const { error } = await (supabaseClient as any)
    .from('analises_solo')
    .insert(input);
  if (error) throw error;
}

export type { AnalysisRow };

async function assertAnalysisLinkIntegrity(
  input: PersistedAnalysisInput,
): Promise<void> {
  if (isLocalDataMode) {
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
    if (property.user_id !== input.user_id) {
      throw new Error(
        'Integridade inválida: usuário não corresponde ao dono da propriedade.',
      );
    }
    if (talhao.property_id !== input.property_id) {
      throw new Error(
        'Integridade inválida: talhão não pertence a propriedade informada.',
      );
    }
    if (
      input.laboratorio_id != null &&
      input.laboratorio_id.toString().trim().length === 0
    ) {
      throw new Error('Integridade inválida: laboratorio_id vazio.');
    }
    return;
  }

  const [propertyResult, talhaoResult] = await Promise.all([
    (supabaseClient as any)
      .from('properties')
      .select('id,user_id')
      .eq('id', input.property_id)
      .single(),
    (supabaseClient as any)
      .from('talhoes')
      .select('id,property_id')
      .eq('id', input.talhao_id)
      .single(),
  ]);

  if (propertyResult.error || !propertyResult.data) {
    throw propertyResult.error ?? new Error('Propriedade vinculada não encontrada.');
  }
  if (talhaoResult.error || !talhaoResult.data) {
    throw talhaoResult.error ?? new Error('Talhão vinculado não encontrado.');
  }

  if (propertyResult.data.user_id !== input.user_id) {
    throw new Error(
      'Integridade inválida: usuário não corresponde ao dono da propriedade.',
    );
  }
  if (talhaoResult.data.property_id !== input.property_id) {
    throw new Error(
      'Integridade inválida: talhão não pertence a propriedade informada.',
    );
  }

  if (input.laboratorio_id) {
    const laboratorioResult = await (supabaseClient as any)
      .from('laboratorios')
      .select('id,user_id')
      .eq('id', input.laboratorio_id)
      .single();

    if (laboratorioResult.error || !laboratorioResult.data) {
      throw laboratorioResult.error ?? new Error('Laboratorio vinculado não encontrado.');
    }

    if (laboratorioResult.data.user_id !== input.user_id) {
      throw new Error(
        'Integridade inválida: laboratorio não pertence ao mesmo usuário da análise.',
      );
    }
  }
}
