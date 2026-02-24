/**
 * Serviço de importação de culturas do RNC para banco de dados local.
 * Sincroniza dados do RNC (Registro Nacional de Cultivares) com as tabelas:
 * - crop_species_profiles (espécies)
 * - crop_cultivar_profiles (cultivares)
 *
 * Implementa persistência local quando VITE_DATA_PROVIDER != 'supabase'.
 */

import { supabaseClient } from '../supabase/supabaseClient';
import type { RncCultivarRecord } from './rncCultivarService';
import { isLocalDataMode } from './dataProvider';
import { storageReadJson, storageWriteJson } from './safeLocalStorage';

/** Storage keys (modo local) */
const RNC_SPECIES_KEY = 'perfilsolo_rnc_species_profiles_v1';
const RNC_CULTIVARS_KEY = 'perfilsolo_rnc_cultivar_profiles_v1';

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Obtém o ID do usuário autenticado (compatível com modo local)
 */
function getUserId(): string | null {
  try {
    if (isLocalDataMode) {
      const hasSession =
        localStorage.getItem('perfilsolo_local_auth_session') === '1';
      const email = String(
        (
          localStorage.getItem('perfilsolo_local_auth_email') ||
          'local@perfilsolo.app'
        )
          .toString()
          .trim()
          .toLowerCase(),
      );
      if (!hasSession || !email) return null;
      const slug = email.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
      return `local-${slug || 'user'}`;
    }

    const userJson =
      localStorage.getItem('sb-auth-user') || localStorage.getItem('sb-user');
    if (!userJson) return null;
    const user = JSON.parse(userJson);
    return user?.id || null;
  } catch {
    return null;
  }
}

export interface ImportedSpecies {
  id: string;
  species_key: string;
  especie_nome_comum: string;
  especie_nome_cientifico: string;
  grupo_especie: string | null;
  technical_data: Record<string, any>;
}

export interface ImportedCultivar {
  id: string;
  species_profile_id: string;
  cultivar_key: string;
  cultivar_nome: string;
  base_cultivar_key: string | null;
  rnc_detail_url: string | null;
  technical_data: Record<string, any>;
}

export interface ImportResult {
  success: boolean;
  message: string;
  species?: ImportedSpecies;
  cultivar?: ImportedCultivar;
  error?: string;
}

export interface BulkImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ rnc_uid: string; error: string }>;
}

/** Helpers armazenamento local */
function readSpeciesMap(): Record<string, ImportedSpecies[]> {
  const parsed = storageReadJson<Record<string, ImportedSpecies[]>>(
    RNC_SPECIES_KEY,
    {},
  );
  return parsed && typeof parsed === 'object' ? parsed : {};
}
function writeSpeciesMap(map: Record<string, ImportedSpecies[]>): void {
  storageWriteJson(RNC_SPECIES_KEY, map);
}
function readCultivarsMap(): Record<string, ImportedCultivar[]> {
  const parsed = storageReadJson<Record<string, ImportedCultivar[]>>(
    RNC_CULTIVARS_KEY,
    {},
  );
  return parsed && typeof parsed === 'object' ? parsed : {};
}
function writeCultivarsMap(map: Record<string, ImportedCultivar[]>): void {
  storageWriteJson(RNC_CULTIVARS_KEY, map);
}

/**
 * Normaliza string para chave única
 */
function normalizeKey(input?: string | null): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Cria chave única para espécie baseada em nome científico ou comum
 */
function buildSpeciesKey(record: RncCultivarRecord): string {
  const scientific = normalizeKey(record.especie_nome_cientifico);
  const common = normalizeKey(record.especie_nome_comum);
  return scientific || common || `especie-${Date.now()}`;
}

/**
 * Cria chave única para cultivar baseada em espécie + cultivar
 */
function buildCultivarKey(speciesKey: string, cultivarName?: string): string {
  const cultivar = normalizeKey(cultivarName);
  if (!cultivar) return `${speciesKey}::cultivar-indefinida`;
  return `${speciesKey}::${cultivar}`;
}

/**
 * Importa ou garante existência de espécie no banco de dados
 */
