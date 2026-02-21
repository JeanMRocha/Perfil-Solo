-- Fase 6: Modulo canonico de contatos com vinculos por entidade
-- Data: 2026-02-20

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Fallback para ambientes sem a funcao global de updated_at.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 1) Tabela canonica de pontos de contato
CREATE TABLE IF NOT EXISTS public.contact_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('email', 'phone', 'website', 'social')),
  network TEXT,
  value TEXT NOT NULL,
  value_normalized TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'contact_points_user_id_idx'
  ) THEN
    CREATE INDEX contact_points_user_id_idx ON public.contact_points (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'contact_points_kind_idx'
  ) THEN
    CREATE INDEX contact_points_kind_idx ON public.contact_points (kind);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'contact_points_value_normalized_idx'
  ) THEN
    CREATE INDEX contact_points_value_normalized_idx
      ON public.contact_points (value_normalized);
  END IF;
END$$;

-- 2) Vinculos: profile <-> contact_point
CREATE TABLE IF NOT EXISTS public.profile_contact_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_point_id UUID NOT NULL REFERENCES public.contact_points(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, contact_point_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'profile_contact_points_user_id_idx'
  ) THEN
    CREATE INDEX profile_contact_points_user_id_idx
      ON public.profile_contact_points (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'profile_contact_points_profile_id_idx'
  ) THEN
    CREATE INDEX profile_contact_points_profile_id_idx
      ON public.profile_contact_points (profile_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'profile_contact_points_contact_point_id_idx'
  ) THEN
    CREATE INDEX profile_contact_points_contact_point_id_idx
      ON public.profile_contact_points (contact_point_id);
  END IF;
END$$;

-- 3) Vinculos: property <-> contact_point
CREATE TABLE IF NOT EXISTS public.property_contact_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  contact_point_id UUID NOT NULL REFERENCES public.contact_points(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, contact_point_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'property_contact_points_user_id_idx'
  ) THEN
    CREATE INDEX property_contact_points_user_id_idx
      ON public.property_contact_points (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'property_contact_points_property_id_idx'
  ) THEN
    CREATE INDEX property_contact_points_property_id_idx
      ON public.property_contact_points (property_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'property_contact_points_contact_point_id_idx'
  ) THEN
    CREATE INDEX property_contact_points_contact_point_id_idx
      ON public.property_contact_points (contact_point_id);
  END IF;
END$$;

-- 4) Vinculos: pessoa <-> contact_point
CREATE TABLE IF NOT EXISTS public.pessoa_contact_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  contact_point_id UUID NOT NULL REFERENCES public.contact_points(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pessoa_id, contact_point_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'pessoa_contact_points_user_id_idx'
  ) THEN
    CREATE INDEX pessoa_contact_points_user_id_idx
      ON public.pessoa_contact_points (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'pessoa_contact_points_pessoa_id_idx'
  ) THEN
    CREATE INDEX pessoa_contact_points_pessoa_id_idx
      ON public.pessoa_contact_points (pessoa_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'pessoa_contact_points_contact_point_id_idx'
  ) THEN
    CREATE INDEX pessoa_contact_points_contact_point_id_idx
      ON public.pessoa_contact_points (contact_point_id);
  END IF;
END$$;

