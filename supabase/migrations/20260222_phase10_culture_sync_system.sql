-- Fase 10: Sistema de sincronização automática de culturas RNC
-- Recorrência: semanal (cron)
-- Apenas super usuários gerenciam; usuários comuns consumem dados

-- Tabela de log de importação para auditoria e monitoramento
CREATE TABLE IF NOT EXISTS public.culture_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_batch_id TEXT NOT NULL,
  sync_type TEXT NOT NULL DEFAULT 'auto',
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_records INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS culture_import_logs_sync_batch_idx
  ON public.culture_import_logs (sync_batch_id);
CREATE INDEX IF NOT EXISTS culture_import_logs_started_at_idx
  ON public.culture_import_logs (started_at DESC);
CREATE INDEX IF NOT EXISTS culture_import_logs_status_idx
  ON public.culture_import_logs (status);

-- Tabela de histórico de sincronização para evitar re-sincronizar
CREATE TABLE IF NOT EXISTS public.culture_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_full_sync_at TIMESTAMPTZ,
  last_sync_batch_id TEXT,
  total_synced_records INTEGER DEFAULT 0,
  next_scheduled_sync TIMESTAMPTZ,
  sync_interval_hours INTEGER DEFAULT 168, -- 1 semana
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apenas 1 registro de estado global
ALTER TABLE public.culture_sync_state
ADD CONSTRAINT culture_sync_state_singleton CHECK (id = id);

-- Tabela de hash de registros para detectar mudanças
CREATE TABLE IF NOT EXISTS public.culture_import_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  species_profile_id UUID REFERENCES public.crop_species_profiles(id) ON DELETE CASCADE,
  cultivar_profile_id UUID REFERENCES public.crop_cultivar_profiles(id) ON DELETE CASCADE,
  rnc_uid TEXT NOT NULL,
  data_hash TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, rnc_uid)
);

CREATE INDEX IF NOT EXISTS culture_import_hashes_user_idx
  ON public.culture_import_hashes (user_id);
CREATE INDEX IF NOT EXISTS culture_import_hashes_rnc_uid_idx
  ON public.culture_import_hashes (rnc_uid);

-- RLS para culture_import_logs
ALTER TABLE public.culture_import_logs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'culture_import_logs'
      AND policyname = 'Only super users can view import logs'
  ) THEN
    CREATE POLICY "Only super users can view import logs"
      ON public.culture_import_logs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.users_registry
          WHERE id = auth.uid() AND super_user = TRUE
        )
      );
  END IF;
END$$;

-- Sem RLS para culture_sync_state (global)
ALTER TABLE public.culture_sync_state DISABLE ROW LEVEL SECURITY;

-- Sem RLS para culture_import_hashes (sistema, não usuário)
ALTER TABLE public.culture_import_hashes DISABLE ROW LEVEL SECURITY;

-- Trigger para manter atualizado o updated_at
CREATE OR REPLACE TRIGGER update_culture_sync_state_updated_at
BEFORE UPDATE ON public.culture_sync_state
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();
