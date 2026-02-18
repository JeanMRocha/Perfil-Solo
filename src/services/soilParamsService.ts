import { supabaseClient } from '../supabase/supabaseClient';
import { rangeToString } from './utils/rangeToString';
import { soilParamsMock } from '../data/soilParamsMock';
import type { SoilParams, RangeMap } from '../types/soil';
import { isLocalDataMode } from './dataProvider';

type Query = {
  cultura?: string;
  variedade?: string | null;
  estado?: string | null;
  cidade?: string | null;
  extrator?: string | null;
  estagio?: string | null;
  idade_meses?: number | null;
};

const norm = (v?: string | null) =>
  (v ?? '').toString().trim().toLowerCase() || null;

export function normalizeQuery(q: Query): Query {
  return {
    cultura: norm(q.cultura) ?? '',
    variedade: norm(q.variedade),
    estado: norm(q.estado),
    cidade: norm(q.cidade),
    extrator: norm(q.extrator),
    estagio: norm(q.estagio),
    idade_meses: q.idade_meses ?? null,
  };
}

export async function getSoilParams(query: Query): Promise<SoilParams> {
  const q = normalizeQuery(query);
  const ladders: Query[] = [
    q,
    { cultura: q.cultura, variedade: q.variedade, extrator: q.extrator },
    { cultura: q.cultura, extrator: q.extrator },
    { cultura: q.cultura },
  ];

  if (!isLocalDataMode) {
    try {
      for (const step of ladders) {
        const req = (supabaseClient as any)
          .from('soil_params')
          .select('*')
          .limit(1);

        if (step.cultura) req.eq('cultura', step.cultura);
        if (step.variedade != null) req.eq('variedade', step.variedade);
        if (step.estado != null) req.eq('estado', step.estado);
        if (step.cidade != null) req.eq('cidade', step.cidade);
        if (step.extrator != null) req.eq('extrator', step.extrator);
        if (step.estagio != null) req.eq('estagio', step.estagio);

        const { data, error } = await req;
        if (error) throw error;
        if (data && data.length) {
          const row: any = data[0];
          const ideal: RangeMap = row.ideal ?? {};
          return {
            id: row.id,
            cultura: row.cultura,
            variedade: row.variedade,
            estado: row.estado,
            cidade: row.cidade,
            extrator: row.extrator,
            estagio: row.estagio,
            idade_meses: row.idade_meses,
            ideal,
            ruleset_version: row.ruleset_version ?? 'v1',
            fonte: row.fonte,
            observacoes: row.observacoes,
            updated_at: row.updated_at,
          };
        }
      }
    } catch {
      // fallback local
    }
  }

  const match =
    soilParamsMock.find(
      (m) =>
        (m.cultura ?? '') === (q.cultura ?? '') &&
        (m.variedade ?? null) === (q.variedade ?? null) &&
        (m.estado ?? null) === (q.estado ?? null) &&
        (m.extrator ?? null) === (q.extrator ?? null),
    ) ||
    soilParamsMock.find((m) => (m.cultura ?? '') === (q.cultura ?? '')) ||
    soilParamsMock[0];

  return match;
}

export function summarizeRanges(ideal: RangeMap): string {
  const parts = Object.entries(ideal).map(
    ([k, r]) => `${k}:${rangeToString(r as any)}`,
  );
  return parts.join(' | ');
}
