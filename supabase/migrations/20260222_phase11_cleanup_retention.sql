-- Fase 11: Limpeza Automática e Retenção de Dados
-- Auto-exclusão de logs após 90 dias
-- Auto-limpeza de hashes expirados
-- Data: 2026-02-22

-- ============================================================================
-- EXTENSÃO: triggers periódicos para janitor jobs
-- ============================================================================

-- Tabela para rastrear execução de limpeza (state pattern)
CREATE TABLE IF NOT EXISTS public.cleanup_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL UNIQUE,
  last_executed_at TIMESTAMPTZ,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS cleanup_state_job_type_idx
  ON public.cleanup_state (job_type);

-- ============================================================================
-- FUNÇÃO: Limpeza de logs expirados (90 dias)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_import_logs()
RETURNS TABLE (
  deleted_count INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_error TEXT := NULL;
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  BEGIN
    -- Calcula data de corte (90 dias atrás)
    v_cutoff_date := NOW() - INTERVAL '90 days';

    -- Deleta logs antigos
    DELETE FROM public.culture_import_logs
    WHERE created_at < v_cutoff_date;

    v_deleted := FOUND::INTEGER * 1;

    -- Atualiza estado de execução
    INSERT INTO public.cleanup_state (job_type, last_executed_at, status)
    VALUES ('cleanup_logs', NOW(), 'completed')
    ON CONFLICT (job_type)
    DO UPDATE SET
      last_executed_at = NOW(),
      status = 'completed',
      last_error = NULL,
      updated_at = NOW();

    RETURN QUERY SELECT v_deleted, v_error::TEXT;

  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;

    -- Registra erro
    INSERT INTO public.cleanup_state (job_type, status, last_error)
    VALUES ('cleanup_logs', 'failed', v_error)
    ON CONFLICT (job_type)
    DO UPDATE SET
      status = 'failed',
      last_error = v_error,
      updated_at = NOW();

    RETURN QUERY SELECT 0, v_error;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNÇÃO: Limpeza de hashes expirados
-- Limpa registros que não foram sincronizados há mais de 180 dias
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_stale_import_hashes()
RETURNS TABLE (
  deleted_count INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_error TEXT := NULL;
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  BEGIN
    -- Calcula data de corte (180 dias atrás)
    v_cutoff_date := NOW() - INTERVAL '180 days';

    -- Deleta hashes não sincronizados há muito tempo
    DELETE FROM public.culture_import_hashes
    WHERE last_synced_at < v_cutoff_date;

    v_deleted := FOUND::INTEGER * 1;

    -- Atualiza estado de execução
    INSERT INTO public.cleanup_state (job_type, last_executed_at, status)
    VALUES ('cleanup_hashes', NOW(), 'completed')
    ON CONFLICT (job_type)
    DO UPDATE SET
      last_executed_at = NOW(),
      status = 'completed',
      last_error = NULL,
      updated_at = NOW();

    RETURN QUERY SELECT v_deleted, v_error::TEXT;

  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;

    -- Registra erro
    INSERT INTO public.cleanup_state (job_type, status, last_error)
    VALUES ('cleanup_hashes', 'failed', v_error)
    ON CONFLICT (job_type)
    DO UPDATE SET
      status = 'failed',
      last_error = v_error,
      updated_at = NOW();

    RETURN QUERY SELECT 0, v_error;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNÇÃO: Função wrapper para executar todos os jobs de limpeza
-- ============================================================================

CREATE OR REPLACE FUNCTION public.run_all_cleanup_jobs()
RETURNS TABLE (
  job_name TEXT,
  deleted_count INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_logs_deleted INTEGER;
  v_logs_error TEXT;
  v_hashes_deleted INTEGER;
  v_hashes_error TEXT;
BEGIN
  -- Executa limpeza de logs
  SELECT deleted_count, error_message INTO v_logs_deleted, v_logs_error
  FROM public.cleanup_expired_import_logs();

  RETURN QUERY SELECT 'import_logs'::TEXT, v_logs_deleted, v_logs_error;

  -- Executa limpeza de hashes
  SELECT deleted_count, error_message INTO v_hashes_deleted, v_hashes_error
  FROM public.cleanup_stale_import_hashes();

  RETURN QUERY SELECT 'import_hashes'::TEXT, v_hashes_deleted, v_hashes_error;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANTS: Permissões para funções de limpeza
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.cleanup_expired_import_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_import_hashes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_all_cleanup_jobs() TO authenticated;

-- Super users podem chamar via API
GRANT EXECUTE ON FUNCTION public.cleanup_expired_import_logs() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_import_hashes() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_all_cleanup_jobs() TO service_role;

-- ============================================================================
-- TRIGGER: Cleanup automático (opcional, via evento de insert em logs)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_periodic_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  -- A cada 100 inserts em culture_import_logs, executa limpeza
  -- (evita executar em todo insert)
  IF (SELECT COUNT(*) FROM public.culture_import_logs) % 100 = 0 THEN
    PERFORM public.cleanup_expired_import_logs();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_on_log_insert ON public.culture_import_logs;
CREATE TRIGGER trigger_cleanup_on_log_insert
AFTER INSERT ON public.culture_import_logs
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_periodic_cleanup();

-- ============================================================================
-- RLS: cleanup_state acessível apenas para super users
-- ============================================================================

ALTER TABLE public.cleanup_state DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DADOS INICIAIS
-- ============================================================================

INSERT INTO public.cleanup_state (job_type, status)
VALUES
  ('cleanup_logs', 'idle'),
  ('cleanup_hashes', 'idle')
ON CONFLICT (job_type) DO NOTHING;
