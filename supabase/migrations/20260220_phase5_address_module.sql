-- Fase 5: Modulo canonico de enderecos com vinculos por entidade
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

-- 1) Tabela canonica de enderecos
CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT,
  cep TEXT,
  state TEXT,
  city TEXT,
  neighborhood TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  ibge_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'addresses_user_id_idx'
  ) THEN
    CREATE INDEX addresses_user_id_idx ON public.addresses (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'addresses_cep_idx'
  ) THEN
    CREATE INDEX addresses_cep_idx ON public.addresses (cep);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'addresses_city_state_idx'
  ) THEN
    CREATE INDEX addresses_city_state_idx ON public.addresses (state, city);
  END IF;
END$$;

-- 2) Vinculos: profile <-> endereco
CREATE TABLE IF NOT EXISTS public.profile_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES public.addresses(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, address_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'profile_addresses_user_id_idx'
  ) THEN
    CREATE INDEX profile_addresses_user_id_idx
      ON public.profile_addresses (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'profile_addresses_profile_id_idx'
  ) THEN
    CREATE INDEX profile_addresses_profile_id_idx
      ON public.profile_addresses (profile_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'profile_addresses_address_id_idx'
  ) THEN
    CREATE INDEX profile_addresses_address_id_idx
      ON public.profile_addresses (address_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'profile_primary_address_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX profile_primary_address_unique_idx
      ON public.profile_addresses (profile_id)
      WHERE is_primary;
  END IF;
END$$;

-- 3) Vinculos: property <-> endereco
CREATE TABLE IF NOT EXISTS public.property_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES public.addresses(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, address_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'property_addresses_user_id_idx'
  ) THEN
    CREATE INDEX property_addresses_user_id_idx
      ON public.property_addresses (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'property_addresses_property_id_idx'
  ) THEN
    CREATE INDEX property_addresses_property_id_idx
      ON public.property_addresses (property_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'property_addresses_address_id_idx'
  ) THEN
    CREATE INDEX property_addresses_address_id_idx
      ON public.property_addresses (address_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'property_primary_address_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX property_primary_address_unique_idx
      ON public.property_addresses (property_id)
      WHERE is_primary;
  END IF;
END$$;

-- 4) Vinculos: pessoa <-> endereco (clientes/fornecedores)
CREATE TABLE IF NOT EXISTS public.pessoa_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES public.addresses(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pessoa_id, address_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'pessoa_addresses_user_id_idx'
  ) THEN
    CREATE INDEX pessoa_addresses_user_id_idx
      ON public.pessoa_addresses (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'pessoa_addresses_pessoa_id_idx'
  ) THEN
    CREATE INDEX pessoa_addresses_pessoa_id_idx
      ON public.pessoa_addresses (pessoa_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'pessoa_addresses_address_id_idx'
  ) THEN
    CREATE INDEX pessoa_addresses_address_id_idx
      ON public.pessoa_addresses (address_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'pessoa_primary_address_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX pessoa_primary_address_unique_idx
      ON public.pessoa_addresses (pessoa_id)
      WHERE is_primary;
  END IF;
END$$;

-- 5) Vinculos: laboratorio <-> endereco
CREATE TABLE IF NOT EXISTS public.laboratorio_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  laboratorio_id UUID NOT NULL REFERENCES public.laboratorios(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES public.addresses(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (laboratorio_id, address_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'laboratorio_addresses_user_id_idx'
  ) THEN
    CREATE INDEX laboratorio_addresses_user_id_idx
      ON public.laboratorio_addresses (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'laboratorio_addresses_laboratorio_id_idx'
  ) THEN
    CREATE INDEX laboratorio_addresses_laboratorio_id_idx
      ON public.laboratorio_addresses (laboratorio_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'laboratorio_addresses_address_id_idx'
  ) THEN
    CREATE INDEX laboratorio_addresses_address_id_idx
      ON public.laboratorio_addresses (address_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'laboratorio_primary_address_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX laboratorio_primary_address_unique_idx
      ON public.laboratorio_addresses (laboratorio_id)
      WHERE is_primary;
  END IF;
END$$;

-- 6) Integridade: endereco e entidade precisam pertencer ao mesmo user_id
CREATE OR REPLACE FUNCTION public.validate_address_link_user_integrity()
RETURNS TRIGGER AS $$
DECLARE
  linked_address_user_id UUID;
  linked_entity_user_id UUID;
BEGIN
  SELECT user_id INTO linked_address_user_id
  FROM public.addresses
  WHERE id = NEW.address_id;

  IF linked_address_user_id IS NULL THEN
    RAISE EXCEPTION 'Integridade invalida: endereco nao encontrado.';
  END IF;

  IF linked_address_user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Integridade invalida: endereco deve pertencer ao mesmo usuario do vinculo.';
  END IF;

  IF TG_TABLE_NAME = 'profile_addresses' THEN
    SELECT id INTO linked_entity_user_id
    FROM public.profiles
    WHERE id = NEW.profile_id;
  ELSIF TG_TABLE_NAME = 'property_addresses' THEN
    SELECT user_id INTO linked_entity_user_id
    FROM public.properties
    WHERE id = NEW.property_id;
  ELSIF TG_TABLE_NAME = 'pessoa_addresses' THEN
    SELECT user_id INTO linked_entity_user_id
    FROM public.pessoas
    WHERE id = NEW.pessoa_id;
  ELSIF TG_TABLE_NAME = 'laboratorio_addresses' THEN
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

DROP TRIGGER IF EXISTS trg_profile_addresses_integrity ON public.profile_addresses;
CREATE TRIGGER trg_profile_addresses_integrity
BEFORE INSERT OR UPDATE ON public.profile_addresses
FOR EACH ROW EXECUTE FUNCTION public.validate_address_link_user_integrity();

DROP TRIGGER IF EXISTS trg_property_addresses_integrity ON public.property_addresses;
CREATE TRIGGER trg_property_addresses_integrity
BEFORE INSERT OR UPDATE ON public.property_addresses
FOR EACH ROW EXECUTE FUNCTION public.validate_address_link_user_integrity();

DROP TRIGGER IF EXISTS trg_pessoa_addresses_integrity ON public.pessoa_addresses;
CREATE TRIGGER trg_pessoa_addresses_integrity
BEFORE INSERT OR UPDATE ON public.pessoa_addresses
FOR EACH ROW EXECUTE FUNCTION public.validate_address_link_user_integrity();

DROP TRIGGER IF EXISTS trg_laboratorio_addresses_integrity ON public.laboratorio_addresses;
CREATE TRIGGER trg_laboratorio_addresses_integrity
BEFORE INSERT OR UPDATE ON public.laboratorio_addresses
FOR EACH ROW EXECUTE FUNCTION public.validate_address_link_user_integrity();

-- 7) Triggers updated_at
DROP TRIGGER IF EXISTS update_addresses_updated_at ON public.addresses;
CREATE TRIGGER update_addresses_updated_at
BEFORE UPDATE ON public.addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profile_addresses_updated_at ON public.profile_addresses;
CREATE TRIGGER update_profile_addresses_updated_at
BEFORE UPDATE ON public.profile_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_property_addresses_updated_at ON public.property_addresses;
CREATE TRIGGER update_property_addresses_updated_at
BEFORE UPDATE ON public.property_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pessoa_addresses_updated_at ON public.pessoa_addresses;
CREATE TRIGGER update_pessoa_addresses_updated_at
BEFORE UPDATE ON public.pessoa_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_laboratorio_addresses_updated_at ON public.laboratorio_addresses;
CREATE TRIGGER update_laboratorio_addresses_updated_at
BEFORE UPDATE ON public.laboratorio_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) RLS
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pessoa_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratorio_addresses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'addresses'
      AND policyname = 'Users can read own addresses'
  ) THEN
    CREATE POLICY "Users can read own addresses"
      ON public.addresses
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'addresses'
      AND policyname = 'Users can insert own addresses'
  ) THEN
    CREATE POLICY "Users can insert own addresses"
      ON public.addresses
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'addresses'
      AND policyname = 'Users can update own addresses'
  ) THEN
    CREATE POLICY "Users can update own addresses"
      ON public.addresses
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'addresses'
      AND policyname = 'Users can delete own addresses'
  ) THEN
    CREATE POLICY "Users can delete own addresses"
      ON public.addresses
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profile_addresses',
    'property_addresses',
    'pessoa_addresses',
    'laboratorio_addresses'
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
