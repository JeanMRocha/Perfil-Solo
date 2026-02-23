/**
 * Supabase Edge Function: cleanup-data-retention
 * Executa limpeza de dados expirados (logs > 90 dias, hashes > 180 dias)
 * Triggered via cron: semanalmente (quarta-feira, 03:00 UTC)
 * Deploy: supabase functions deploy cleanup-data-retention --project-id XXX
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function getAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Variáveis de ambiente Supabase não configuradas');
  }

  return createClient(supabaseUrl, supabaseKey);
}

serve(async (req) => {
  try {
    // Verifica se é chamada do cron (apenas POST)
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = getAdminClient();
    const startTime = Date.now();

    console.log('[CLEANUP_CRON] Iniciando limpeza de dados expirados...');

    // ========================================================================
    // 1. Limpeza de Logs de Importação (> 90 dias)
    // ========================================================================

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { error: logsError, count: logsDeleted } = await admin
      .from('culture_import_logs')
      .delete()
      .lt('created_at', ninetyDaysAgo.toISOString());

    if (logsError) {
      console.error('[CLEANUP_CRON] Erro ao deletar logs:', logsError);
    } else {
      console.log(`[CLEANUP_CRON] Deletados ${logsDeleted || 0} logs antigos`);
    }

    // ========================================================================
    // 2. Limpeza de Hashes Expirados (> 180 dias do último sync)
    // ========================================================================

    const oneSixtyDaysAgo = new Date();
    oneSixtyDaysAgo.setDate(oneSixtyDaysAgo.getDate() - 180);

    const { error: hashesError, count: hashesDeleted } = await admin
      .from('culture_import_hashes')
      .delete()
      .lt('last_synced_at', oneSixtyDaysAgo.toISOString());

    if (hashesError) {
      console.error('[CLEANUP_CRON] Erro ao deletar hashes:', hashesError);
    } else {
      console.log(
        `[CLEANUP_CRON] Deletados ${hashesDeleted || 0} hashes expirados`,
      );
    }

    // ========================================================================
    // 3. Atualizar estado de limpeza
    // ========================================================================

    const cleanupResults = {
      logs_deleted: logsDeleted || 0,
      hashes_deleted: hashesDeleted || 0,
      executed_at: new Date().toISOString(),
    };

    // Registra estado da limpeza (opcional)
    for (const jobType of ['cleanup_logs', 'cleanup_hashes']) {
      const { error: stateError } = await admin.from('cleanup_state').upsert(
        {
          job_type: jobType,
          last_executed_at: new Date().toISOString(),
          status: 'completed',
          last_error: null,
        },
        { onConflict: 'job_type' },
      );

      if (stateError) {
        console.error(
          `[CLEANUP_CRON] Erro ao atualizar estado ${jobType}:`,
          stateError,
        );
      }
    }

    const duration = Date.now() - startTime;

    console.log('[CLEANUP_CRON] Limpeza concluída', {
      logs_deleted: cleanupResults.logs_deleted,
      hashes_deleted: cleanupResults.hashes_deleted,
      duration_ms: duration,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Limpeza de dados expirados concluída',
        results: {
          import_logs_deleted: cleanupResults.logs_deleted,
          import_hashes_deleted: cleanupResults.hashes_deleted,
          executed_at: cleanupResults.executed_at,
          duration_ms: duration,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: any) {
    console.error('[CLEANUP_CRON] Erro fatal:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Erro desconhecido na limpeza de dados',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