-- 5) Vinculos: laboratorio <-> contact_point
CREATE TABLE IF NOT EXISTS public.laboratorio_contact_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  laboratorio_id UUID NOT NULL REFERENCES public.laboratorios(id) ON DELETE CASCADE,
  contact_point_id UUID NOT NULL REFERENCES public.contact_points(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (laboratorio_id, contact_point_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'laboratorio_contact_points_user_id_idx'
  ) THEN
    CREATE INDEX laboratorio_contact_points_user_id_idx
      ON public.laboratorio_contact_points (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'laboratorio_contact_points_laboratorio_id_idx'
  ) THEN
    CREATE INDEX laboratorio_contact_points_laboratorio_id_idx
      ON public.laboratorio_contact_points (laboratorio_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'laboratorio_contact_points_contact_point_id_idx'
  ) THEN
    CREATE INDEX laboratorio_contact_points_contact_point_id_idx
      ON public.laboratorio_contact_points (contact_point_id);
  END IF;
END$$;

-- 6) Normalizacao de valor para busca e comparacao
CREATE OR REPLACE FUNCTION public.normalize_contact_point_value()
RETURNS TRIGGER AS $$
BEGIN
  NEW.value = trim(coalesce(NEW.value, ''));
  NEW.label = nullif(trim(coalesce(NEW.label, '')), '');
  NEW.network = nullif(trim(coalesce(NEW.network, '')), '');

  IF NEW.kind = 'email' THEN
    NEW.value_normalized = lower(NEW.value);
  ELSIF NEW.kind = 'phone' THEN
    NEW.value_normalized = regexp_replace(NEW.value, '\D', '', 'g');
  ELSE
    NEW.value_normalized = lower(NEW.value);
  END IF;

  IF NEW.kind = 'social' AND NEW.network IS NULL THEN
    RAISE EXCEPTION 'Integridade invalida: contato social exige campo network.';
  END IF;

  IF NEW.kind <> 'social' THEN
    NEW.network = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS trg_contact_points_normalize ON public.contact_points;
CREATE TRIGGER trg_contact_points_normalize
BEFORE INSERT OR UPDATE ON public.contact_points
FOR EACH ROW EXECUTE FUNCTION public.normalize_contact_point_value();

-- 7) Integridade de user_id entre vinculo, entidade e ponto de contato
CREATE OR REPLACE FUNCTION public.validate_contact_link_user_integrity()
RETURNS TRIGGER AS $$
DECLARE
  linked_contact_user_id UUID;
  linked_entity_user_id UUID;
BEGIN
  SELECT user_id INTO linked_contact_user_id
  FROM public.contact_points
  WHERE id = NEW.contact_point_id;

  IF linked_contact_user_id IS NULL THEN
    RAISE EXCEPTION 'Integridade invalida: ponto de contato nao encontrado.';
  END IF;

  IF linked_contact_user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Integridade invalida: contato deve pertencer ao mesmo usuario do vinculo.';
  END IF;

  IF TG_TABLE_NAME = 'profile_contact_points' THEN
    SELECT id INTO linked_entity_user_id
    FROM public.profiles
    WHERE id = NEW.profile_id;
  ELSIF TG_TABLE_NAME = 'property_contact_points' THEN
    SELECT user_id INTO linked_entity_user_id
    FROM public.properties
    WHERE id = NEW.property_id;
  ELSIF TG_TABLE_NAME = 'pessoa_contact_points' THEN
    SELECT user_id INTO linked_entity_user_id
    FROM public.pessoas
    WHERE id = NEW.pessoa_id;
  ELSIF TG_TABLE_NAME = 'laboratorio_contact_points' THEN
    SELECT user_id INTO linked_entity_user_id
    FROM public.laboratorios
    WHERE id = NEW.laboratorio_id;
  ELSE
    RAISE EXCEPTION 'Integridade invalida: tabela de vinculo nao suportada (%).', TG_TABLE_NAME;
  END IF;

  IF linked_entity_user_id IS NULL THEN
    RAISE EXCEPTION 'Integridade invalida: entidade vinculada nao encontrada.';
  END IF;

  IF linked_entity_user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Integridade invalida: entidade deve pertencer ao mesmo usuario do vinculo.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS trg_profile_contact_points_integrity ON public.profile_contact_points;
CREATE TRIGGER trg_profile_contact_points_integrity
BEFORE INSERT OR UPDATE ON public.profile_contact_points
FOR EACH ROW EXECUTE FUNCTION public.validate_contact_link_user_integrity();

