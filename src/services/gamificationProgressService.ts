export type GamificationAreaId = 'properties' | 'talhoes' | 'analises';

export interface GamificationAreaBadgeTier {
  id: string;
  threshold: number;
  title: string;
  description: string;
}

export interface GamificationAreaTrack {
  id: GamificationAreaId;
  label: string;
  unit_label: string;
  tiers: GamificationAreaBadgeTier[];
}

export interface GamificationAreaProgress {
  area: GamificationAreaId;
  label: string;
  unit_label: string;
  current: number;
  unlocked_tiers: GamificationAreaBadgeTier[];
  current_tier: GamificationAreaBadgeTier | null;
  next_tier: GamificationAreaBadgeTier | null;
  progress_percent: number;
  remaining_to_next: number;
}

export interface GamificationLevelBenefit {
  level: number;
  title: string;
  benefit: string;
}

const AREA_TRACKS: GamificationAreaTrack[] = [
  {
    id: 'properties',
    label: 'Propriedades',
    unit_label: 'propriedade',
    tiers: [
      {
        id: 'properties_first',
        threshold: 1,
        title: 'Primeiro Territorio',
        description: 'Primeira propriedade cadastrada e estruturada.',
      },
      {
        id: 'properties_10',
        threshold: 10,
        title: 'Rei das Terras',
        description: 'Mais de 10 propriedades organizadas no sistema.',
      },
      {
        id: 'properties_25',
        threshold: 25,
        title: 'Comandante de Fazendas',
        description: 'Portifolio robusto com operação em larga escala.',
      },
    ],
  },
  {
    id: 'talhoes',
    label: 'Talhões',
    unit_label: 'talhao',
    tiers: [
      {
        id: 'talhoes_first',
        threshold: 1,
        title: 'Explorador de Talhões',
        description: 'Primeiro talhão mapeado no sistema.',
      },
      {
        id: 'talhoes_10',
        threshold: 10,
        title: 'Produtor Estrategico',
        description: 'Dez talhões com organizacao de campo ativa.',
      },
      {
        id: 'talhoes_50',
        threshold: 50,
        title: 'Empreendedor Rural',
        description: 'Cinquenta talhões com gestao consolidada.',
      },
    ],
  },
  {
    id: 'analises',
    label: 'Análises de Solo',
    unit_label: 'analise',
    tiers: [
      {
        id: 'analises_first',
        threshold: 1,
        title: 'Primeira Leitura',
        description: 'Primeira análise cadastrada no histórico tecnico.',
      },
      {
        id: 'analises_10',
        threshold: 10,
        title: 'Olhar de Agronomo',
        description: 'Dez análises registradas para decisao de manejo.',
      },
      {
        id: 'analises_50',
        threshold: 50,
        title: 'Guardiao da Fertilidade',
        description: 'Cinquenta análises acumuladas no banco tecnico.',
      },
    ],
  },
];

const LEVEL_BENEFITS: GamificationLevelBenefit[] = [
  {
    level: 1,
    title: 'Semente Ativa',
    benefit: 'Acesso completo a missoes diarias e progressao de XP.',
  },
  {
    level: 2,
    title: 'Ritmo de Campo',
    benefit: 'Painel de jornada com leitura de desempenho mais detalhada.',
  },
  {
    level: 3,
    title: 'Operação Consistente',
    benefit: 'Selo de nivel exibido ao lado dos créditos no cabecalho.',
  },
  {
    level: 5,
    title: 'Gestor em Evolucao',
    benefit: 'Marco de jornada com destaque no histórico pessoal.',
  },
  {
    level: 8,
    title: 'Estrategista Rural',
    benefit: 'Reconhecimento avancado na trilha de desempenho.',
  },
  {
    level: 10,
    title: 'Lenda do PerfilSolo',
    benefit: 'Insignia maxima da temporada de jornada.',
  },
];

function normalizeWhole(input: unknown): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

export function listGamificationAreaTracks(): GamificationAreaTrack[] {
  return AREA_TRACKS.map((track) => ({
    ...track,
    tiers: track.tiers.map((tier) => ({ ...tier })),
  }));
}

export function listGamificationLevelBenefits(): GamificationLevelBenefit[] {
  return LEVEL_BENEFITS.map((row) => ({ ...row }));
}

export function buildGamificationAreaProgress(input: {
  properties: number;
  talhoes: number;
  analises: number;
}): GamificationAreaProgress[] {
  const counts = {
    properties: normalizeWhole(input.properties),
    talhoes: normalizeWhole(input.talhoes),
    analises: normalizeWhole(input.analises),
  } as const;

  return AREA_TRACKS.map((track) => {
    const current = counts[track.id];
    const unlocked = track.tiers.filter((tier) => current >= tier.threshold);
    const currentTier = unlocked.length > 0 ? unlocked[unlocked.length - 1] : null;
    const nextTier = track.tiers.find((tier) => current < tier.threshold) ?? null;
    const previousThreshold = currentTier?.threshold ?? 0;
    const nextThreshold = nextTier?.threshold ?? previousThreshold;
    const span = Math.max(1, nextThreshold - previousThreshold);
    const progressValue = nextTier
      ? Math.max(0, Math.min(span, current - previousThreshold))
      : span;

    return {
      area: track.id,
      label: track.label,
      unit_label: track.unit_label,
      current,
      unlocked_tiers: unlocked.map((tier) => ({ ...tier })),
      current_tier: currentTier ? { ...currentTier } : null,
      next_tier: nextTier ? { ...nextTier } : null,
      progress_percent: Math.max(0, Math.min(100, Math.round((progressValue / span) * 100))),
      remaining_to_next: nextTier ? Math.max(0, nextTier.threshold - current) : 0,
    };
  });
}

export function resolveCurrentLevelBenefit(level: number): GamificationLevelBenefit {
  const normalized = Math.max(1, Math.round(level));
  const available = LEVEL_BENEFITS.filter((row) => row.level <= normalized);
  const selected = available.length > 0 ? available[available.length - 1] : LEVEL_BENEFITS[0];
  return { ...selected };
}
