import { isLocalDataMode } from './dataProvider';
import { supabaseClient } from '../supabase/supabaseClient';

export const RNC_CULTIVAR_SELECTED_EVENT = 'perfilsolo:rnc-cultivar-selected';

export type RncCultivarSource = 'rnc-mapa-cache' | 'local-sample';

export interface RncCultivarFilters {
  nomeComum?: string;
  nomeCientifico?: string;
  cultivar?: string;
  grupoEspecie?: string;
}

export interface RncCultivarRecord {
  especie_nome_comum: string;
  especie_nome_cientifico: string;
  cultivar: string;
  tipo_registro: string;
  grupo_especie: string;
  situacao: string;
  rnc_detail_url?: string;
}

export interface RncCultivarSearchResult {
  source: RncCultivarSource;
  items: RncCultivarRecord[];
  page: number;
  page_size: number;
  total: number;
  groups: string[];
  fallback_used?: boolean;
  cache_updated_at?: string | null;
}

export interface RncCultivarSelectionPayload {
  cultura: string;
  cultivar: string;
  dataInicio: string;
  dataFim: string;
  fonte: 'RNC-MAPA';
}

export interface RncCultivarSelectionMessage {
  type: typeof RNC_CULTIVAR_SELECTED_EVENT;
  payload: RncCultivarSelectionPayload;
}

const LOCAL_SAMPLE: RncCultivarRecord[] = [
  {
    especie_nome_comum: 'Abacate',
    especie_nome_cientifico: 'Persea americana Mill.',
    cultivar: 'Hass',
    tipo_registro: 'CULTIVAR',
    grupo_especie: 'FRUTÍFERAS',
    situacao: 'REGISTRADA',
  },
  {
    especie_nome_comum: 'Abacate',
    especie_nome_cientifico: 'Persea americana Mill.',
    cultivar: 'Fortuna',
    tipo_registro: 'CULTIVAR',
    grupo_especie: 'FRUTÍFERAS',
    situacao: 'REGISTRADA',
  },
  {
    especie_nome_comum: 'Abóbora',
    especie_nome_cientifico: 'Cucurbita ficifolia Bouché',
    cultivar: 'BRS Portuguesa',
    tipo_registro: 'CULTIVAR',
    grupo_especie: 'OLERÍCOLAS',
    situacao: 'REGISTRADA',
  },
];

function normalize(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function includesNormalized(target: string, query?: string): boolean {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;
  return normalize(target).includes(normalizedQuery);
}

function applyFilters(
  rows: RncCultivarRecord[],
  filters?: RncCultivarFilters,
): RncCultivarRecord[] {
  if (!filters) return rows;
  return rows.filter((row) => {
    if (!includesNormalized(row.especie_nome_comum, filters.nomeComum)) return false;
    if (!includesNormalized(row.especie_nome_cientifico, filters.nomeCientifico)) return false;
    if (!includesNormalized(row.cultivar, filters.cultivar)) return false;
    if (
      filters.grupoEspecie &&
      normalize(filters.grupoEspecie) !== 'todos' &&
      normalize(row.grupo_especie) !== normalize(filters.grupoEspecie)
    ) {
      return false;
    }
    return true;
  });
}

function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const start = (safePage - 1) * safePageSize;
  return rows.slice(start, start + safePageSize);
}

export async function searchRncCultivars(params: {
  filters?: RncCultivarFilters;
  page?: number;
  pageSize?: number;
}): Promise<RncCultivarSearchResult> {
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(params.pageSize ?? 50) || 50));

  if (isLocalDataMode) {
    const filtered = applyFilters(LOCAL_SAMPLE, params.filters);
    const groups = Array.from(new Set(LOCAL_SAMPLE.map((row) => row.grupo_especie))).sort(
      (a, b) => a.localeCompare(b, 'pt-BR'),
    );
    return {
      source: 'local-sample',
      items: paginate(filtered, page, pageSize),
      page,
      page_size: pageSize,
      total: filtered.length,
      groups,
      fallback_used: false,
      cache_updated_at: null,
    };
  }

  const { data, error } = await (supabaseClient as any).functions.invoke(
    'rnc-cultivar-search',
    {
      body: {
        action: 'search',
        filters: params.filters ?? {},
        page,
        pageSize,
      },
    },
  );

  if (error) {
    throw new Error(
      error?.message ??
        'Falha ao consultar cultivares no RNC. Verifique a função edge rnc-cultivar-search.',
    );
  }

  const response = data ?? {};
  const items = Array.isArray(response.items) ? response.items : [];
  const groups = Array.isArray(response.groups) ? response.groups : [];
  return {
    source: response.source === 'local-sample' ? 'local-sample' : 'rnc-mapa-cache',
    items,
    page: Number(response.page ?? page) || page,
    page_size: Number(response.page_size ?? pageSize) || pageSize,
    total: Number(response.total ?? items.length) || 0,
    groups,
    fallback_used: Boolean(response.fallback_used),
    cache_updated_at:
      typeof response.cache_updated_at === 'string' ? response.cache_updated_at : null,
  };
}

export async function forceSyncRncCultivars(): Promise<{
  total: number;
  synced_at?: string;
}> {
  if (isLocalDataMode) {
    return { total: LOCAL_SAMPLE.length };
  }

  const { data, error } = await (supabaseClient as any).functions.invoke(
    'rnc-cultivar-search',
    { body: { action: 'sync' } },
  );

  if (error) {
    throw new Error(
      error?.message ??
        'Falha ao sincronizar cache de cultivares. Verifique permissões de super usuário.',
    );
  }

  return {
    total: Number(data?.total ?? 0) || 0,
    synced_at: typeof data?.synced_at === 'string' ? data.synced_at : undefined,
  };
}
