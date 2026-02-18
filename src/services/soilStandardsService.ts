import { supabaseClient } from '../supabase/supabaseClient';
import { isLocalDataMode } from './dataProvider';

export type SoilParam =
  | 'pH'
  | 'P'
  | 'K'
  | 'Ca'
  | 'Mg'
  | 'MO'
  | 'S'
  | 'B'
  | 'Cu'
  | 'Fe'
  | 'Mn'
  | 'Zn';

export type IdealRange = { min: number; max: number; unidade?: string };

export type ContextoSolo = {
  cultura?: string;
  variedade?: string;
  extrator?: string;
  estado?: string;
  cidade?: string;
  altitude?: number;
  idadeMeses?: number;
};

type RegistroSupabase = {
  id: string;
  parametro: SoilParam;
  unidade: string | null;
  ideal_min: number;
  ideal_max: number;
  cultura: string | null;
  variedade: string | null;
  extrator: string | null;
  estado: string | null;
  cidade: string | null;
  idade_min: number | null;
  idade_max: number | null;
};

const DEFAULTS: Record<SoilParam, IdealRange> = {
  pH: { min: 5.5, max: 6.5, unidade: 'pH' },
  P: { min: 10, max: 30, unidade: 'mg/dm3' },
  K: { min: 0.2, max: 0.4, unidade: 'cmolc/dm3' },
  Ca: { min: 3, max: 6, unidade: 'cmolc/dm3' },
  Mg: { min: 1, max: 2, unidade: 'cmolc/dm3' },
  MO: { min: 3, max: 5, unidade: '%' },
  S: { min: 10, max: 20, unidade: 'mg/dm3' },
  B: { min: 0.2, max: 0.6, unidade: 'mg/dm3' },
  Cu: { min: 0.4, max: 1.2, unidade: 'mg/dm3' },
  Fe: { min: 4, max: 12, unidade: 'mg/dm3' },
  Mn: { min: 2, max: 10, unidade: 'mg/dm3' },
  Zn: { min: 1, max: 3, unidade: 'mg/dm3' },
};

const cache = new Map<string, IdealRange & { source: 'supabase' | 'mock' }>();

function key(param: SoilParam, ctx: ContextoSolo) {
  return JSON.stringify([param, ctx]);
}

export async function getIdealRange(
  parametro: SoilParam,
  ctx: ContextoSolo = {},
): Promise<IdealRange & { source: 'supabase' | 'mock' }> {
  const cacheKey = key(parametro, ctx);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  if (!isLocalDataMode) {
    try {
      let query = (supabaseClient as any)
        .from('solo_referencias')
        .select('*')
        .eq('parametro', parametro)
        .limit(1);

      if (ctx.cultura) query = query.eq('cultura', ctx.cultura);
      if (ctx.variedade) query = query.eq('variedade', ctx.variedade);
      if (ctx.extrator) query = query.eq('extrator', ctx.extrator);
      if (ctx.estado) query = query.eq('estado', ctx.estado);
      if (ctx.cidade) query = query.eq('cidade', ctx.cidade);

      if (typeof ctx.idadeMeses === 'number') {
        query = query
          .lte('idade_min', ctx.idadeMeses)
          .gte('idade_max', ctx.idadeMeses);
      }

      const { data } = await query;
      const rec = (data as RegistroSupabase[] | undefined)?.[0];
      if (rec) {
        const result = {
          min: rec.ideal_min,
          max: rec.ideal_max,
          unidade: rec.unidade ?? DEFAULTS[parametro].unidade,
          source: 'supabase' as const,
        };
        cache.set(cacheKey, result);
        return result;
      }
    } catch {
      // fallback
    }
  }

  const fallback = { ...DEFAULTS[parametro], source: 'mock' as const };
  cache.set(cacheKey, fallback);
  return fallback;
}

export async function getIdealRanges(
  params: SoilParam[],
  ctx: ContextoSolo = {},
): Promise<Record<SoilParam, IdealRange & { source: 'supabase' | 'mock' }>> {
  const out = {} as Record<
    SoilParam,
    IdealRange & { source: 'supabase' | 'mock' }
  >;
  await Promise.all(
    params.map(async (p) => {
      out[p] = await getIdealRange(p, ctx);
    }),
  );
  return out;
}
