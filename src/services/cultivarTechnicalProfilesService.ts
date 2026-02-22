import { storageReadJson, storageWriteJson } from './safeLocalStorage';

const CULTIVAR_TECHNICAL_KEY = 'perfilsolo_cultivar_technical_profiles_v1';

export interface CultivarTechnicalMetrics {
  produtividade_esperada_t_ha?: number | null;
  produtividade_esperada_sacas_ha?: number | null;
  espacamento_linha_m?: number | null;
  espacamento_planta_m?: number | null;
  populacao_plantas_ha?: number | null;
  ciclo_dias?: number | null;
  observacoes?: string | null;
  extras?: Record<string, string | number | boolean | null>;
}

export interface SpeciesTechnicalProfile {
  id: string;
  species_key: string;
  especie_nome_comum: string;
  especie_nome_cientifico: string;
  grupo_especie?: string | null;
  source: 'rnc' | 'usuario';
  metrics: CultivarTechnicalMetrics;
  created_at: string;
  updated_at: string;
}

export interface CultivarTechnicalProfile {
  id: string;
  species_key: string;
  cultivar_key: string;
  cultivar_nome: string;
  source: 'rnc' | 'clone_usuario' | 'usuario';
  base_cultivar_key?: string | null;
  rnc_detail_url?: string | null;
  metrics: CultivarTechnicalMetrics;
  created_at: string;
  updated_at: string;
}

