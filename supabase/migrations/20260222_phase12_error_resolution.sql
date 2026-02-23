-- Fase 12: Sistema de resolução e limpeza de erros de importação
-- Adiciona campos para rastrear resolução de erros
-- Auto-delete de logs após 90 dias

-- Adicionar coluna de status de resolução aos logs
ALTER TABLE public.culture_import_logs
ADD COLUMN IF NOT EXISTS error_resolution_status TEXT DEFAULT 'open' CHECK (error_resolution_status IN ('open', 'resolved', 'ignored')),
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- Criar índice para logs por status de resolução
CREATE INDEX IF NOT EXISTS culture_import_logs_error_status_idx
  ON public.culture_import_logs (error_resolution_status);
CREATE INDEX IF NOT EXISTS culture_import_logs_resolved_at_idx
  ON public.culture_import_logs (resolved_at DESC);

-- RPC para marcar um log como resolvido
CREATE OR REPLACE FUNCTION public.mark_import_log_resolved(
  log_id UUID,
  resolution_status TEXT DEFAULT 'resolved',
  notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Verifica se usuário é super
  IF NOT EXISTS (
    SELECT 1 FROM public.users_registry
    WHERE id = auth.uid() AND super_user = TRUE
  ) THEN
    RAISE EXCEPTION 'Apenas super usuários podem resolver logs de erro';
  END IF;

  -- Atualiza o log
  UPDATE public.culture_import_logs
  SET 
    error_resolution_status = resolution_status,
    resolved_at = NOW(),
    resolved_by = auth.uid(),
    resolution_notes = notes
  WHERE id = log_id;

  -- Retorna resultado
  SELECT jsonb_build_object(
    'success', true,
    'message', 'Log atualizado com sucesso',
    'updated_at', NOW()
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para deletar um log específico
CREATE OR REPLACE FUNCTION public.delete_import_log(
  log_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_count INTEGER;
BEGIN
  -- Verifica se usuário é super
  IF NOT EXISTS (
    SELECT 1 FROM public.users_registry
    WHERE id = auth.uid() AND super_user = TRUE
  ) THEN
    RAISE EXCEPTION 'Apenas super usuários podem deletar logs de erro';
  END IF;

  -- Deleta o log
  DELETE FROM public.culture_import_logs WHERE id = log_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    SELECT jsonb_build_object(
      'success', false,
      'message', 'Log não encontrado',
      'deleted_count', 0
    ) INTO v_result;
  ELSE
    SELECT jsonb_build_object(
      'success', true,
      'message', 'Log deletado com sucesso',
      'deleted_count', v_count
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para limpar logs antigos (> 90 dias) automaticamente
CREATE OR REPLACE FUNCTION public.cleanup_expired_import_logs()
RETURNS JSONB AS $$
DECLARE
  v_count INTEGER;
  v_result JSONB;
BEGIN
  -- Deleta logs com mais de 90 dias
  DELETE FROM public.culture_import_logs
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT jsonb_build_object(
    'success', true,
    'deleted_count', v_count,
    'message', 'Limpeza de logs concluída',
    'executed_at', NOW()
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para obter estatísticas de erros não resolvidos
CREATE OR REPLACE FUNCTION public.get_unresolved_errors_stats()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Verifica se usuário é super
  IF NOT EXISTS (
    SELECT 1 FROM public.users_registry
    WHERE id = auth.uid() AND super_user = TRUE
  ) THEN
    RAISE EXCEPTION 'Apenas super usuários podem acessar estas estatísticas';
  END IF;

  SELECT jsonb_build_object(
    'total_logs_with_errors', COUNT(*) FILTER (WHERE error_count > 0),
    'open_errors', COUNT(*) FILTER (WHERE error_count > 0 AND error_resolution_status = 'open'),
    'resolved_errors', COUNT(*) FILTER (WHERE error_count > 0 AND error_resolution_status = 'resolved'),
    'ignored_errors', COUNT(*) FILTER (WHERE error_count > 0 AND error_resolution_status = 'ignored'),
    'logs_to_delete_90_days', COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days'),
    'oldest_log_age_days', CEIL(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) / 86400)
  ) INTO v_result
  FROM public.culture_import_logs;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para executar cleanup de logs antigos (a cada 100 inserts)
CREATE OR REPLACE FUNCTION public.trigger_cleanup_expired_logs()
RETURNS TRIGGER AS $$
BEGIN
  -- A cada 100 inserts em culture_import_logs, executa limpeza em background
  IF (SELECT COUNT(*) FROM public.culture_import_logs) % 100 = 0 THEN
    -- Aqui você pode disparar uma edge function ou job assíncrono
    -- Por enquanto, apenas logamos
    RAISE NOTICE 'Trigger: cleanup_expired_logs seria executado em background';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_expired_logs_on_insert ON public.culture_import_logs;
CREATE TRIGGER trigger_cleanup_expired_logs_on_insert
AFTER INSERT ON public.culture_import_logs
FOR EACH ROW
EXECUTE FUNCTION public.trigger_cleanup_expired_logs();
