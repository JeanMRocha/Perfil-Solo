-- Fase 3: RLS de escrita para propriedades e talhoes
-- Data: 2026-02-17

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'properties'
      AND policyname = 'Users can insert own properties'
  ) THEN
    CREATE POLICY "Users can insert own properties"
      ON public.properties
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'analises_solo'
      AND policyname = 'Users can insert own analyses'
  ) THEN
    CREATE POLICY "Users can insert own analyses"
      ON public.analises_solo
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'analises_solo'
      AND policyname = 'Users can update own analyses'
  ) THEN
    CREATE POLICY "Users can update own analyses"
      ON public.analises_solo
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'analises_solo'
      AND policyname = 'Users can delete own analyses'
  ) THEN
    CREATE POLICY "Users can delete own analyses"
      ON public.analises_solo
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'properties'
      AND policyname = 'Users can update own properties'
  ) THEN
    CREATE POLICY "Users can update own properties"
      ON public.properties
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'properties'
      AND policyname = 'Users can delete own properties'
  ) THEN
    CREATE POLICY "Users can delete own properties"
      ON public.properties
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'talhoes'
      AND policyname = 'Users can insert own talhoes'
  ) THEN
    CREATE POLICY "Users can insert own talhoes"
      ON public.talhoes
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.properties p
          WHERE p.id = property_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'talhoes'
      AND policyname = 'Users can update own talhoes'
  ) THEN
    CREATE POLICY "Users can update own talhoes"
      ON public.talhoes
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.properties p
          WHERE p.id = property_id
            AND p.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.properties p
          WHERE p.id = property_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'talhoes'
      AND policyname = 'Users can delete own talhoes'
  ) THEN
    CREATE POLICY "Users can delete own talhoes"
      ON public.talhoes
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.properties p
          WHERE p.id = property_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END$$;
