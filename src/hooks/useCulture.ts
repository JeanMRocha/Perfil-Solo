/**
 * Hook para gerenciar culturas importadas no contexto de um talhão ou análise
 * Fornece interfaces convenientes para resolver dados técnicos (espécie vs cultivar)
 */

import { useEffect, useState, useCallback } from 'react';
import { supabaseClient } from '../supabase/supabaseClient';
import { resolvePriority } from '../services/cultureImportService';

/**
 * Obtém o ID do usuário autenticado
 */
function getUserId(): string | null {
  try {
    const userJson =
      localStorage.getItem('sb-auth-user') || localStorage.getItem('sb-user');
    if (!userJson) return null;
    const user = JSON.parse(userJson);
    return user?.id || null;
  } catch {
    return null;
  }
}
import type {
  ImportedSpecies,
  ImportedCultivar,
} from '../services/cultureImportService';

export interface CultureProfile {
  species: ImportedSpecies | null;
  cultivar: ImportedCultivar | null;
  priority: 'cultivar' | 'especie' | 'none';
  technical_data: Record<string, any>;
}

/**
 * Hook para buscar e resolver dados técnicos de uma cultura
 * Prioridade: cultivar > espécie > nenhum
 */
export function useCultureProfile(input?: {
  especie_nome_comum?: string | null;
  especie_nome_cientifico?: string | null;
  cultivar_nome?: string | null;
}): {
  loading: boolean;
  profile: CultureProfile | null;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [profile, setProfile] = useState<CultureProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!input) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const userId = getUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }

      // Normaliza chaves de busca
      const speciesCommon = String(input.especie_nome_comum ?? '')
        .trim()
        .toLowerCase();
      const speciesScientific = String(input.especie_nome_cientifico ?? '')
        .trim()
        .toLowerCase();
      const cultivarName = String(input.cultivar_nome ?? '')
        .trim()
        .toLowerCase();

      // Busca espécie correspondente
      const { data: speciesData } = await supabaseClient
        .from('crop_species_profiles')
        .select('*')
        .eq('user_id', userId)
        .or(
          `especie_nome_comum.ilike.${speciesCommon},especie_nome_cientifico.ilike.${speciesScientific}`,
        )
        .single();

      // Busca cultivar se fornecido
      let cultivarData: ImportedCultivar | null = null;
      if (cultivarName && speciesData) {
        const { data: cvData } = await supabaseClient
          .from('crop_cultivar_profiles')
          .select('*')
          .eq('user_id', userId)
          .eq('species_profile_id', speciesData.id)
          .ilike('cultivar_nome', cultivarName)
          .single();

        cultivarData = cvData as ImportedCultivar;
      }

      const species = (speciesData as ImportedSpecies) || null;
      const resolved = resolvePriority(species, cultivarData);

      setProfile({
        species,
        cultivar: cultivarData,
        priority: resolved.priority,
        technical_data: resolved.technical_data,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao buscar cultura';
      setError(message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [input]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, profile, error, refresh };
}

/**
 * Hook para listar todas as espécies do usuário
 */
export function useUserSpecies(): {
  loading: boolean;
  species: ImportedSpecies[];
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [species, setSpecies] = useState<ImportedSpecies[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = getUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error: queryError } = await supabaseClient
        .from('crop_species_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('especie_nome_comum', { ascending: true });

      if (queryError) throw queryError;

      setSpecies((data as ImportedSpecies[]) || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao buscar espécies';
      setError(message);
      setSpecies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, species, error, refresh };
}

/**
 * Hook para listar todos os cultivares do usuário
 */
export function useUserCultivars(): {
  loading: boolean;
  cultivars: Array<ImportedCultivar & { species: ImportedSpecies }>;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [cultivars, setCultivars] = useState<
    Array<ImportedCultivar & { species: ImportedSpecies }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = getUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error: queryError } = await supabaseClient
        .from('crop_cultivar_profiles')
        .select(
          `
          *,
          species:crop_species_profiles(*)
        `,
        )
        .eq('user_id', userId)
        .order('cultivar_nome', { ascending: true });

      if (queryError) throw queryError;

      setCultivars(
        (data as Array<ImportedCultivar & { species: ImportedSpecies }>) || [],
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao buscar cultivares';
      setError(message);
      setCultivars([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, cultivars, error, refresh };
}

/**
 * Hook para resolver perfil técnico específico por ID
 */
export function useCultureById(
  id: string | null,
  type: 'species' | 'cultivar',
): {
  loading: boolean;
  profile: ImportedSpecies | ImportedCultivar | null;
  error: string | null;
} {
  const [profile, setProfile] = useState<
    ImportedSpecies | ImportedCultivar | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const table =
          type === 'species'
            ? 'crop_species_profiles'
            : 'crop_cultivar_profiles';
        const { data, error: queryError } = await supabaseClient
          .from(table)
          .select('*')
          .eq('id', id)
          .single();

        if (queryError) throw queryError;

        setProfile((data as ImportedSpecies | ImportedCultivar) || null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao buscar perfil';
        setError(message);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, type]);

  return { loading, profile, error };
}