interface CultivarTechnicalState {
  species_profiles: SpeciesTechnicalProfile[];
  cultivar_profiles: CultivarTechnicalProfile[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `cultivar-tech-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalize(input?: string | null): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function readState(): CultivarTechnicalState {
  const parsed = storageReadJson<CultivarTechnicalState | null>(
    CULTIVAR_TECHNICAL_KEY,
    null,
  );
  if (!parsed || typeof parsed !== 'object') {
    return { species_profiles: [], cultivar_profiles: [] };
  }
  const species = Array.isArray(parsed.species_profiles)
    ? parsed.species_profiles
    : [];
  const cultivars = Array.isArray(parsed.cultivar_profiles)
    ? parsed.cultivar_profiles
    : [];
  return {
    species_profiles: species,
    cultivar_profiles: cultivars,
  };
}

function writeState(state: CultivarTechnicalState): void {
  storageWriteJson(CULTIVAR_TECHNICAL_KEY, state);
}

function mergeDefinedMetrics(
  base: CultivarTechnicalMetrics,
  override?: CultivarTechnicalMetrics | null,
): CultivarTechnicalMetrics {
  if (!override) return { ...base };
  const merged: CultivarTechnicalMetrics = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined) {
      (merged as any)[key] = value;
    }
  }
  return merged;
}

export function buildSpeciesTechnicalKey(input: {
  especieNomeComum?: string | null;
  especieNomeCientifico?: string | null;
}): string {
  const scientific = normalize(input.especieNomeCientifico);
  const common = normalize(input.especieNomeComum);
  return scientific || common || 'especie-indefinida';
}

export function buildCultivarTechnicalKey(input: {
  speciesKey: string;
  cultivarNome?: string | null;
}): string {
  const cultivar = normalize(input.cultivarNome);
  if (!cultivar) return `${input.speciesKey}::cultivar-indefinida`;
  return `${input.speciesKey}::${cultivar}`;
}

export function listSpeciesTechnicalProfiles(): SpeciesTechnicalProfile[] {
  const state = readState();
  return [...state.species_profiles].sort((a, b) =>
    a.especie_nome_comum.localeCompare(b.especie_nome_comum, 'pt-BR'),
  );
}

export function listCultivarTechnicalProfiles(): CultivarTechnicalProfile[] {
  const state = readState();
  return [...state.cultivar_profiles].sort((a, b) =>
    a.cultivar_nome.localeCompare(b.cultivar_nome, 'pt-BR'),
  );
}

export function ensureSpeciesTechnicalProfile(input: {
  especieNomeComum: string;
  especieNomeCientifico?: string | null;
  grupoEspecie?: string | null;
}): SpeciesTechnicalProfile {
  const state = readState();
  const speciesKey = buildSpeciesTechnicalKey({
    especieNomeComum: input.especieNomeComum,
    especieNomeCientifico: input.especieNomeCientifico,
  });

  const existing = state.species_profiles.find(
    (item) => item.species_key === speciesKey,
  );
  if (existing) return existing;

  const createdAt = nowIso();
  const created: SpeciesTechnicalProfile = {
    id: createId(),
    species_key: speciesKey,
    especie_nome_comum: input.especieNomeComum.trim(),
    especie_nome_cientifico: String(input.especieNomeCientifico ?? '').trim(),
    grupo_especie: String(input.grupoEspecie ?? '').trim() || null,
    source: 'rnc',
    metrics: {},
    created_at: createdAt,
    updated_at: createdAt,
  };

  state.species_profiles.push(created);
  writeState(state);
  return created;
}

export function duplicateCultivarTechnicalProfile(input: {
  especieNomeComum: string;
  especieNomeCientifico?: string | null;
  grupoEspecie?: string | null;
  cultivarNome: string;
  rncDetailUrl?: string | null;
  nomeCopia?: string | null;
}): CultivarTechnicalProfile {
  const species = ensureSpeciesTechnicalProfile({
    especieNomeComum: input.especieNomeComum,
    especieNomeCientifico: input.especieNomeCientifico,
    grupoEspecie: input.grupoEspecie,
  });

  const state = readState();
  const baseCultivarName = input.cultivarNome.trim();
  const baseCultivarKey = buildCultivarTechnicalKey({
    speciesKey: species.species_key,
    cultivarNome: baseCultivarName,
  });
  const existingBase = state.cultivar_profiles.find(
    (item) => item.cultivar_key === baseCultivarKey,
  );

  const requestedName = String(input.nomeCopia ?? '').trim();
  let finalName =
    requestedName.length > 0 ? requestedName : `${baseCultivarName} (custom)`;
  let finalKey = buildCultivarTechnicalKey({
    speciesKey: species.species_key,
    cultivarNome: finalName,
  });
  let copyNumber = 2;
  while (state.cultivar_profiles.some((item) => item.cultivar_key === finalKey)) {
    finalName = `${requestedName || `${baseCultivarName} (custom)`} ${copyNumber}`;
    finalKey = buildCultivarTechnicalKey({
      speciesKey: species.species_key,
      cultivarNome: finalName,
    });
    copyNumber += 1;
  }

  const createdAt = nowIso();
  const created: CultivarTechnicalProfile = {
    id: createId(),
    species_key: species.species_key,
    cultivar_key: finalKey,
    cultivar_nome: finalName,
    source: 'clone_usuario',
    base_cultivar_key: baseCultivarKey,
    rnc_detail_url: String(input.rncDetailUrl ?? '').trim() || null,
    metrics: mergeDefinedMetrics(species.metrics, existingBase?.metrics ?? {}),
    created_at: createdAt,
    updated_at: createdAt,
  };

  state.cultivar_profiles.push(created);
  writeState(state);
  return created;
}

export function resolveCultivarTechnicalReference(input: {
  especieNomeComum?: string | null;
  especieNomeCientifico?: string | null;
  cultivarNome?: string | null;
  technicalProfileId?: string | null;
}): {
  speciesProfile: SpeciesTechnicalProfile | null;
  cultivarProfile: CultivarTechnicalProfile | null;
  resolvedMetrics: CultivarTechnicalMetrics | null;
  priority: 'cultivar' | 'especie' | 'none';
} {
  const state = readState();
  const speciesKey = buildSpeciesTechnicalKey({
    especieNomeComum: input.especieNomeComum,
    especieNomeCientifico: input.especieNomeCientifico,
  });
  const speciesProfile =
    state.species_profiles.find((item) => item.species_key === speciesKey) ?? null;

  const byId = String(input.technicalProfileId ?? '').trim();
  let cultivarProfile: CultivarTechnicalProfile | null = null;
  if (byId) {
    cultivarProfile =
      state.cultivar_profiles.find((item) => item.id === byId) ?? null;
  }
  if (!cultivarProfile) {
    const cultivarKey = buildCultivarTechnicalKey({
      speciesKey,
      cultivarNome: input.cultivarNome,
    });
    cultivarProfile =
      state.cultivar_profiles.find((item) => item.cultivar_key === cultivarKey) ??
      null;
  }

  if (cultivarProfile && speciesProfile) {
    return {
      speciesProfile,
      cultivarProfile,
      resolvedMetrics: mergeDefinedMetrics(speciesProfile.metrics, cultivarProfile.metrics),
      priority: 'cultivar',
    };
  }
  if (cultivarProfile) {
    return {
      speciesProfile: null,
      cultivarProfile,
      resolvedMetrics: { ...cultivarProfile.metrics },
      priority: 'cultivar',
    };
  }
  if (speciesProfile) {
    return {
      speciesProfile,
      cultivarProfile: null,
      resolvedMetrics: { ...speciesProfile.metrics },
      priority: 'especie',
    };
  }
  return {
    speciesProfile: null,
    cultivarProfile: null,
    resolvedMetrics: null,
    priority: 'none',
  };
}