DROP TRIGGER IF EXISTS trg_property_contact_points_integrity ON public.property_contact_points;
CREATE TRIGGER trg_property_contact_points_integrity
BEFORE INSERT OR UPDATE ON public.property_contact_points
FOR EACH ROW EXECUTE FUNCTION public.validate_contact_link_user_integrity();

DROP TRIGGER IF EXISTS trg_pessoa_contact_points_integrity ON public.pessoa_contact_points;
CREATE TRIGGER trg_pessoa_contact_points_integrity
BEFORE INSERT OR UPDATE ON public.pessoa_contact_points
FOR EACH ROW EXECUTE FUNCTION public.validate_contact_link_user_integrity();

DROP TRIGGER IF EXISTS trg_laboratorio_contact_points_integrity ON public.laboratorio_contact_points;
CREATE TRIGGER trg_laboratorio_contact_points_integrity
BEFORE INSERT OR UPDATE ON public.laboratorio_contact_points
FOR EACH ROW EXECUTE FUNCTION public.validate_contact_link_user_integrity();

-- 8) Triggers updated_at
DROP TRIGGER IF EXISTS update_contact_points_updated_at ON public.contact_points;
CREATE TRIGGER update_contact_points_updated_at
BEFORE UPDATE ON public.contact_points
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profile_contact_points_updated_at ON public.profile_contact_points;
CREATE TRIGGER update_profile_contact_points_updated_at
BEFORE UPDATE ON public.profile_contact_points
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_property_contact_points_updated_at ON public.property_contact_points;
CREATE TRIGGER update_property_contact_points_updated_at
BEFORE UPDATE ON public.property_contact_points
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pessoa_contact_points_updated_at ON public.pessoa_contact_points;
CREATE TRIGGER update_pessoa_contact_points_updated_at
BEFORE UPDATE ON public.pessoa_contact_points
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_laboratorio_contact_points_updated_at ON public.laboratorio_contact_points;
CREATE TRIGGER update_laboratorio_contact_points_updated_at
BEFORE UPDATE ON public.laboratorio_contact_points
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9) RLS
ALTER TABLE public.contact_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_contact_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_contact_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pessoa_contact_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratorio_contact_points ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_points'
      AND policyname = 'Users can read own contact points'
  ) THEN
    CREATE POLICY "Users can read own contact points"
      ON public.contact_points
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_points'
      AND policyname = 'Users can insert own contact points'
  ) THEN
    CREATE POLICY "Users can insert own contact points"
      ON public.contact_points
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_points'
      AND policyname = 'Users can update own contact points'
  ) THEN
    CREATE POLICY "Users can update own contact points"
      ON public.contact_points
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_points'
      AND policyname = 'Users can delete own contact points'
  ) THEN
    CREATE POLICY "Users can delete own contact points"
      ON public.contact_points
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profile_contact_points',
    'property_contact_points',
    'pessoa_contact_points',
    'laboratorio_contact_points'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = format('Users can read own %s', replace(t, '_', ' '))
    ) THEN
      EXECUTE format(
        'CREATE POLICY "%s" ON public.%I FOR SELECT USING (auth.uid() = user_id)',
        format('Users can read own %s', replace(t, '_', ' ')),
        t
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = format('Users can insert own %s', replace(t, '_', ' '))
    ) THEN
      EXECUTE format(
        'CREATE POLICY "%s" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)',
        format('Users can insert own %s', replace(t, '_', ' ')),
        t
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = format('Users can update own %s', replace(t, '_', ' '))
    ) THEN
      EXECUTE format(
        'CREATE POLICY "%s" ON public.%I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
        format('Users can update own %s', replace(t, '_', ' ')),
        t
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = format('Users can delete own %s', replace(t, '_', ' '))
    ) THEN
      EXECUTE format(
        'CREATE POLICY "%s" ON public.%I FOR DELETE USING (auth.uid() = user_id)',
        format('Users can delete own %s', replace(t, '_', ' ')),
        t
      );
    END IF;
  END LOOP;
END$$;