export async function importOrEnsureSpecies(
  record: RncCultivarRecord,
): Promise<{ id: string; species_key: string } | null> {
  try {
    const userId = getUserId();
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }

    const speciesKey = buildSpeciesKey(record);

    if (isLocalDataMode) {
      const map = readSpeciesMap();
      const rows = map[userId] ?? [];
      const existing = rows.find((r) => r.species_key === speciesKey);
      if (existing)
        return { id: existing.id, species_key: existing.species_key };

      const created: ImportedSpecies = {
        id: makeId('spc'),
        species_key: speciesKey,
        especie_nome_comum: record.especie_nome_comum,
        especie_nome_cientifico: record.especie_nome_cientifico || '',
        grupo_especie: record.grupo_especie || null,
        technical_data: {},
      };
      map[userId] = [...rows, created];
      writeSpeciesMap(map);
      return { id: created.id, species_key: created.species_key };
    }

    // Supabase
    const { data: existing, error: queryError } = await supabaseClient
      .from('crop_species_profiles')
      .select('id, species_key')
      .eq('user_id', userId)
      .eq('species_key', speciesKey)
      .single();

    if (!queryError && existing) {
      return { id: existing.id, species_key: existing.species_key };
    }

    const { data: created, error: createError } = await supabaseClient
      .from('crop_species_profiles')
      .insert({
        user_id: userId,
        species_key: speciesKey,
        especie_nome_comum: record.especie_nome_comum,
        especie_nome_cientifico: record.especie_nome_cientifico || null,
        grupo_especie: record.grupo_especie || null,
        source: 'rnc',
        technical_data: {},
      })
      .select('id, species_key')
      .single();

    if (createError) {
      console.error('Erro ao criar espécie:', createError);
      return null;
    }

    return created;
  } catch (error) {
    console.error('Erro em importOrEnsureSpecies:', error);
    return null;
  }
}

/**
 * Importa cultivar vinculado à espécie
 * Retorna null se apenas espécie for solicitada
 */
export async function importCultivar(
  record: RncCultivarRecord,
  speciesId: string,
): Promise<ImportedCultivar | null> {
  try {
    const userId = getUserId();
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }

    if (!record.cultivar || record.cultivar.trim() === '') {
      return null;
    }

    const speciesKey = buildSpeciesKey(record);
    const cultivarKey = buildCultivarKey(speciesKey, record.cultivar);

    if (isLocalDataMode) {
      const map = readCultivarsMap();
      const rows = map[userId] ?? [];
      const existing = rows.find((r) => r.cultivar_key === cultivarKey);
      if (existing) return existing;

      const created: ImportedCultivar = {
        id: makeId('clt'),
        species_profile_id: speciesId,
        cultivar_key: cultivarKey,
        cultivar_nome: record.cultivar,
        base_cultivar_key: null,
        rnc_detail_url: record.rnc_detail_url || null,
        technical_data: {},
      };
      map[userId] = [...rows, created];
      writeCultivarsMap(map);
      return created;
    }

    // Supabase
    const { data: existing, error: queryError } = await supabaseClient
      .from('crop_cultivar_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('cultivar_key', cultivarKey)
      .single();

    if (!queryError && existing) {
      return existing;
    }

    const { data: created, error: createError } = await supabaseClient
      .from('crop_cultivar_profiles')
      .insert({
        user_id: userId,
        species_profile_id: speciesId,
        cultivar_key: cultivarKey,
        cultivar_nome: record.cultivar,
        source: 'rnc',
        base_cultivar_key: null,
        rnc_detail_url: record.rnc_detail_url || null,
        technical_data: {},
      })
      .select('*')
      .single();

    if (createError) {
      console.error('Erro ao criar cultivar:', createError);
      return null;
    }

    return created;
  } catch (error) {
    console.error('Erro em importCultivar:', error);
    return null;
  }
}

/**
 * Importa um registro completo do RNC (espécie + cultivar se existir)
 */
