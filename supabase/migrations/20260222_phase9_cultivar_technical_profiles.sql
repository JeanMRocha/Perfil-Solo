-- Fase 9: Base técnica por espécie/cultivar para preparo de adubação e calagem
-- Estratégia: espécie define valores gerais; cultivar custom pode sobrescrever.

CREATE TABLE IF NOT EXISTS public.crop_species_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  species_key TEXT NOT NULL,
  especie_nome_comum TEXT NOT NULL,
  especie_nome_cientifico TEXT,
  grupo_especie TEXT,
  source TEXT NOT NULL DEFAULT 'rnc',
  technical_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crop_species_profiles_source_check CHECK (
    source IN ('rnc', 'usuario')
  ),
  CONSTRAINT crop_species_profiles_user_species_unique UNIQUE (user_id, species_key)
);

CREATE TABLE IF NOT EXISTS public.crop_cultivar_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  species_profile_id UUID NOT NULL REFERENCES public.crop_species_profiles(id) ON DELETE CASCADE,
  cultivar_key TEXT NOT NULL,
  cultivar_nome TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'rnc',
  base_cultivar_key TEXT,
  rnc_detail_url TEXT,
  technical_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crop_cultivar_profiles_source_check CHECK (
    source IN ('rnc', 'clone_usuario', 'usuario')
  ),
  CONSTRAINT crop_cultivar_profiles_user_cultivar_unique UNIQUE (user_id, cultivar_key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'crop_species_profiles_user_idx'
  ) THEN
    CREATE INDEX crop_species_profiles_user_idx
      ON public.crop_species_profiles (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'crop_cultivar_profiles_user_idx'
  ) THEN
    CREATE INDEX crop_cultivar_profiles_user_idx
      ON public.crop_cultivar_profiles (user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'crop_cultivar_profiles_species_idx'
  ) THEN
    CREATE INDEX crop_cultivar_profiles_species_idx
      ON public.crop_cultivar_profiles (species_profile_id);
  END IF;
END$$;

DROP TRIGGER IF EXISTS update_crop_species_profiles_updated_at
  ON public.crop_species_profiles;
CREATE TRIGGER update_crop_species_profiles_updated_at
BEFORE UPDATE ON public.crop_species_profiles
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_crop_cultivar_profiles_updated_at
  ON public.crop_cultivar_profiles;
CREATE TRIGGER update_crop_cultivar_profiles_updated_at
BEFORE UPDATE ON public.crop_cultivar_profiles
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.crop_species_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_cultivar_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crop_species_profiles'
      AND policyname = 'Users can manage own species profiles'
  ) THEN
    CREATE POLICY "Users can manage own species profiles"
      ON public.crop_species_profiles
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crop_cultivar_profiles'
      AND policyname = 'Users can manage own cultivar profiles'
  ) THEN
    CREATE POLICY "Users can manage own cultivar profiles"
      ON public.crop_cultivar_profiles
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;
