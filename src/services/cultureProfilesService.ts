import type { NutrientKey, RangeMap, SoilParams } from '../types/soil';

export const CULTURE_PROFILES_KEY = 'perfilsolo_culture_profiles_v1';

export type CultureProfileQuery = {
  cultura?: string;
  variedade?: string | null;
  estado?: string | null;
  cidade?: string | null;
  extrator?: string | null;
  estagio?: string | null;
  idade_meses?: number | null;
};

export interface LocalCultureProfile {
  id: string;
  cultura: string;
  variedade?: string | null;
  estado?: string | null;
  cidade?: string | null;
  extrator?: string | null;
  estagio?: string | null;
  idade_min?: number | null;
  idade_max?: number | null;
  ideal: RangeMap;
  observacoes?: string | null;
  produtos?: LocalCultureProduct[];
  ruleset_version?: string;
  created_at: string;
  updated_at: string;
}

export interface LocalCultureProduct {
  id: string;
  nome: string;
  sku?: string | null;
  valor_unitario?: number | null;
  fiscal?: LocalCultureProductFiscal;
  observacoes?: string | null;
}

export interface LocalCultureProductFiscal {
  unidade_comercial?: string | null;
  ncm?: string | null;
  cest?: string | null;
  cfop?: string | null;
  cst_icms?: string | null;
  cst_pis?: string | null;
  cst_cofins?: string | null;
  aliquota_icms?: number | null;
  aliquota_pis?: number | null;
  aliquota_cofins?: number | null;
}

