/**
 * Serviço de sincronização em lote de culturas do RNC
 * Implementa verificação por hash, sincronização automática semanal
 * e logging detalhado de erros
 */

import { supabaseClient } from '../supabase/supabaseClient';
import type { RncCultivarRecord } from './rncCultivarService';
import { isLocalDataMode } from './dataProvider';
import { storageReadJson, storageWriteJson } from './safeLocalStorage';
import { importOrEnsureSpecies, importCultivar } from './cultureImportService';

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

export interface SyncLog {
  id: string;
  sync_batch_id: string;
  sync_type: 'auto' | 'manual';
  triggered_by: string | null;
  started_at: string;
  completed_at: string | null;
  total_records: number;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  status: 'running' | 'completed' | 'failed';
  error_message: string | null;
  details: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  batch_id: string;
  total_records: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  log_id: string;
  error_details?: Array<{ rnc_uid: string; error: string }>;
  duration_ms: number;
}

/** Storage keys (modo local) */
const RNC_LOGS_KEY = 'perfilsolo_rnc_import_logs_v1';
const RNC_HASHES_KEY = 'perfilsolo_rnc_import_hashes_v1';
const RNC_SYNC_STATE_KEY = 'perfilsolo_rnc_sync_state_v1';

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
function readLogs(): SyncLog[] {
  const rows = storageReadJson<SyncLog[]>(RNC_LOGS_KEY, []);
  return Array.isArray(rows) ? rows : [];
}
function writeLogs(rows: SyncLog[]): void {
  storageWriteJson(RNC_LOGS_KEY, rows.slice(-1000));
}
function readHashes(): Record<string, Record<string, any>> {
  const map = storageReadJson<Record<string, Record<string, any>>>(
    RNC_HASHES_KEY,
    {},
  );
  return map && typeof map === 'object' ? map : {};
}
function writeHashes(map: Record<string, Record<string, any>>): void {
  storageWriteJson(RNC_HASHES_KEY, map);
}
function readSyncState(): any {
  const state = storageReadJson<any>(RNC_SYNC_STATE_KEY, null);
  return state || null;
}
function writeSyncState(state: any): void {
  storageWriteJson(RNC_SYNC_STATE_KEY, state);
}

/**
 * Gera hash de um registro para comparação
 */
function generateRecordHash(record: RncCultivarRecord): string {
  const normalized = {
    especie_nome_comum: record.especie_nome_comum?.trim().toLowerCase(),
    especie_nome_cientifico: record.especie_nome_cientifico
      ?.trim()
      .toLowerCase(),
    cultivar: record.cultivar?.trim().toLowerCase(),
    tipo_registro: record.tipo_registro?.trim().toLowerCase(),
    grupo_especie: record.grupo_especie?.trim().toLowerCase(),
    situacao: record.situacao?.trim().toLowerCase(),
  };

  return btoa(JSON.stringify(normalized));
}

/**
 * Gera ID único para registro RNC
 */
function generateRncUid(record: RncCultivarRecord): string {
  const scientific = record.especie_nome_cientifico?.trim().toLowerCase() || '';
  const common = record.especie_nome_comum?.trim().toLowerCase() || '';
  const cultivar = record.cultivar?.trim().toLowerCase() || '';

  return `${scientific || common}|${cultivar}`;
}

/**
 * Cria novo log de sincronização
 */
