-- Fase 4: Modelo de cadastros centrado em propriedade
-- Data: 2026-02-19

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Fallback para garantir trigger de updated_at, caso ainda nao exista no banco alvo.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 1) Pessoas (base para proprietarios, funcionarios, gestores e consultores)
CREATE TABLE IF NOT EXISTS public.pessoas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'individual' CHECK (tipo IN ('individual', 'company')),
  documento TEXT,
  email TEXT,
  telefone TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'pessoas_user_id_idx'
  ) THEN
    CREATE INDEX pessoas_user_id_idx ON public.pessoas (user_id);
  END IF;
END$$;

-- 2) Vinculo pessoa <-> propriedade (com papel e periodo)
CREATE TABLE IF NOT EXISTS public.property_people_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  vinculo TEXT NOT NULL CHECK (vinculo IN ('owner', 'employee', 'manager', 'consultant', 'tenant')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  inicio_vinculo DATE,
  fim_vinculo DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, pessoa_id, vinculo)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'property_people_links_user_id_idx'
  ) THEN
    CREATE INDEX property_people_links_user_id_idx
      ON public.property_people_links (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'property_people_links_property_id_idx'
  ) THEN
    CREATE INDEX property_people_links_property_id_idx
      ON public.property_people_links (property_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'property_people_links_pessoa_id_idx'
  ) THEN
    CREATE INDEX property_people_links_pessoa_id_idx
      ON public.property_people_links (pessoa_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'property_primary_owner_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX property_primary_owner_unique_idx
      ON public.property_people_links (property_id)
      WHERE vinculo = 'owner' AND is_primary;
  END IF;
END$$;

-- 3) Equipamentos da propriedade
CREATE TABLE IF NOT EXISTS public.property_equipamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT,
  marca TEXT,
  modelo TEXT,
  identificador TEXT,
  valor NUMERIC,
  data_aquisicao DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'property_equipamentos_user_id_idx'
  ) THEN
    CREATE INDEX property_equipamentos_user_id_idx
      ON public.property_equipamentos (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'property_equipamentos_property_id_idx'
  ) THEN
    CREATE INDEX property_equipamentos_property_id_idx
      ON public.property_equipamentos (property_id);
  END IF;
END$$;

-- 4) Laboratorios (independente de propriedade, vinculado ao usuario)
CREATE TABLE IF NOT EXISTS public.laboratorios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'laboratorios_user_id_idx'
  ) THEN
    CREATE INDEX laboratorios_user_id_idx ON public.laboratorios (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'laboratorios_user_nome_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX laboratorios_user_nome_unique_idx
      ON public.laboratorios (user_id, lower(nome));
  END IF;
END$$;

-- 5) Servicos de laboratorio
CREATE TABLE IF NOT EXISTS public.laboratorio_servicos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  laboratorio_id UUID NOT NULL REFERENCES public.laboratorios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  preco NUMERIC NOT NULL CHECK (preco >= 0),
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'laboratorio_servicos_laboratorio_id_idx'
  ) THEN
    CREATE INDEX laboratorio_servicos_laboratorio_id_idx
      ON public.laboratorio_servicos (laboratorio_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'laboratorio_servicos_user_id_idx'
  ) THEN
    CREATE INDEX laboratorio_servicos_user_id_idx
      ON public.laboratorio_servicos (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'laboratorio_servicos_unique_name_idx'
  ) THEN
    CREATE UNIQUE INDEX laboratorio_servicos_unique_name_idx
      ON public.laboratorio_servicos (laboratorio_id, lower(nome));
  END IF;
END$$;

-- 6) Cultura por periodo no talhao (catalogo de culturas continua independente)
CREATE TABLE IF NOT EXISTS public.talhao_culturas_periodos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  talhao_id UUID NOT NULL REFERENCES public.talhoes(id) ON DELETE CASCADE,
  cultura TEXT NOT NULL,
  cultivar TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (data_fim >= data_inicio)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'talhao_culturas_periodos_user_id_idx'
  ) THEN
    CREATE INDEX talhao_culturas_periodos_user_id_idx
      ON public.talhao_culturas_periodos (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'talhao_culturas_periodos_property_id_idx'
  ) THEN
    CREATE INDEX talhao_culturas_periodos_property_id_idx
      ON public.talhao_culturas_periodos (property_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'talhao_culturas_periodos_talhao_id_idx'
  ) THEN
    CREATE INDEX talhao_culturas_periodos_talhao_id_idx
      ON public.talhao_culturas_periodos (talhao_id);
  END IF;
