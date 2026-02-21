-- Fase 7: Cutover sem backfill (somente para ambiente sem dados)
-- Data: 2026-02-20
--
-- ATENCAO:
-- Esta migration assume base sem dados relevantes e remove colunas legadas
-- de contato/endereco que foram substituidas pelos modulos canonicos.

-- 1) Harden de contact_points para evitar valores vazios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contact_points_value_not_blank'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.contact_points
      ADD CONSTRAINT contact_points_value_not_blank
      CHECK (length(trim(value)) > 0);
  END IF;
END$$;

-- 2) Remocao de campos legados em propriedades (contato passa a ser modular)
ALTER TABLE public.properties
  DROP COLUMN IF EXISTS contato,
  DROP COLUMN IF EXISTS contato_detalhes;

-- 3) Remocao de campos legados em pessoas
ALTER TABLE public.pessoas
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS telefone;

-- 4) Remocao de campos legados em laboratorios
ALTER TABLE public.laboratorios
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS telefone,
  DROP COLUMN IF EXISTS endereco;
