/**
 * Serviço de gerenciamento de retenção de dados e limpeza
 * Fornece interfaces para limpeza manual e visualização de estado
 */

import { supabaseClient } from '../supabase/supabaseClient';

export interface CleanupJob {
  job_type: string;
  last_executed_at: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CleanupResult {
  job_name: string;
  deleted_count: number;
  error_message: string | null;
}

export interface CleanupState {
  success: boolean;
  results: Array<{
    import_logs_deleted: number;
    import_hashes_deleted: number;
    executed_at: string;
    duration_ms: number;
  }>;
  error?: string;
}

/**
 * Obtém estado atual de todos os jobs de limpeza
 */
export async function getCleanupState(): Promise<CleanupJob[]> {
  try {
    const { data, error } = await supabaseClient
      .from('cleanup_state')
      .select('*')
      .order('job_type', { ascending: true });

    if (error) {
      console.error('Erro ao buscar estado de limpeza:', error);
      return [];
    }

    return (data || []) as CleanupJob[];
  } catch (error) {
    console.error('Erro em getCleanupState:', error);
    return [];
  }
}

/**
 * Executa limpeza manual de logs expirados (> 90 dias)
 * Apenas super usuários podem chamar esta função
 */
export async function cleanupExpiredLogs(): Promise<{
  success: boolean;
  deleted_count: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabaseClient.rpc(
      'cleanup_expired_import_logs',
    );

    if (error) {
      return {
        success: false,
        deleted_count: 0,
        error: error.message,
      };
    }

    const result = Array.isArray(data) ? data[0] : data;
    return {
      success: !result?.error_message,
      deleted_count: result?.deleted_count || 0,
      error: result?.error_message || undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      success: false,
      deleted_count: 0,
      error: errorMessage,
    };
  }
}

/**
 * Executa limpeza manual de hashes expirados (> 180 dias do último sync)
 * Apenas super usuários podem chamar esta função
 */
export async function cleanupStaleHashes(): Promise<{
  success: boolean;
  deleted_count: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabaseClient.rpc(
      'cleanup_stale_import_hashes',
    );

    if (error) {
      return {
        success: false,
        deleted_count: 0,
        error: error.message,
      };
    }

    const result = Array.isArray(data) ? data[0] : data;
    return {
      success: !result?.error_message,
      deleted_count: result?.deleted_count || 0,
      error: result?.error_message || undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      success: false,
      deleted_count: 0,
      error: errorMessage,
    };
  }
}

/**
 * Executa todos os jobs de limpeza de uma vez
 */
export async function runAllCleanupJobs(): Promise<{
  success: boolean;
  total_deleted: number;
  results: Array<{
    job_name: string;
    deleted_count: number;
    error?: string;
  }>;
}> {
  try {
    const { data, error } = await supabaseClient.rpc('run_all_cleanup_jobs');

    if (error) {
      return {
        success: false,
        total_deleted: 0,
        results: [],
      };
    }

    const results = Array.isArray(data) ? data : [data];
    const total_deleted = results.reduce(
      (sum, r) => sum + (r.deleted_count || 0),
      0,
    );

    return {
      success: true,
      total_deleted,
      results: results.map((r) => ({
        job_name: r.job_name,
        deleted_count: r.deleted_count || 0,
        error: r.error_message || undefined,
      })),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      success: false,
      total_deleted: 0,
      results: [
        {
          job_name: 'all_jobs',
          deleted_count: 0,
          error: errorMessage,
        },
      ],
    };
  }
}

/**
 * Obtém estatísticas de retenção
 * Mostra quantos registros seriam deletados se rodasse a limpeza agora
 */
export async function getRetentionStats(): Promise<{
  logs_older_than_90_days: number;
  hashes_not_synced_180_days: number;
  last_cleanup: string | null;
  next_cleanup: string | null;
}> {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const oneSixtyDaysAgo = new Date();
    oneSixtyDaysAgo.setDate(oneSixtyDaysAgo.getDate() - 180);

    const [logsResult, hashesResult, cleanupStateResult] = await Promise.all([
      supabaseClient
        .from('culture_import_logs')
        .select('id', { count: 'exact' })
        .lt('created_at', ninetyDaysAgo.toISOString()),

      supabaseClient
        .from('culture_import_hashes')
        .select('id', { count: 'exact' })
        .lt('last_synced_at', oneSixtyDaysAgo.toISOString()),

      supabaseClient
        .from('cleanup_state')
        .select('last_executed_at')
        .eq('job_type', 'cleanup_logs')
        .single(),
    ]);

    const lastCleanup = cleanupStateResult.data?.last_executed_at || null;
    const nextCleanup = lastCleanup
      ? new Date(
          new Date(lastCleanup).getTime() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;

    return {
      logs_older_than_90_days: logsResult.count || 0,
      hashes_not_synced_180_days: hashesResult.count || 0,
      last_cleanup: lastCleanup,
      next_cleanup: nextCleanup,
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas de retenção:', error);
    return {
      logs_older_than_90_days: 0,
      hashes_not_synced_180_days: 0,
      last_cleanup: null,
      next_cleanup: null,
    };
  }
}

/**
 * Obtém logs de importação recentes (últimos 30 dias)
 */
export async function getRecentImportLogs(limit: number = 50): Promise<
  Array<{
    id: string;
    sync_batch_id: string;
    created_at: string;
    imported_count: number;
    updated_count: number;
    error_count: number;
    status: string;
  }>
> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabaseClient
      .from('culture_import_logs')
      .select(
        'id, sync_batch_id, created_at, imported_count, updated_count, error_count, status',
      )
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar logs recentes:', error);
      return [];
    }

    return (data || []) as any[];
  } catch (error) {
    console.error('Erro em getRecentImportLogs:', error);
    return [];
  }
}

/**
 * Marca um log de importação como resolvido
 */
export async function markImportLogResolved(
  logId: string,
  resolution: 'resolved' | 'ignored' = 'resolved',
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabaseClient.rpc(
      'mark_import_log_resolved',
      {
        log_id: logId,
        resolution_status: resolution,
        notes: notes || null,
      },
    );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data?.success || true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    return { success: false, error: errorMessage };
  }
}

/**
 * Deleta um log de importação específico
 */
export async function deleteImportLog(logId: string): Promise<{
  success: boolean;
  deleted_count?: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabaseClient.rpc('delete_import_log', {
      log_id: logId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: data?.success || true,
      deleted_count: data?.deleted_count || 0,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    return { success: false, error: errorMessage };
  }
}

/**
 * Obtém estatísticas de erros não resolvidos
 */
export async function getUnresolvedErrorsStats(): Promise<{
  total_logs_with_errors: number;
  open_errors: number;
  resolved_errors: number;
  ignored_errors: number;
  logs_to_delete_90_days: number;
  oldest_log_age_days: number;
} | null> {
  try {
    const { data, error } = await supabaseClient.rpc(
      'get_unresolved_errors_stats',
    );

    if (error) {
      console.error('Erro ao buscar estatísticas de erros:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Erro em getUnresolvedErrorsStats:', error);
    return null;
  }
}