END$$;

-- 7) Evolucao de analises_solo para vinculo formal com laboratorio
ALTER TABLE public.analises_solo
  ADD COLUMN IF NOT EXISTS laboratorio_id UUID REFERENCES public.laboratorios(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'analises_solo_laboratorio_id_idx'
  ) THEN
    CREATE INDEX analises_solo_laboratorio_id_idx
      ON public.analises_solo (laboratorio_id);
  END IF;
END$$;

-- 8) Integridade cruzada centrada em propriedade
CREATE OR REPLACE FUNCTION public.ensure_property_center_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_property_user UUID;
  v_talhao_property UUID;
  v_person_user UUID;
  v_lab_user UUID;
BEGIN
  IF TG_TABLE_NAME = 'analises_solo' THEN
    SELECT user_id INTO v_property_user
    FROM public.properties
    WHERE id = NEW.property_id;

    IF v_property_user IS NULL THEN
      RAISE EXCEPTION 'Integridade invalida: propriedade nao encontrada para a analise.';
    END IF;

    IF NEW.user_id IS DISTINCT FROM v_property_user THEN
      RAISE EXCEPTION 'Integridade invalida: user_id da analise difere do dono da propriedade.';
    END IF;

    SELECT property_id INTO v_talhao_property
    FROM public.talhoes
    WHERE id = NEW.talhao_id;

    IF v_talhao_property IS NULL THEN
      RAISE EXCEPTION 'Integridade invalida: talhao nao encontrado para a analise.';
    END IF;

    IF NEW.property_id IS DISTINCT FROM v_talhao_property THEN
      RAISE EXCEPTION 'Integridade invalida: talhao nao pertence a propriedade informada.';
    END IF;

    IF NEW.laboratorio_id IS NOT NULL THEN
      SELECT user_id INTO v_lab_user
      FROM public.laboratorios
      WHERE id = NEW.laboratorio_id;

      IF v_lab_user IS NULL THEN
        RAISE EXCEPTION 'Integridade invalida: laboratorio nao encontrado.';
      END IF;

      IF NEW.user_id IS DISTINCT FROM v_lab_user THEN
        RAISE EXCEPTION 'Integridade invalida: laboratorio pertence a outro usuario.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'property_people_links' THEN
    SELECT user_id INTO v_property_user
    FROM public.properties
    WHERE id = NEW.property_id;

    IF v_property_user IS NULL THEN
      RAISE EXCEPTION 'Integridade invalida: propriedade nao encontrada no vinculo de pessoas.';
    END IF;

    SELECT user_id INTO v_person_user
    FROM public.pessoas
    WHERE id = NEW.pessoa_id;

    IF v_person_user IS NULL THEN
      RAISE EXCEPTION 'Integridade invalida: pessoa nao encontrada no vinculo de pessoas.';
    END IF;

    IF NEW.user_id IS DISTINCT FROM v_property_user OR NEW.user_id IS DISTINCT FROM v_person_user THEN
      RAISE EXCEPTION 'Integridade invalida: propriedade, pessoa e vinculo devem pertencer ao mesmo usuario.';
    END IF;

    IF NEW.fim_vinculo IS NOT NULL
       AND NEW.inicio_vinculo IS NOT NULL
       AND NEW.fim_vinculo < NEW.inicio_vinculo THEN
      RAISE EXCEPTION 'Integridade invalida: fim_vinculo anterior ao inicio_vinculo.';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'property_equipamentos' THEN
    SELECT user_id INTO v_property_user
    FROM public.properties
    WHERE id = NEW.property_id;

    IF v_property_user IS NULL THEN
      RAISE EXCEPTION 'Integridade invalida: propriedade nao encontrada para equipamento.';
    END IF;

    IF NEW.user_id IS DISTINCT FROM v_property_user THEN
      RAISE EXCEPTION 'Integridade invalida: equipamento deve pertencer ao mesmo usuario da propriedade.';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'laboratorio_servicos' THEN
    SELECT user_id INTO v_lab_user
    FROM public.laboratorios
    WHERE id = NEW.laboratorio_id;

    IF v_lab_user IS NULL THEN
      RAISE EXCEPTION 'Integridade invalida: laboratorio nao encontrado para servico.';
    END IF;

    IF NEW.user_id IS DISTINCT FROM v_lab_user THEN
      RAISE EXCEPTION 'Integridade invalida: servico deve pertencer ao mesmo usuario do laboratorio.';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'talhao_culturas_periodos' THEN
    SELECT user_id INTO v_property_user
    FROM public.properties
    WHERE id = NEW.property_id;

    IF v_property_user IS NULL THEN
      RAISE EXCEPTION 'Integridade invalida: propriedade nao encontrada para cultura em periodo.';
    END IF;

    SELECT property_id INTO v_talhao_property
    FROM public.talhoes
    WHERE id = NEW.talhao_id;

    IF v_talhao_property IS NULL THEN
      RAISE EXCEPTION 'Integridade invalida: talhao nao encontrado para cultura em periodo.';
    END IF;

    IF NEW.property_id IS DISTINCT FROM v_talhao_property THEN
      RAISE EXCEPTION 'Integridade invalida: talhao informado nao pertence a propriedade.';
    END IF;

    IF NEW.user_id IS DISTINCT FROM v_property_user THEN
      RAISE EXCEPTION 'Integridade invalida: cultura por periodo deve pertencer ao mesmo usuario da propriedade.';
    END IF;

    IF NEW.data_fim < NEW.data_inicio THEN
      RAISE EXCEPTION 'Integridade invalida: data_fim anterior a data_inicio.';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS trg_analises_solo_integrity ON public.analises_solo;