export async function importRncRecord(
  record: RncCultivarRecord,
  includeOnlyCultivar: boolean = false,
): Promise<ImportResult> {
  try {
    const speciesResult = await importOrEnsureSpecies(record);
    if (!speciesResult) {
      return {
        success: false,
        message: 'Falha ao importar espécie',
        error: 'Erro ao criar/recuperar espécie do banco de dados',
      };
    }

    let speciesData: ImportedSpecies | null = null;

    if (isLocalDataMode) {
      const userId = getUserId();
      const map = readSpeciesMap();
      const rows = map[userId as string] ?? [];
      speciesData = rows.find((r) => r.id === speciesResult.id) ?? null;
    } else {
      const { data } = await supabaseClient
        .from('crop_species_profiles')
        .select('*')
        .eq('id', speciesResult.id)
        .single();
      speciesData = (data as ImportedSpecies) ?? null;
    }

    if (!speciesData) {
      return {
        success: false,
        message: 'Espécie não encontrada após criação',
        error: 'Erro de consistência ao recuperar espécie',
      };
    }

    const resultObject: ImportResult = {

      success: true,
      message: `Espécie "${record.especie_nome_comum}" importada com sucesso`,
      species: speciesData,
    } as ImportResult;

    if (
      !includeOnlyCultivar &&
      record.cultivar &&
      record.cultivar.trim() !== ''
    ) {
      const cultivarResult = await importCultivar(record, speciesResult.id);
      if (cultivarResult) {
        resultObject.cultivar = cultivarResult;
        resultObject.message += ` com cultivar "${record.cultivar}"`;
      }
    }

    return resultObject;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      success: false,
      message: 'Erro ao importar registro do RNC',
      error: errorMessage,
    };
  }
}

/**
 * Importa múltiplos registros do RNC em lote
 */
export async function bulkImportRncRecords(
  records: RncCultivarRecord[],
): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    total: records.length,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  for (const record of records) {
    try {
      const importResult = await importRncRecord(record);
      if (importResult.success) {
        result.imported++;
      } else {
        result.errors.push({
          rnc_uid: `${record.especie_nome_comum}/${record.cultivar}`,
          error: importResult.error || 'Erro desconhecido',
        });
        result.skipped++;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push({
        rnc_uid: `${record.especie_nome_comum}/${record.cultivar}`,
        error: errorMessage,
      });
      result.skipped++;
    }
  }

  return result;
}

/**
 * Lista espécies importadas do usuário
 */
