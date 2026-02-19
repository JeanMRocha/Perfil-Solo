import { storageReadJson, storageWriteJson } from './safeLocalStorage';

const IBGE_BASE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades';
const LOCATION_CACHE_KEY = 'perfilsolo_locations_cache_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;

export type EstadoIbge = {
  id: number;
  sigla: string;
  nome: string;
};

export type CidadeIbge = {
  id: number;
  nome: string;
  ufSigla: string;
};

type CacheEntry<T> = {
  savedAt: number;
  rows: T[];
};

type LocationCache = {
  estados?: CacheEntry<EstadoIbge>;
  cidadesPorUf?: Record<string, CacheEntry<CidadeIbge>>;
};

type EstadoApi = {
  id?: number;
  sigla?: string;
  nome?: string;
};

type CidadeApi = {
  id?: number;
  nome?: string;
};

function readCache(): LocationCache {
  const parsed = storageReadJson<Partial<LocationCache>>(LOCATION_CACHE_KEY, {});
  return {
    estados: parsed?.estados,
    cidadesPorUf: parsed?.cidadesPorUf ?? {},
  };
}

function writeCache(next: LocationCache): void {
  storageWriteJson(LOCATION_CACHE_KEY, next);
}

function isFresh(entry?: CacheEntry<unknown>): boolean {
  if (!entry) return false;
  if (!Array.isArray(entry.rows)) return false;
  return Date.now() - entry.savedAt <= CACHE_TTL_MS;
}

function normalizeSigla(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`IBGE indisponivel (status ${response.status}).`);
    }
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function mapEstados(rows: EstadoApi[]): EstadoIbge[] {
  return rows
    .filter((row) => row?.id != null && row?.sigla && row?.nome)
    .map((row) => ({
      id: Number(row.id),
      sigla: normalizeSigla(String(row.sigla)),
      nome: String(row.nome).trim(),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function mapCidades(rows: CidadeApi[], ufSigla: string): CidadeIbge[] {
  return rows
    .filter((row) => row?.id != null && row?.nome)
    .map((row) => ({
      id: Number(row.id),
      nome: String(row.nome).trim(),
      ufSigla,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function resolveEstadoSigla(
  input: string | null | undefined,
  estados: EstadoIbge[],
): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  const normalized = normalizeText(raw);
  const bySigla = estados.find(
    (estado) => normalizeText(estado.sigla) === normalized,
  );
  if (bySigla) return bySigla.sigla;
  const byNome = estados.find(
    (estado) => normalizeText(estado.nome) === normalized,
  );
  return byNome?.sigla ?? null;
}

export function findCidadeByNome(
  cidades: CidadeIbge[],
  nome: string | null | undefined,
): CidadeIbge | null {
  const raw = nome?.trim();
  if (!raw) return null;
  const normalized = normalizeText(raw);
  return (
    cidades.find((cidade) => normalizeText(cidade.nome) === normalized) ?? null
  );
}

export async function listEstadosFromIbge(
  forceRefresh = false,
): Promise<EstadoIbge[]> {
  const cache = readCache();
  if (!forceRefresh && isFresh(cache.estados)) {
    return cache.estados?.rows ?? [];
  }

  try {
    const response = await fetchJson<EstadoApi[]>(
      `${IBGE_BASE_URL}/estados?orderBy=nome`,
    );
    const rows = mapEstados(Array.isArray(response) ? response : []);
    writeCache({
      ...cache,
      estados: { savedAt: Date.now(), rows },
    });
    return rows;
  } catch (error) {
    if (cache.estados?.rows?.length) {
      return cache.estados.rows;
    }
    throw error;
  }
}

export async function listCidadesByUfFromIbge(
  ufSigla: string,
  forceRefresh = false,
): Promise<CidadeIbge[]> {
  const normalizedUf = normalizeSigla(ufSigla);
  if (!normalizedUf) return [];

  const cache = readCache();
  const cityEntry = cache.cidadesPorUf?.[normalizedUf];
  if (!forceRefresh && isFresh(cityEntry)) {
    return cityEntry?.rows ?? [];
  }

  try {
    const response = await fetchJson<CidadeApi[]>(
      `${IBGE_BASE_URL}/estados/${normalizedUf}/municipios`,
    );
    const rows = mapCidades(Array.isArray(response) ? response : [], normalizedUf);
    writeCache({
      ...cache,
      cidadesPorUf: {
        ...(cache.cidadesPorUf ?? {}),
        [normalizedUf]: {
          savedAt: Date.now(),
          rows,
        },
      },
    });
    return rows;
  } catch (error) {
    if (cityEntry?.rows?.length) {
      return cityEntry.rows;
    }
    throw error;
  }
}
