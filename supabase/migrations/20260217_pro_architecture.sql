-- Migração: Arquitetura Pro PerfilSolo
-- Data: 2026-02-17

-- 1. EXTENSÕES E SCHEMAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE PERFIS (USUÁRIOS)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'farmer' CHECK (role IN ('admin', 'consultant', 'farmer')),
  plan_id TEXT DEFAULT 'free' CHECK (plan_id IN ('free', 'pro', 'enterprise')),
  subscription_status TEXT DEFAULT 'inactive',
  credits_remaining INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELAS DE PROPRIEDADE E MAPA (GIS)
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cidade TEXT,
  estado TEXT,
  total_area DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.talhoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  area_ha DECIMAL,
  tipo_solo TEXT, -- Arenoso, Médio, Argiloso
  coordenadas_svg TEXT, -- Desenho manual
  cor_identificacao TEXT DEFAULT '#4CAF50',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. HIERARQUIA BOTÂNICA
CREATE TABLE IF NOT EXISTS public.plant_genus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.plant_species (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  genus_id UUID REFERENCES public.plant_genus(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  UNIQUE(genus_id, nome)
);

CREATE TABLE IF NOT EXISTS public.plant_cultivars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  species_id UUID REFERENCES public.plant_species(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  UNIQUE(species_id, nome)
);

CREATE TABLE IF NOT EXISTS public.cultivar_age_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cultivar_id UUID REFERENCES public.plant_cultivars(id) ON DELETE CASCADE,
  idade_min_meses INTEGER,
  idade_max_meses INTEGER,
  ideal JSONB NOT NULL, -- { "pH": [5.5, 6.5], "P": [10, 20] ... }
  ruleset_version TEXT NOT NULL,
  fonte TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CONTAINER DE ANÁLISE (O CORAÇÃO DO SISTEMA)
CREATE TABLE IF NOT EXISTS public.analises_solo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  talhao_id UUID REFERENCES public.talhoes(id) ON DELETE CASCADE,
  data_amostragem DATE NOT NULL,
  profundidade TEXT NOT NULL, -- '0-10', '0-20', etc.
  laboratorio TEXT,
  
  -- Armazenamento em JSONB para flexibilidade de container
  raw JSONB NOT NULL DEFAULT '{}',
  normalized JSONB NOT NULL DEFAULT '{}',
  executions JSONB NOT NULL DEFAULT '{}',
  alerts JSONB NOT NULL DEFAULT '[]',
  
  ruleset_frozen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. AUDITORIA
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talhoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analises_solo ENABLE ROW LEVEL SECURITY;

-- Exemplo de política: Usuário só vê seus próprios dados
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view own properties" ON public.properties FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own talhoes" ON public.talhoes FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.user_id = auth.uid()
));
CREATE POLICY "Users can view own analyses" ON public.analises_solo FOR SELECT USING (auth.uid() = user_id);

-- 8. TRIGGERS PARA UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_talhoes_updated_at BEFORE UPDATE ON public.talhoes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_analises_updated_at BEFORE UPDATE ON public.analises_solo FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