async function createSyncLog(
  type: 'auto' | 'manual',
  totalRecords: number,
): Promise<string> {
  const batchId = `batch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userId = getUserId();

  if (isLocalDataMode) {
    const rows = readLogs();
    const id = makeId('log');
    const created: SyncLog = {
      id,
      sync_batch_id: batchId,
      sync_type: type,
      triggered_by: userId || null,
      started_at: nowIso(),
      completed_at: null,
      total_records: totalRecords,
      imported_count: 0,
      updated_count: 0,
      skipped_count: 0,
      error_count: 0,
      status: 'running',
      error_message: null,
      details: {},
    };
    rows.unshift(created);
    writeLogs(rows);
    return id;
  }

  const { data, error } = await supabaseClient
    .from('culture_import_logs')
    .insert({
      sync_batch_id: batchId,
      sync_type: type,
      triggered_by: userId || null,
      total_records: totalRecords,
      status: 'running',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Finaliza o log de sincronização
 */
async function finalizeSyncLog(
  logId: string,
  result: {
    imported: number;
    updated: number;
    skipped: number;
    errors: number;
    errorMessage?: string;
    details?: Record<string, any>;
  },
): Promise<void> {
  if (isLocalDataMode) {
    const rows = readLogs();
    const idx = rows.findIndex((r) => r.id === logId);
    if (idx >= 0) {
      const next: SyncLog = {
        ...rows[idx],
        completed_at: nowIso(),
        imported_count: result.imported,
        updated_count: result.updated,
        skipped_count: result.skipped,
        error_count: result.errors,
        status: 'completed',
        error_message: result.errorMessage || null,
        details: result.details || {},
      };
      rows[idx] = next;
      writeLogs(rows);
    }
    return;
  }

  const { error } = await supabaseClient
    .from('culture_import_logs')
    .update({
      completed_at: new Date().toISOString(),
      imported_count: result.imported,
      updated_count: result.updated,
      skipped_count: result.skipped,
      error_count: result.errors,
      status:
        result.errors === 0
          ? 'completed'
          : result.errors > 0
            ? 'completed'
            : 'failed',
      error_message: result.errorMessage || null,
      details: result.details || {},
    })
    .eq('id', logId);

  if (error) {
    console.error('Erro ao finalizar log:', error);
  }
}

/**
 * Verifica hash de um registro para detectar mudanças
 */
async function getExistingHash(
  rncUid: string,
  userId: string,
): Promise<{ id: string; hash: string } | null> {
  if (isLocalDataMode) {
    const map = readHashes();
    const userMap = map[userId] || {};
    const row = userMap[rncUid];
    return row ? { id: row.id, hash: row.data_hash } : null;
  }

  const { data, error } = await supabaseClient
    .from('culture_import_hashes')
    .select('id, data_hash')
    .eq('user_id', userId)
    .eq('rnc_uid', rncUid)
    .single();

  if (error) return null;
  return data ? { id: data.id, hash: data.data_hash } : null;
}

/**
 * Atualiza hash de um registro
 */
async function updateRecordHash(
  userId: string,
  rncUid: string,
  newHash: string,
  speciesProfileId?: string | null,
  cultivarProfileId?: string | null,
): Promise<void> {
  if (isLocalDataMode) {
    const map = readHashes();
    const userMap = map[userId] || {};
    const existing = userMap[rncUid];
    if (existing) {
      userMap[rncUid] = {
        ...existing,
        data_hash: newHash,
        last_synced_at: nowIso(),
      };
    } else {
      userMap[rncUid] = {
        id: makeId('hsh'),
        user_id: userId,
        rnc_uid: rncUid,
        data_hash: newHash,
        species_profile_id: speciesProfileId || null,
        cultivar_profile_id: cultivarProfileId || null,
        last_synced_at: nowIso(),
      };
    }
    map[userId] = userMap;
    writeHashes(map);
    return;
  }

  const existing = await getExistingHash(rncUid, userId);

  if (existing) {
    const { error } = await supabaseClient
      .from('culture_import_hashes')
      .update({
        data_hash: newHash,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) {
      console.error('Erro ao atualizar hash:', error);
    }
  } else {
    const { error } = await supabaseClient
      .from('culture_import_hashes')
      .insert({
        user_id: userId,
        rnc_uid: rncUid,
        data_hash: newHash,
        species_profile_id: speciesProfileId || null,
        cultivar_profile_id: cultivarProfileId || null,
      });

    if (error) {
      console.error('Erro ao inserir hash:', error);
    }
  }
}

/**
 * Sincroniza um registro RNC com o banco de dados
 * Retorna status: 'imported', 'updated', 'skipped' ou erro
 */
async function syncSingleRecord(
  record: RncCultivarRecord,
  userId: string,
): Promise<{
  status: 'imported' | 'updated' | 'skipped';
  species_profile_id?: string;
  cultivar_profile_id?: string;
}> {
  const rncUid = generateRncUid(record);
  const newHash = generateRecordHash(record);
  const existingHash = await getExistingHash(rncUid, userId);

  if (existingHash && existingHash.hash === newHash) {
    return { status: 'skipped' };
  }

  let speciesId: string;
  let cultivarId: string | undefined;

  if (isLocalDataMode) {
    const speciesRes = await importOrEnsureSpecies(record);
    if (!speciesRes) throw new Error('Falha ao criar/obter espécie');
    speciesId = speciesRes.id;

    if (record.cultivar && record.cultivar.trim() !== '') {
      const cultivarRes = await importCultivar(record, speciesId);
      cultivarId = cultivarRes?.id;
    }
  } else {
    // Supabase caminho
    const normSpeciesKey = `${record.especie_nome_cientifico?.trim().toLowerCase() ||
      record.especie_nome_comum?.trim().toLowerCase() ||
      `especie-${Date.now()}`
      }`;

    const { data: speciesData } = await supabaseClient
      .from('crop_species_profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('species_key', normSpeciesKey)
      .maybeSingle();

    if (speciesData) {
      speciesId = speciesData.id;
    } else {
      const { data: created, error: createError } = await supabaseClient
        .from('crop_species_profiles')
        .insert({
          user_id: userId,
          species_key: normSpeciesKey,
          especie_nome_comum: record.especie_nome_comum,
          especie_nome_cientifico: record.especie_nome_cientifico || null,
          grupo_especie: record.grupo_especie || null,
          source: 'rnc',
          technical_data: {},
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Erro ao criar espécie:', createError);
        throw new Error(`Falha ao criar espécie: ${createError.message}`);
      }

      speciesId = created.id;
    }

    if (record.cultivar && record.cultivar.trim() !== '') {
      const normCultivarKey = `${normSpeciesKey}::${record.cultivar.trim().toLowerCase()}`;
      const { data: cultivarData } = await supabaseClient
        .from('crop_cultivar_profiles')
        .select('id')
        .eq('user_id', userId)
        .eq('cultivar_key', normCultivarKey)
        .maybeSingle();

      if (cultivarData) {
        cultivarId = cultivarData.id;
      } else {
        const { data: created, error: createError } = await supabaseClient
          .from('crop_cultivar_profiles')
          .insert({
            user_id: userId,
            species_profile_id: speciesId,
            cultivar_key: normCultivarKey,
            cultivar_nome: record.cultivar,
            source: 'rnc',
            base_cultivar_key: null,
            rnc_detail_url: record.rnc_detail_url || null,
            technical_data: {},
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Erro ao criar cultivar:', createError);
          throw new Error(`Falha ao criar cultivar: ${createError.message}`);
        }

        cultivarId = created.id;
      }
    }
  }

  await updateRecordHash(userId, rncUid, newHash, speciesId, cultivarId);

  const isUpdate = existingHash !== null;

  return {
    status: isUpdate ? 'updated' : 'imported',
    species_profile_id: speciesId,
    cultivar_profile_id: cultivarId,
  };
}

/**
 * Sincroniza múltiplos registros do RNC em lote
 * Otimizado com batches e tratamento de erros
 */
export async function bulkSyncRncRecords(
  records: RncCultivarRecord[],
  type: 'auto' | 'manual' = 'manual',
): Promise<SyncResult> {
  const startTime = Date.now();
  const userId = getUserId();

  if (!userId) {
    throw new Error('Usuário não autenticado');
  }

  if (records.length === 0) {
    return {
      success: true,
      batch_id: `batch-empty-${Date.now()}`,
      total_records: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      log_id: '',
      duration_ms: 0,
    };
  }

  let logId = '';
  const errorDetails: Array<{ rnc_uid: string; error: string }> = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    logId = await createSyncLog(type, records.length);

    // Processa registros em lotes de 10 para não sobrecarregar
    const BATCH_SIZE = 10;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((record) => syncSingleRecord(record, userId)),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const record = batch[j];
        const rncUid = generateRncUid(record);

        if (result.status === 'fulfilled') {
          if (result.value.status === 'imported') imported++;
          else if (result.value.status === 'updated') updated++;
          else skipped++;
        } else {
          errors++;
          const errorMsg =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          errorDetails.push({
            rnc_uid: rncUid,
            error: errorMsg,
          });
          console.error(`Erro ao sincronizar ${rncUid}:`, result.reason);
        }
      }
    }

    // Finaliza log
    await finalizeSyncLog(logId, {
      imported,
      updated,
      skipped,
      errors,
      details: {
        error_details: errorDetails.slice(0, 10), // Primeiros 10 erros
        batch_size: BATCH_SIZE,
      },
    });

    const duration = Date.now() - startTime;

    return {
      success: errors === 0,
      batch_id: logId,
      total_records: records.length,
      imported,
      updated,
      skipped,
      errors,
      log_id: logId,
      error_details: errorDetails.slice(0, 10),
      duration_ms: duration,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'Erro desconhecido';

    if (logId) {
      await finalizeSyncLog(logId, {
        imported,
        updated,
        skipped,
        errors: errors + 1,
        errorMessage: errorMsg,
      });
    }

    throw new Error(`Falha na sincronização em lote: ${errorMsg}`);
  }
}




















































































































/**
 * Obtém logs de sincronização (apenas super usuários)
 */

export async function getSyncLogs(limit: number = 50): Promise<SyncLog[]> {
  if (isLocalDataMode) {
    return readLogs().slice(0, Math.max(1, limit));
  }

  const { data, error } = await supabaseClient
    .from('culture_import_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Erro ao buscar logs:', error);
    return [];
  }

  return (data || []) as SyncLog[];
}

/**
 * Obtém estado de sincronização global
 */

export async function getSyncState(): Promise<{
  last_sync_at: string | null;
  total_synced: number;
  next_sync: string | null;
  is_enabled: boolean;
} | null> {
  if (isLocalDataMode) {
    const state = readSyncState();
    if (!state) {
      return {
        last_sync_at: null,
        total_synced: 0,
        next_sync: null,
        is_enabled: true,
      };
    }
    return {
      last_sync_at: state.last_full_sync_at ?? null,
      total_synced: Number(state.total_synced_records ?? 0) || 0,
      next_sync: state.next_scheduled_sync ?? null,
      is_enabled: state.is_enabled ?? true,
    };
  }

  const { data, error } = await supabaseClient
    .from('culture_sync_state')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar estado de sync:', error);
    return null;
  }

  return data
    ? {
      last_sync_at: data.last_full_sync_at,
      total_synced: data.total_synced_records,
      next_sync: data.next_scheduled_sync,
      is_enabled: data.is_enabled,
    }
    : null;
}

/**
 * Agenda próxima sincronização automática
 */

export async function scheduleNextSync(
  intervalHours: number = 168,
): Promise<void> {
  const nextSync = new Date();
  nextSync.setHours(nextSync.getHours() + intervalHours);

  if (isLocalDataMode) {
    const state = readSyncState() || {};
    const nextState = {
      ...state,
      last_full_sync_at: state.last_full_sync_at ?? null,
      total_synced_records: state.total_synced_records ?? 0,
      next_scheduled_sync: nextSync.toISOString(),
      sync_interval_hours: intervalHours,
      is_enabled: true,
    };
    writeSyncState(nextState);
    return;
  }

  const { data: existing } = await supabaseClient
    .from('culture_sync_state')
    .select('id')
    .limit(1)
    .single()
    .catch(() => ({ data: null }));

  if (existing) {
    const { error } = await supabaseClient
      .from('culture_sync_state')
      .update({
        next_scheduled_sync: nextSync.toISOString(),
        sync_interval_hours: intervalHours,
      })
      .eq('id', existing.id);

    if (error) console.error('Erro ao agendar próxima sync:', error);
  } else {
    const { error } = await supabaseClient.from('culture_sync_state').insert({
      last_full_sync_at: new Date().toISOString(),
      next_scheduled_sync: nextSync.toISOString(),
      sync_interval_hours: intervalHours,
      is_enabled: true,
    });

    if (error) console.error('Erro ao criar estado de sync:', error);
  }
}
