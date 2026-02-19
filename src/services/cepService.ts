import { storageReadJson, storageWriteJson } from './safeLocalStorage';

const CEP_CACHE_KEY = 'perfilsolo_cep_cache_v1';
const CEP_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;

type CepApiResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  erro?: boolean;
};

type CepCacheEntry = {
  savedAt: number;
  data: CepAddress;
};

type CepCacheMap = Record<string, CepCacheEntry>;

export type CepAddress = {
  cep: string;
  street: string;
  neighborhood: string;
  complement: string;
  city: string;
  uf: string;
  ibgeCode: string;
};

export function normalizeCep(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '').slice(0, 8);
}

export function formatCep(value: string | null | undefined): string {
  const digits = normalizeCep(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function readCepCache(): CepCacheMap {
  const parsed = storageReadJson<Partial<CepCacheMap>>(CEP_CACHE_KEY, {});
  if (!parsed || typeof parsed !== 'object') return {};
  return parsed as CepCacheMap;
}

function writeCepCache(cache: CepCacheMap): void {
  storageWriteJson(CEP_CACHE_KEY, cache);
}

function isCacheFresh(entry?: CepCacheEntry): boolean {
  if (!entry) return false;
  return Date.now() - entry.savedAt <= CEP_TTL_MS;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function mapCepResponse(input: CepApiResponse, fallbackCep: string): CepAddress {
  return {
    cep: formatCep(input.cep ?? fallbackCep),
    street: (input.logradouro ?? '').trim(),
    neighborhood: (input.bairro ?? '').trim(),
    complement: (input.complemento ?? '').trim(),
    city: (input.localidade ?? '').trim(),
    uf: (input.uf ?? '').trim().toUpperCase(),
    ibgeCode: (input.ibge ?? '').trim(),
  };
}

export async function lookupAddressByCep(
  cep: string,
  forceRefresh = false,
): Promise<CepAddress | null> {
  const digits = normalizeCep(cep);
  if (digits.length !== 8) return null;

  const cache = readCepCache();
  const cached = cache[digits];
  if (!forceRefresh && isCacheFresh(cached)) {
    return cached.data;
  }

  try {
    const response = await fetchWithTimeout(`https://viacep.com.br/ws/${digits}/json/`);
    if (!response.ok) {
      throw new Error(`ViaCEP indisponivel (status ${response.status}).`);
    }

    const body = (await response.json()) as CepApiResponse;
    if (body?.erro) {
      return null;
    }

    const mapped = mapCepResponse(body ?? {}, digits);
    cache[digits] = { savedAt: Date.now(), data: mapped };
    writeCepCache(cache);
    return mapped;
  } catch (error) {
    if (cached?.data) return cached.data;
    throw error;
  }
}