CREATE TRIGGER trg_analises_solo_integrity
BEFORE INSERT OR UPDATE ON public.analises_solo
FOR EACH ROW
EXECUTE FUNCTION public.ensure_property_center_integrity();

DROP TRIGGER IF EXISTS trg_property_people_links_integrity ON public.property_people_links;
CREATE TRIGGER trg_property_people_links_integrity
BEFORE INSERT OR UPDATE ON public.property_people_links
FOR EACH ROW
EXECUTE FUNCTION public.ensure_property_center_integrity();

DROP TRIGGER IF EXISTS trg_property_equipamentos_integrity ON public.property_equipamentos;
CREATE TRIGGER trg_property_equipamentos_integrity
BEFORE INSERT OR UPDATE ON public.property_equipamentos
FOR EACH ROW
EXECUTE FUNCTION public.ensure_property_center_integrity();

DROP TRIGGER IF EXISTS trg_laboratorio_servicos_integrity ON public.laboratorio_servicos;
CREATE TRIGGER trg_laboratorio_servicos_integrity
BEFORE INSERT OR UPDATE ON public.laboratorio_servicos
FOR EACH ROW
EXECUTE FUNCTION public.ensure_property_center_integrity();

DROP TRIGGER IF EXISTS trg_talhao_culturas_periodos_integrity ON public.talhao_culturas_periodos;
CREATE TRIGGER trg_talhao_culturas_periodos_integrity
BEFORE INSERT OR UPDATE ON public.talhao_culturas_periodos
FOR EACH ROW
EXECUTE FUNCTION public.ensure_property_center_integrity();

