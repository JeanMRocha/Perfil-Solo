import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  try {
    // Apenas aceita cron (POST sem body) ou requests diretas
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    console.log('[cleanup-import-logs] Iniciando limpeza de logs...');
    const startTime = Date.now();

    // 1. Chama RPC para deletar logs > 90 dias
    const cleanupRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/cleanup_expired_import_logs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
    );

    if (!cleanupRes.ok) {
      throw new Error(`Cleanup RPC failed: ${cleanupRes.statusText}`);
    }

    const cleanupResult = await cleanupRes.json();
    const deletedCount = cleanupResult[0]?.deleted_count || 0;

    // 2. Obtém estatísticas pós-limpeza
    const statsRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_unresolved_errors_stats`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
    );

    let stats = null;
    if (statsRes.ok) {
      stats = await statsRes.json();
    }

    const duration = Date.now() - startTime;

    const result = {
      success: true,
      deleted_logs: deletedCount,
      executed_at: new Date().toISOString(),
      duration_ms: duration,
      stats: stats,
      message: `Deletados ${deletedCount} logs com mais de 90 dias`,
    };

    console.log('[cleanup-import-logs]', result.message);
    console.log('[cleanup-import-logs] Tempo total:', duration, 'ms');
    if (stats) {
      console.log('[cleanup-import-logs] Estatísticas:', stats);
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[cleanup-import-logs] Erro:', errorMsg);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
        executed_at: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
