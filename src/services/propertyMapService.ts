import { supabaseClient } from '../supabase/supabaseClient';
import type { Property, Talhao } from '../types/property';
import { isLocalDataMode } from './dataProvider';
import {
  type AnalysisRow,
  createAnalysisLocal,
  createPropertyLocal,
  createTalhaoLocal,
  getAnalysesByProperty,
  getPropertiesByUser,
  getTalhoesByProperty,
} from './localDb';

export type MapPoint = {
  x: number;
  y: number;
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
  return 'Sem analise';
}

export function parseTalhaoPoints(coordenadas?: string | null): MapPoint[] {
  if (!coordenadas) return [];

  try {
    const parsed = JSON.parse(coordenadas) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const point = item as Partial<MapPoint>;
        if (typeof point.x !== 'number' || typeof point.y !== 'number') {
          return null;
        }
        return { x: point.x, y: point.y };
      })
      .filter((point): point is MapPoint => point !== null);
  } catch {
    return [];
  }
}

export function mapTalhaoToDraw(talhao: Talhao) {
  return {
    id: talhao.id,
    name: talhao.nome,
    color: talhao.cor_identificacao ?? DEFAULT_TALHAO_COLOR,
    points: parseTalhaoPoints(talhao.coordenadas_svg),
  };
}

export async function fetchOrCreateUserProperties(
  userId: string,
): Promise<Property[]> {
  if (isLocalDataMode) {
    const list = await getPropertiesByUser(userId);
    if (list.length > 0) return list;
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
  if (Array.isArray(data) && data.length > 0) return data as Property[];

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

export async function createPropertyForUser(
  userId: string,
  nome: string,
): Promise<Property> {
  if (isLocalDataMode) {
    return createPropertyLocal({ userId, nome });
  }

  const { data, error } = await (supabaseClient as any)
    .from('properties')
    .insert({
      user_id: userId,
      nome,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Property;
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

export async function createTalhaoForProperty(input: {
  propertyId: string;
  nome: string;
  points: MapPoint[];
  color?: string;
}): Promise<Talhao> {
  if (isLocalDataMode) {
    return createTalhaoLocal({
      propertyId: input.propertyId,
      nome: input.nome,
      coordenadas_svg: JSON.stringify(input.points),
      cor_identificacao: input.color ?? DEFAULT_TALHAO_COLOR,
    });
  }

  const { data, error } = await (supabaseClient as any)
    .from('talhoes')
    .insert({
      property_id: input.propertyId,
      nome: input.nome,
      coordenadas_svg: JSON.stringify(input.points),
      cor_identificacao: input.color ?? DEFAULT_TALHAO_COLOR,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Talhao;
}

export async function saveLinkedAnalysis(
  input: PersistedAnalysisInput,
): Promise<void> {
  if (isLocalDataMode) {
    await createAnalysisLocal(input);
    return;
  }

  const { error } = await (supabaseClient as any)
    .from('analises_solo')
    .insert(input);
  if (error) throw error;
}
