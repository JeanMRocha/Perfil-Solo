-- Fase 2: Integracoes de billing, referencias de solo e governanca de uso
-- Data: 2026-02-17

-- 1) Billing: completar schema de profiles para Stripe
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdf_imports_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analysis_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'profiles_stripe_customer_id_idx'
  ) THEN
    CREATE INDEX profiles_stripe_customer_id_idx
      ON public.profiles (stripe_customer_id);
  END IF;
END$$;

-- 2) Referencias agronomicas: tabela de solo_params para fallback hierarquico
CREATE TABLE IF NOT EXISTS public.soil_params (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cultura TEXT NOT NULL,
  variedade TEXT,
  estado TEXT,
  cidade TEXT,
  extrator TEXT,
  estagio TEXT,
  idade_meses INTEGER,
  ideal JSONB NOT NULL DEFAULT '{}',
  ruleset_version TEXT NOT NULL DEFAULT 'v1',
  fonte TEXT,
  observacoes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Referencias por nutriente (faixas detalhadas)
CREATE TABLE IF NOT EXISTS public.nutriente_referencias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cultura TEXT NOT NULL,
  variedade TEXT,
  nutriente TEXT NOT NULL,
  extrator TEXT,
  faixa_ideal_min NUMERIC NOT NULL,
  faixa_ideal_max NUMERIC NOT NULL,
  unidade TEXT,
  ruleset_version TEXT NOT NULL DEFAULT 'v1',
  fonte TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4) Referencias para leitura por parametro (hook useIdealRange)
CREATE TABLE IF NOT EXISTS public.solo_referencias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parametro TEXT NOT NULL,
  unidade TEXT,
  ideal_min NUMERIC NOT NULL,
  ideal_max NUMERIC NOT NULL,
  cultura TEXT,
  variedade TEXT,
  extrator TEXT,
  estado TEXT,
  cidade TEXT,
  idade_min INTEGER,
  idade_max INTEGER,
  ruleset_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) Logs tecnicos da aplicacao
CREATE TABLE IF NOT EXISTS public.logs_sistema (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  origem TEXT,
  usuario_id UUID,
  detalhes JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 6) Governanca de uso por modulo
CREATE TABLE IF NOT EXISTS public.module_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  analysis_id UUID,
  module_name TEXT NOT NULL CHECK (module_name IN ('calagem', 'gessagem', 'adubacao')),
  runs_count INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7) RLS
ALTER TABLE public.soil_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutriente_referencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solo_referencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_usage ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'soil_params'
      AND policyname = 'Authenticated can read soil_params'
  ) THEN
    CREATE POLICY "Authenticated can read soil_params"
      ON public.soil_params
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nutriente_referencias'
      AND policyname = 'Authenticated can read nutrient refs'
  ) THEN
    CREATE POLICY "Authenticated can read nutrient refs"
      ON public.nutriente_referencias
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'solo_referencias'
      AND policyname = 'Authenticated can read solo refs'
  ) THEN
    CREATE POLICY "Authenticated can read solo refs"
      ON public.solo_referencias
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'logs_sistema'
      AND policyname = 'Users can insert own logs'
  ) THEN
    CREATE POLICY "Users can insert own logs"
      ON public.logs_sistema
      FOR INSERT
      WITH CHECK (auth.uid() = usuario_id OR usuario_id IS NULL);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'module_usage'
      AND policyname = 'Users can read own module usage'
  ) THEN
    CREATE POLICY "Users can read own module usage"
      ON public.module_usage
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'module_usage'
      AND policyname = 'Users can insert own module usage'
  ) THEN
    CREATE POLICY "Users can insert own module usage"
      ON public.module_usage
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;