-- 9) Updated_at triggers para novas tabelas
DROP TRIGGER IF EXISTS update_pessoas_updated_at ON public.pessoas;
CREATE TRIGGER update_pessoas_updated_at
BEFORE UPDATE ON public.pessoas
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_property_people_links_updated_at ON public.property_people_links;
CREATE TRIGGER update_property_people_links_updated_at
BEFORE UPDATE ON public.property_people_links
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_property_equipamentos_updated_at ON public.property_equipamentos;
CREATE TRIGGER update_property_equipamentos_updated_at
BEFORE UPDATE ON public.property_equipamentos
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_laboratorios_updated_at ON public.laboratorios;
CREATE TRIGGER update_laboratorios_updated_at
BEFORE UPDATE ON public.laboratorios
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_laboratorio_servicos_updated_at ON public.laboratorio_servicos;
CREATE TRIGGER update_laboratorio_servicos_updated_at
BEFORE UPDATE ON public.laboratorio_servicos
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_talhao_culturas_periodos_updated_at ON public.talhao_culturas_periodos;
CREATE TRIGGER update_talhao_culturas_periodos_updated_at
BEFORE UPDATE ON public.talhao_culturas_periodos
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- 10) RLS
ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_people_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratorio_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talhao_culturas_periodos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pessoas'
      AND policyname = 'Users can read own pessoas'
  ) THEN
    CREATE POLICY "Users can read own pessoas"
      ON public.pessoas
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pessoas'
      AND policyname = 'Users can insert own pessoas'
  ) THEN
    CREATE POLICY "Users can insert own pessoas"
      ON public.pessoas
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pessoas'
      AND policyname = 'Users can update own pessoas'
  ) THEN
    CREATE POLICY "Users can update own pessoas"
      ON public.pessoas
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pessoas'
      AND policyname = 'Users can delete own pessoas'
  ) THEN
    CREATE POLICY "Users can delete own pessoas"
      ON public.pessoas
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'property_people_links'
      AND policyname = 'Users can read own property people links'
  ) THEN
    CREATE POLICY "Users can read own property people links"
      ON public.property_people_links
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'property_people_links'
      AND policyname = 'Users can insert own property people links'
  ) THEN
    CREATE POLICY "Users can insert own property people links"
      ON public.property_people_links
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'property_people_links'
      AND policyname = 'Users can update own property people links'
  ) THEN
    CREATE POLICY "Users can update own property people links"
      ON public.property_people_links
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'property_people_links'
      AND policyname = 'Users can delete own property people links'
  ) THEN
    CREATE POLICY "Users can delete own property people links"
      ON public.property_people_links
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'property_equipamentos'
      AND policyname = 'Users can read own property equipamentos'
  ) THEN
    CREATE POLICY "Users can read own property equipamentos"
      ON public.property_equipamentos
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'property_equipamentos'
      AND policyname = 'Users can insert own property equipamentos'
  ) THEN
    CREATE POLICY "Users can insert own property equipamentos"
      ON public.property_equipamentos
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'property_equipamentos'
      AND policyname = 'Users can update own property equipamentos'
  ) THEN
    CREATE POLICY "Users can update own property equipamentos"
      ON public.property_equipamentos
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'property_equipamentos'
      AND policyname = 'Users can delete own property equipamentos'
  ) THEN
    CREATE POLICY "Users can delete own property equipamentos"
      ON public.property_equipamentos
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laboratorios'
      AND policyname = 'Users can read own laboratorios'
  ) THEN
    CREATE POLICY "Users can read own laboratorios"
      ON public.laboratorios
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laboratorios'
      AND policyname = 'Users can insert own laboratorios'
  ) THEN
    CREATE POLICY "Users can insert own laboratorios"
      ON public.laboratorios
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laboratorios'
      AND policyname = 'Users can update own laboratorios'
  ) THEN
    CREATE POLICY "Users can update own laboratorios"
      ON public.laboratorios
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laboratorios'
      AND policyname = 'Users can delete own laboratorios'
  ) THEN
    CREATE POLICY "Users can delete own laboratorios"
      ON public.laboratorios
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laboratorio_servicos'
      AND policyname = 'Users can read own laboratorio servicos'
  ) THEN
    CREATE POLICY "Users can read own laboratorio servicos"
      ON public.laboratorio_servicos
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laboratorio_servicos'
      AND policyname = 'Users can insert own laboratorio servicos'
  ) THEN
    CREATE POLICY "Users can insert own laboratorio servicos"
      ON public.laboratorio_servicos
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laboratorio_servicos'
      AND policyname = 'Users can update own laboratorio servicos'
  ) THEN
    CREATE POLICY "Users can update own laboratorio servicos"
      ON public.laboratorio_servicos
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laboratorio_servicos'
      AND policyname = 'Users can delete own laboratorio servicos'
  ) THEN
    CREATE POLICY "Users can delete own laboratorio servicos"
      ON public.laboratorio_servicos
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'talhao_culturas_periodos'
      AND policyname = 'Users can read own talhao culturas periodos'
  ) THEN
    CREATE POLICY "Users can read own talhao culturas periodos"
      ON public.talhao_culturas_periodos
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'talhao_culturas_periodos'
      AND policyname = 'Users can insert own talhao culturas periodos'
  ) THEN
    CREATE POLICY "Users can insert own talhao culturas periodos"
      ON public.talhao_culturas_periodos
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'talhao_culturas_periodos'
      AND policyname = 'Users can update own talhao culturas periodos'
  ) THEN
    CREATE POLICY "Users can update own talhao culturas periodos"
      ON public.talhao_culturas_periodos
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'talhao_culturas_periodos'
      AND policyname = 'Users can delete own talhao culturas periodos'
  ) THEN
    CREATE POLICY "Users can delete own talhao culturas periodos"
      ON public.talhao_culturas_periodos
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;