export const CULTURE_PARAM_KEYS: NutrientKey[] = [
  'pH',
  'P',
  'K',
  'Ca',
  'Mg',
  'MO',
  'V%',
  'm%',
  'S',
  'B',
  'Zn',
  'Cu',
  'Fe',
  'Mn',
  'Argila',
];

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const norm = (v?: string | null) => {
  const raw = (v ?? '').toString().trim().toLowerCase();
  if (!raw) return null;
  return stripAccents(raw);
};

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `culture-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readAllProfiles(): LocalCultureProfile[] {
  try {
    const raw = localStorage.getItem(CULTURE_PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalCultureProfile[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeAllProfiles(rows: LocalCultureProfile[]) {
  localStorage.setItem(CULTURE_PROFILES_KEY, JSON.stringify(rows));
}

export function listLocalCultureProfiles(): LocalCultureProfile[] {
  const rows = readAllProfiles();
  return rows.sort((a, b) => {
    const aTime = new Date(a.updated_at ?? a.created_at).getTime();
    const bTime = new Date(b.updated_at ?? b.created_at).getTime();
    return bTime - aTime;
  });
}

function normalizeRangeMap(input: RangeMap): RangeMap {
  const out: RangeMap = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Array.isArray(value) || value.length < 2) continue;
    const min = Number(value[0]);
    const max = Number(value[1]);
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
    const normalizedKey = (key === 'M.O.' ? 'MO' : key) as NutrientKey;
    out[normalizedKey] = [Math.min(min, max), Math.max(min, max)];
  }
  return out;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProducts(
  input: LocalCultureProduct[] | null | undefined,
): LocalCultureProduct[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      const nome = item?.nome?.toString().trim() ?? '';
      if (!nome) return null;

      const fiscal = item?.fiscal ?? {};
      const normalizedFiscal: LocalCultureProductFiscal = {
        unidade_comercial: normalizeOptionalText(fiscal.unidade_comercial),
        ncm: normalizeOptionalText(fiscal.ncm),
        cest: normalizeOptionalText(fiscal.cest),
        cfop: normalizeOptionalText(fiscal.cfop),
        cst_icms: normalizeOptionalText(fiscal.cst_icms),
        cst_pis: normalizeOptionalText(fiscal.cst_pis),
        cst_cofins: normalizeOptionalText(fiscal.cst_cofins),
        aliquota_icms: normalizeOptionalNumber(fiscal.aliquota_icms),
        aliquota_pis: normalizeOptionalNumber(fiscal.aliquota_pis),
        aliquota_cofins: normalizeOptionalNumber(fiscal.aliquota_cofins),
      };
      const hasFiscal = Object.values(normalizedFiscal).some(
        (value) => value != null,
      );

      return {
        id: item?.id || createId(),
        nome,
        sku: normalizeOptionalText(item?.sku),
        valor_unitario: normalizeOptionalNumber(item?.valor_unitario),
        observacoes: normalizeOptionalText(item?.observacoes),
        fiscal: hasFiscal ? normalizedFiscal : undefined,
      } as LocalCultureProduct;
    })
    .filter((item): item is LocalCultureProduct => item != null);
}

export function upsertLocalCultureProfile(
  input: Omit<LocalCultureProfile, 'id' | 'created_at' | 'updated_at'> & {
    id?: string;
  },
): LocalCultureProfile {
  const rows = readAllProfiles();
  const createdAt = nowIso();

  const row: LocalCultureProfile = {
    id: input.id ?? createId(),
    cultura: input.cultura.trim(),
    variedade: input.variedade?.trim() || null,
    estado: input.estado?.trim() || null,
    cidade: input.cidade?.trim() || null,
    extrator: input.extrator?.trim() || null,
    estagio: input.estagio?.trim() || null,
    idade_min:
      input.idade_min == null || !Number.isFinite(input.idade_min)
        ? null
        : Number(input.idade_min),
    idade_max:
      input.idade_max == null || !Number.isFinite(input.idade_max)
        ? null
        : Number(input.idade_max),
    ideal: normalizeRangeMap(input.ideal),
    observacoes: input.observacoes?.trim() || null,
    produtos: normalizeProducts(input.produtos),
    ruleset_version: input.ruleset_version ?? 'local-v1',
    created_at: createdAt,
    updated_at: createdAt,
  };

  const existingIndex = rows.findIndex((item) => item.id === row.id);
  if (existingIndex >= 0) {
    row.created_at = rows[existingIndex].created_at;
    row.updated_at = nowIso();
    rows[existingIndex] = row;
  } else {
    rows.push(row);
  }

  writeAllProfiles(rows);
  return row;
}

export function deleteLocalCultureProfile(profileId: string): void {
  const rows = readAllProfiles().filter((item) => item.id !== profileId);
  writeAllProfiles(rows);
}

export function clearLocalCultureProfiles(): void {
  localStorage.removeItem(CULTURE_PROFILES_KEY);
}

function matchesAge(
  row: LocalCultureProfile,
  idadeMeses?: number | null,
): { matched: boolean; score: number } {
  if (idadeMeses == null || !Number.isFinite(idadeMeses)) {
    if (row.idade_min != null || row.idade_max != null) {
      return { matched: false, score: 0 };
    }
    return { matched: true, score: 0 };
  }

  const min = row.idade_min;
  const max = row.idade_max;
  if (min != null && idadeMeses < min) return { matched: false, score: 0 };
  if (max != null && idadeMeses > max) return { matched: false, score: 0 };

  if (min != null || max != null) return { matched: true, score: 4 };
  return { matched: true, score: 0 };
}

function scoreMatch(row: LocalCultureProfile, query: CultureProfileQuery): number {
  const culturaQuery = norm(query.cultura);
  if (!culturaQuery) return -1;
  if (norm(row.cultura) !== culturaQuery) return -1;

  let score = 10;

  const pairs: Array<[string | null | undefined, string | null | undefined, number]> = [
    [row.variedade, query.variedade, 6],
    [row.estagio, query.estagio, 3],
    [row.extrator, query.extrator, 2],
    [row.estado, query.estado, 1],
    [row.cidade, query.cidade, 1],
  ];

  for (const [rowValue, queryValue, weight] of pairs) {
    const rowNorm = norm(rowValue);
    const queryNorm = norm(queryValue);
    if (rowNorm == null) continue;
    if (queryNorm == null) return -1;
    if (rowNorm !== queryNorm) return -1;
    score += weight;
  }

  const age = matchesAge(row, query.idade_meses);
  if (!age.matched) return -1;
  score += age.score;

  return score;
}

export function findLocalSoilParams(
  query: CultureProfileQuery,
): SoilParams | null {
  const rows = listLocalCultureProfiles();
  if (!rows.length) return null;

  let best: LocalCultureProfile | null = null;
  let bestScore = -1;

  for (const row of rows) {
    const score = scoreMatch(row, query);
    if (score < 0) continue;
    if (score > bestScore) {
      best = row;
      bestScore = score;
      continue;
    }
    if (score === bestScore && best) {
      const rowTime = new Date(row.updated_at).getTime();
      const bestTime = new Date(best.updated_at).getTime();
      if (rowTime > bestTime) best = row;
    }
  }

  if (!best) return null;
  return {
    id: best.id,
    cultura: best.cultura,
    variedade: best.variedade ?? null,
    estado: best.estado ?? null,
    cidade: best.cidade ?? null,
    extrator: best.extrator ?? null,
    estagio: best.estagio ?? null,
    idade_meses:
      query.idade_meses ??
      best.idade_min ??
      best.idade_max ??
      null,
    ideal: best.ideal,
    ruleset_version: best.ruleset_version ?? 'local-v1',
    fonte: 'local-cadastro',
    observacoes: best.observacoes ?? null,
    updated_at: best.updated_at,
  };
}
