/**
 * Supabase Edge Function: cultureSyncCron
 * Sincronização semanal automática de culturas do RNC
 * Triggered via cron: semanalmente (domingo, 02:00 UTC)
 * Deploy: supabase functions deploy culture-sync-cron --project-id XXX
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface RncCultivarRecord {
  especie_nome_comum: string;
  especie_nome_cientifico: string;
  cultivar: string;
  tipo_registro: string;
  grupo_especie: string;
  situacao: string;
  rnc_detail_url?: string;
}

function getAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Variáveis de ambiente Supabase não configuradas');
  }

  return createClient(supabaseUrl, supabaseKey);
}

function generateRncUid(record: RncCultivarRecord): string {
  const scientific = record.especie_nome_cientifico?.trim().toLowerCase() || '';
  const common = record.especie_nome_comum?.trim().toLowerCase() || '';
  const cultivar = record.cultivar?.trim().toLowerCase() || '';

  return `${scientific || common}|${cultivar}`;
}

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

async function fetchRncData(): Promise<RncCultivarRecord[]> {
  const RNC_SEARCH_URL =
    'https://sistemas.agricultura.gov.br/snpc/cultivarweb/cultivares_registradas.php';
  const RNC_CSV_FORM = 'postado=1&acao=pesquisar&exportar=csv';

  try {
    const response = await fetch(RNC_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: RNC_CSV_FORM,
    });

    if (!response.ok) {
      throw new Error(`Falha ao baixar dados do RNC (HTTP ${response.status})`);
    }

    const csvText = await response.text();
    const lines = csvText.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      throw new Error('CSV do RNC vazio ou inválido');
    }

    const records: RncCultivarRecord[] = [];

    // Ignora cabeçalho
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length < 5) continue;

      records.push({
        especie_nome_comum: parts[0]?.trim() || '',
        especie_nome_cientifico: parts[1]?.trim() || '',
        cultivar: parts[2]?.trim() || '',
        tipo_registro: parts[3]?.trim() || 'CULTIVAR',
        grupo_especie: parts[4]?.trim() || '',
        situacao: parts[5]?.trim() || '',
      });
    }

    return records;
  } catch (error) {
    console.error('Erro ao buscar dados do RNC:', error);
    throw error;
  }
}

async function syncRecordsForUser(
  admin: any,
  userId: string,
  records: RncCultivarRecord[],
  logId: string,
): Promise<{
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const BATCH_SIZE = 15;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    for (const record of batch) {
      try {
        const rncUid = generateRncUid(record);
        const newHash = generateRecordHash(record);

        // Verifica hash existente
        const { data: existingHash, error: hashError } = await admin
          .from('culture_import_hashes')
          .select('data_hash')
          .eq('user_id', userId)
          .eq('rnc_uid', rncUid)
          .maybeSingle();

        if (existingHash?.data_hash === newHash) {
          skipped++;
          continue;
        }

        // Normaliza chave de espécie
        const normSpeciesKey = `${
          record.especie_nome_cientifico?.trim().toLowerCase() ||
          record.especie_nome_comum?.trim().toLowerCase() ||
          `especie-${Date.now()}`
        }`;

        // Busca ou cria espécie
        const { data: speciesData } = await admin
          .from('crop_species_profiles')
          .select('id')
          .eq('user_id', userId)
          .eq('species_key', normSpeciesKey)
          .maybeSingle();

        let speciesId: string;

        if (speciesData) {
          speciesId = speciesData.id;
        } else {
          const { data: created, error: speciesError } = await admin
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

          if (speciesError) {
            errors++;
            console.error(
              `Erro ao criar espécie para ${rncUid}:`,
              speciesError,
            );
            continue;
          }

          speciesId = created.id;
        }

        let cultivarId: string | undefined;

        // Se há cultivar, busca ou cria
        if (record.cultivar?.trim()) {
          const normCultivarKey = `${normSpeciesKey}::${record.cultivar
            .trim()
            .toLowerCase()}`;

          const { data: cultivarData } = await admin
            .from('crop_cultivar_profiles')
            .select('id')
            .eq('user_id', userId)
            .eq('cultivar_key', normCultivarKey)
            .maybeSingle();

          if (cultivarData) {
            cultivarId = cultivarData.id;
          } else {
            const { data: created, error: cvError } = await admin
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

            if (!cvError) {
              cultivarId = created.id;
            }
          }
        }

        // Atualiza ou insere hash
        const { error: hashUpsertError } = await admin
          .from('culture_import_hashes')
          .upsert(
            {
              user_id: userId,
              rnc_uid: rncUid,
              data_hash: newHash,
              species_profile_id: speciesId,
              cultivar_profile_id: cultivarId || null,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'user_id, rnc_uid' },
          );

        if (!hashUpsertError) {
          if (existingHash) {
            updated++;
          } else {
            imported++;
          }
        } else {
          errors++;
          console.error(
            `Erro ao atualizar hash para ${rncUid}:`,
            hashUpsertError,
          );
        }
      } catch (error) {
        errors++;
        console.error('Erro ao processar registro:', error);
      }
    }
  }

  return { imported, updated, skipped, errors };
}

serve(async (req) => {
  try {
    // Verifica se é chamada do cron (não requer auth)
    if (req.method === 'POST' && req.headers.get('x-cron-token') === null) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = getAdminClient();
    const startTime = Date.now();

    console.log('[CULTURE_SYNC_CRON] Iniciando sincronização semanal...');

    // 1. Busca dados do RNC
    const rncRecords = await fetchRncData();
    console.log(
      `[CULTURE_SYNC_CRON] Recuperados ${rncRecords.length} registros do RNC`,
    );

    // 2. Cria novo log de sincronização
    const batchId = `batch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const { data: logData } = await admin
      .from('culture_import_logs')
      .insert({
        sync_batch_id: batchId,
        sync_type: 'auto',
        triggered_by: null,
        total_records: rncRecords.length,
        status: 'running',
      })
      .select('id')
      .single();

    const logId = logData?.id;

    // 3. Busca todos os usuários ativos
    const { data: users, error: usersError } = await admin
      .from('users_registry')
      .select('id')
      .eq('active', true)
      .limit(1000);

    if (usersError) {
      throw new Error(`Erro ao buscar usuários: ${usersError.message}`);
    }

    let totalImported = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // 4. Sincroniza para cada usuário
    for (const user of users || []) {
      try {
        const result = await syncRecordsForUser(
          admin,
          user.id,
          rncRecords,
          logId || '',
        );
        totalImported += result.imported;
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
        totalErrors += result.errors;
      } catch (error) {
        console.error(`Erro ao sincronizar para usuário ${user.id}:`, error);
        totalErrors++;
      }
    }

    // 5. Finaliza log
    if (logId) {
      await admin
        .from('culture_import_logs')
        .update({
          completed_at: new Date().toISOString(),
          imported_count: totalImported,
          updated_count: totalUpdated,
          skipped_count: totalSkipped,
          error_count: totalErrors,
          status: totalErrors === 0 ? 'completed' : 'completed',
        })
        .eq('id', logId);
    }

    // 6. Atualiza estado global
    const nextSync = new Date();
    nextSync.setHours(nextSync.getHours() + 168); // 1 semana

    const { data: syncState } = await admin
      .from('culture_sync_state')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (syncState) {
      await admin
        .from('culture_sync_state')
        .update({
          last_full_sync_at: new Date().toISOString(),
          last_sync_batch_id: batchId,
          total_synced_records: totalImported + totalUpdated,
          next_scheduled_sync: nextSync.toISOString(),
        })
        .eq('id', syncState.id);
    } else {
      await admin.from('culture_sync_state').insert({
        last_full_sync_at: new Date().toISOString(),
        last_sync_batch_id: batchId,
        total_synced_records: totalImported + totalUpdated,
        next_scheduled_sync: nextSync.toISOString(),
        sync_interval_hours: 168,
        is_enabled: true,
      });
    }

    const duration = Date.now() - startTime;

    console.log('[CULTURE_SYNC_CRON] Sincronização concluída', {
      imported: totalImported,
      updated: totalUpdated,
      skipped: totalSkipped,
      errors: totalErrors,
      duration_ms: duration,
    });

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batchId,
        log_id: logId,
        imported: totalImported,
        updated: totalUpdated,
        skipped: totalSkipped,
        errors: totalErrors,
        duration_ms: duration,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: any) {
    console.error('[CULTURE_SYNC_CRON] Erro fatal:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error?.message || 'Erro desconhecido na sincronização de culturas',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