export async function listUserSpecies(): Promise<ImportedSpecies[]> {
  try {
    const userId = getUserId();
    if (!userId) return [];

    if (isLocalDataMode) {
      const map = readSpeciesMap();
      const rows = map[userId] ?? [];
      return [...rows].sort((a, b) =>
        a.especie_nome_comum.localeCompare(b.especie_nome_comum, 'pt-BR'),
      );
    }

    const { data, error } = await supabaseClient
      .from('crop_species_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('especie_nome_comum', { ascending: true });

    if (error) {
      console.error('Erro ao listar espécies:', error);
      return [];
    }

    return (data || []) as ImportedSpecies[];
  } catch (error) {
    console.error('Erro em listUserSpecies:', error);
    return [];
  }
}

/**
 * Lista cultivares importados do usuário com dados da espécie
 */
export async function listUserCultivars(): Promise<
  (ImportedCultivar & { species: ImportedSpecies })[]
> {
  try {
    const userId = getUserId();
    if (!userId) return [];

    if (isLocalDataMode) {
      const sMap = readSpeciesMap();
      const cMap = readCultivarsMap();
      const species = sMap[userId] ?? [];
      const cultivars = cMap[userId] ?? [];
      const byId = new Map(species.map((s) => [s.id, s] as const));
      return cultivars
        .map((c) => ({
          ...(c as any),
          species: byId.get(c.species_profile_id),
        }))
        .filter((row) => row.species)
        .sort((a, b) =>
          a.cultivar_nome.localeCompare(b.cultivar_nome, 'pt-BR'),
        ) as any;
    }

    const { data, error } = await supabaseClient
      .from('crop_cultivar_profiles')
      .select(
        `
        *,
        species:crop_species_profiles(*)
      `,
      )
      .eq('user_id', userId)
      .order('cultivar_nome', { ascending: true });

    if (error) {
      console.error('Erro ao listar cultivares:', error);
      return [];
    }

    return (data || []) as any;
  } catch (error) {
    console.error('Erro em listUserCultivars:', error);
    return [];
  }
}

/**
 * Verifica se uma espécie já foi importada
 */
export async function speciesExists(speciesKey: string): Promise<boolean> {
  try {
    const userId = getUserId();
    if (!userId) return false;

    if (isLocalDataMode) {
      const rows = (readSpeciesMap()[userId] ?? []) as ImportedSpecies[];
      return rows.some((r) => r.species_key === String(speciesKey).trim());
    }

    const { data, error } = await supabaseClient
      .from('crop_species_profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('species_key', speciesKey)
      .single();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Verifica se um cultivar já foi importado
 */
export async function cultivarExists(cultivarKey: string): Promise<boolean> {
  try {
    const userId = getUserId();
    if (!userId) return false;

    if (isLocalDataMode) {
      const rows = (readCultivarsMap()[userId] ?? []) as ImportedCultivar[];
      return rows.some((r) => r.cultivar_key === String(cultivarKey).trim());
    }

    const { data, error } = await supabaseClient
      .from('crop_cultivar_profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('cultivar_key', cultivarKey)
      .single();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Atualiza dados técnicos de uma espécie
 */
export async function updateSpeciesTechnicalData(
  speciesId: string,
  technicalData: Record<string, any>,
): Promise<ImportedSpecies | null> {
  try {
    if (isLocalDataMode) {
      const userId = getUserId();
      if (!userId) return null;
      const map = readSpeciesMap();
      const rows = map[userId] ?? [];
      const idx = rows.findIndex((r) => r.id === speciesId);
      if (idx < 0) return null;
      const next: ImportedSpecies = {
        ...rows[idx],
        technical_data: technicalData,
      };
      rows[idx] = next;
      map[userId] = rows;
      writeSpeciesMap(map);
      return next;
    }

    const { data, error } = await supabaseClient
      .from('crop_species_profiles')
      .update({ technical_data: technicalData })
      .eq('id', speciesId)
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao atualizar dados técnicos da espécie:', error);
      return null;
    }

    return data as ImportedSpecies;
  } catch (error) {
    console.error('Erro em updateSpeciesTechnicalData:', error);
    return null;
  }
}

/**
 * Atualiza dados técnicos de um cultivar
 */
export async function updateCultivarTechnicalData(
  cultivarId: string,
  technicalData: Record<string, any>,
): Promise<ImportedCultivar | null> {
  try {
    if (isLocalDataMode) {
      const userId = getUserId();
      if (!userId) return null;
      const map = readCultivarsMap();
      const rows = map[userId] ?? [];
      const idx = rows.findIndex((r) => r.id === cultivarId);
      if (idx < 0) return null;
      const next: ImportedCultivar = {
        ...rows[idx],
        technical_data: technicalData,
      };
      rows[idx] = next;
      map[userId] = rows;
      writeCultivarsMap(map);
      return next;
    }

    const { data, error } = await supabaseClient
      .from('crop_cultivar_profiles')
      .update({ technical_data: technicalData })
      .eq('id', cultivarId)
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao atualizar dados técnicos do cultivar:', error);
      return null;
    }

    return data as ImportedCultivar;
  } catch (error) {
    console.error('Erro em updateCultivarTechnicalData:', error);
    return null;
  }
}

/**
 * Resolve qual perfil técnico usar (cultivar > espécie)
 */
export function resolvePriority(
  species: ImportedSpecies | null,
  cultivar: ImportedCultivar | null,
): {
  priority: 'cultivar' | 'especie' | 'none';
  profile: ImportedSpecies | ImportedCultivar | null;
  technical_data: Record<string, any>;
} {
  if (cultivar && species) {
    return {
      priority: 'cultivar',
      profile: cultivar,
      technical_data: {
        ...species.technical_data,
        ...cultivar.technical_data,
      },
    };
  }

  if (cultivar) {
    return {
      priority: 'cultivar',
      profile: cultivar,
      technical_data: cultivar.technical_data,
    };
  }

  if (species) {
    return {
      priority: 'especie',
      profile: species,
      technical_data: species.technical_data,
    };
  }

  return {
    priority: 'none',
    profile: null,
    technical_data: {},
  };
}

/**
 * Interface para rastreamento de importação completa do RNC
 */
export interface FullRncImportResult {
  success: boolean;
  total_processed: number;
  total_imported: number;
  total_skipped: number;
  total_errors: number;
  pages_processed: number;
  groups_imported: string[];
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  sample_errors: Array<{ record: string; error: string }>;
}

/**
 * Importa TODAS as culturas do RNC com paginação completa
 * Busca e importa registros em páginas de até 500 itens
 * Requer autenticação de usuário
 */
export async function fullImportRncDatabase(
  onProgress?: (current: number, total: number, message: string) => void,
): Promise<FullRncImportResult> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  let totalProcessed = 0;
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let pagesProcessed = 0;
  const groupsImported = new Set<string>();
  const sampleErrors: Array<{ record: string; error: string }> = [];

  try {
    const { searchRncCultivars } = await import('./rncCultivarService');

    let currentPage = 1;
    let hasMorePages = true;
    const pageSize = 500;

    while (hasMorePages) {
      try {
        const message = `Buscando página ${currentPage}...`;
        onProgress?.(totalProcessed, 99999, message);

        const result = await searchRncCultivars({
          page: currentPage,
          pageSize,
        });

        if (!result.items || result.items.length === 0) {
          hasMorePages = false;
          break;
        }

        result.items.forEach((item) => {
          if (item.grupo_especie) {
            groupsImported.add(item.grupo_especie);
          }
        });

        const progressMessage = `Importando página ${currentPage}: ${result.items.length} registros`;
        onProgress?.(
          totalProcessed,
          totalProcessed + result.items.length,
          progressMessage,
        );

        const importResult = await bulkImportRncRecords(result.items);

        totalProcessed += importResult.total;
        totalImported += importResult.imported;
        totalSkipped += importResult.skipped;
        totalErrors += importResult.errors.length;

        if (sampleErrors.length < 10) {
          importResult.errors
            .slice(0, 10 - sampleErrors.length)
            .forEach((err) => {
              sampleErrors.push({ record: err.rnc_uid, error: err.error });
            });
        }

        pagesProcessed++;

        if (result.items.length < pageSize) {
          hasMorePages = false;
        } else {
          currentPage++;
        }
      } catch (pageError) {
        const errorMessage =
          pageError instanceof Error
            ? pageError.message
            : 'Erro desconhecido na página';
        console.error(`Erro ao processar página ${currentPage}:`, errorMessage);

        if (sampleErrors.length < 10) {
          sampleErrors.push({
            record: `Página ${currentPage}`,
            error: errorMessage,
          });
        }

        currentPage++;
      }
    }

    const endTime = Date.now();
    const completedAt = new Date().toISOString();
    const durationSeconds = Math.round((endTime - startTime) / 1000);

    return {
      success: totalErrors === 0 || totalImported > 0,
      total_processed: totalProcessed,
      total_imported: totalImported,
      total_skipped: totalSkipped,
      total_errors: totalErrors,
      pages_processed: pagesProcessed,
      groups_imported: Array.from(groupsImported).sort(),
      started_at: startedAt,
      completed_at: completedAt,
      duration_seconds: durationSeconds,
      sample_errors: sampleErrors,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    const endTime = Date.now();
    const completedAt = new Date().toISOString();
    const durationSeconds = Math.round((endTime - startTime) / 1000);

    return {
      success: false,
      total_processed: totalProcessed,
      total_imported: totalImported,
      total_skipped: totalSkipped,
      total_errors: totalErrors + 1,
      pages_processed: pagesProcessed,
      groups_imported: Array.from(groupsImported).sort(),
      started_at: startedAt,
      completed_at: completedAt,
      duration_seconds: durationSeconds,
      sample_errors: [
        ...sampleErrors,
        { record: 'Importação Geral', error: errorMessage },
      ],
    };
  }
}
