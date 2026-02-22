export type SoilHydricSaturation = 'nunca' | 'as_vezes' | 'permanente';

export interface SoilLabLayerInput {
  de: number;
  ate: number;
  argila?: number | null;
  areia?: number | null;
  silte?: number | null;
  ph?: number | null;
  ca?: number | null;
  mg?: number | null;
  k?: number | null;
  al?: number | null;
  hal?: number | null;
  p?: number | null;
  mo?: number | null;
  na?: number | null;
  ce?: number | null;
  argila_unidade?: 'percent' | 'g_kg';
  areia_unidade?: 'percent' | 'g_kg';
  silte_unidade?: 'percent' | 'g_kg';
}

export interface SoilFieldInput {
  profundidade_rocha_cm?: number | null;
  saturacao: SoilHydricSaturation;
  cor_glei: boolean;
  mosqueado: boolean;
  plintita: boolean;
  fendas_seca: boolean;
  slickensides: boolean;
  horizonte_E: boolean;
  b_planco_adensado: boolean;
  espessura_organica_cm: number;
  tem_bt: boolean;
  tem_bw: boolean;
  tem_bi: boolean;
  tem_bn: boolean;
  tem_A_chernozemico: boolean;
  estratificacao_fluvial: boolean;
  mudanca_textural_abrupta?: boolean | null;
}

export interface SoilClassificationInput {
  camadas: SoilLabLayerInput[];
  campo: SoilFieldInput;
}

export interface SoilLayerChemistryIndicators {
  sb: number | null;
  t: number | null;
  v_percentual: number | null;
  m_percentual: number | null;
}

export interface SoilClassificationAlternative {
  ordem: string;
  subordem: string | null;
  confianca: number;
  justificativa: string;
}

export interface SoilClassificationDiagnostics {
  mudanca_textural_abrupta: boolean | null;
  argila_media_percent: number | null;
  argila_max_percent: number | null;
  argila_superficial_percent: number | null;
  argila_subsuperficial_percent: number | null;
  v_bt_percentual: number | null;
  m_bt_percentual: number | null;
  ctc_bt_cmolc_dm3: number | null;
  ph_superficie: number | null;
  ph_bt: number | null;
}

export interface SoilClassificationResult {
  ordem_provavel: string | null;
  subordem_provavel: string | null;
  alternativas: SoilClassificationAlternative[];
  confianca: number;
  criterios_usados: string[];
  dados_faltantes_para_confirmar: string[];
  observacoes_agronomicas: string[];
  diagnosticos: SoilClassificationDiagnostics;
}

interface ComputedLayer {
  input: SoilLabLayerInput;
  argila_percent: number | null;
  areia_percent: number | null;
  ph: number | null;
  ca: number | null;
  mg: number | null;
  k: number | null;
  na: number | null;
  al: number | null;
  hal: number | null;
  mo: number | null;
  ce: number | null;
  chemistry: SoilLayerChemistryIndicators;
}

interface RuleCandidate {
  ordem: string;
  subordem: string | null;
  score: number;
  criterios: string[];
  faltantes: string[];
  observacoes: string[];
}

function toFinite(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function toPercent(value: unknown, unit?: 'percent' | 'g_kg'): number | null {
  const parsed = toFinite(value);
  if (parsed == null) return null;
  if (unit === 'g_kg') return parsed / 10;
  if (unit === 'percent') return parsed;
  return parsed > 100 ? parsed / 10 : parsed;
}

function round2(value: number | null): number | null {
  if (value == null) return null;
  return Math.round(value * 100) / 100;
}

export function calculateLayerChemistryIndicators(
  layer: Pick<SoilLabLayerInput, 'ca' | 'mg' | 'k' | 'na' | 'al' | 'hal'>,
): SoilLayerChemistryIndicators {
  const ca = toFinite(layer.ca);
  const mg = toFinite(layer.mg);
  const k = toFinite(layer.k);
  const na = toFinite(layer.na) ?? 0;
  const al = toFinite(layer.al);
  const hal = toFinite(layer.hal);
  if (ca == null || mg == null || k == null || hal == null) {
    return { sb: null, t: null, v_percentual: null, m_percentual: null };
  }

  const sb = ca + mg + k + na;
  const t = sb + hal;
  const v = t > 0 ? (100 * sb) / t : null;
  const m = al != null && sb + al > 0 ? (100 * al) / (sb + al) : null;
  return {
    sb: round2(sb),
    t: round2(t),
    v_percentual: round2(v),
    m_percentual: round2(m),
  };
}

function buildComputedLayers(layers: SoilLabLayerInput[]): ComputedLayer[] {
  return [...layers]
    .sort((a, b) => toFinite(a.de) ?? 0 - (toFinite(b.de) ?? 0))
    .map((layer) => ({
      input: layer,
      argila_percent: toPercent(layer.argila, layer.argila_unidade),
      areia_percent: toPercent(layer.areia, layer.areia_unidade),
      ph: toFinite(layer.ph),
      ca: toFinite(layer.ca),
      mg: toFinite(layer.mg),
      k: toFinite(layer.k),
      na: toFinite(layer.na),
      al: toFinite(layer.al),
      hal: toFinite(layer.hal),
      mo: toFinite(layer.mo),
      ce: toFinite(layer.ce),
      chemistry: calculateLayerChemistryIndicators(layer),
    }));
}

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value != null);
  if (!valid.length) return null;
  const total = valid.reduce((sum, value) => sum + value, 0);
  return round2(total / valid.length);
}

function resolveBtCandidateLayer(layers: ComputedLayer[]): ComputedLayer | null {
  if (!layers.length) return null;
  if (layers.length === 1) return layers[0];
  const subsurface = layers.slice(1);
  const ranked = [...subsurface].sort((a, b) => {
    const clayA = a.argila_percent ?? -1;
    const clayB = b.argila_percent ?? -1;
    return clayB - clayA;
  });
  return ranked[0] ?? layers[1];
}

function detectAbruptTexturalChangeFromLayers(layers: ComputedLayer[]): boolean | null {
  if (layers.length < 2) return null;
  const clayA = layers[0].argila_percent;
  const clayB = layers[1].argila_percent;
  if (clayA == null || clayB == null) return null;
  if (clayA <= 0) return clayB >= 20;
  if (clayA < 20) return clayB >= 2 * clayA;
  return clayB - clayA >= 20;
}

export function detectAbruptTexturalChange(input: SoilClassificationInput): boolean | null {
  return detectAbruptTexturalChangeFromLayers(buildComputedLayers(input.camadas));
}

function majorityClayAtLeast(layers: ComputedLayer[], threshold: number): boolean | null {
  const validClay = layers
    .map((layer) => layer.argila_percent)
    .filter((value): value is number => value != null);
  if (!validClay.length) return null;
  const positive = validClay.filter((value) => value >= threshold).length;
  return positive >= Math.ceil(validClay.length / 2);
}

function mergeCandidateList(candidates: RuleCandidate[]): RuleCandidate[] {
  const byKey = new Map<string, RuleCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.ordem}::${candidate.subordem ?? ''}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, {
        ...candidate,
        criterios: [...candidate.criterios],
        faltantes: [...candidate.faltantes],
        observacoes: [...candidate.observacoes],
      });
      continue;
    }
    current.score = Math.max(current.score, candidate.score);
    current.criterios = uniqueStrings([...current.criterios, ...candidate.criterios]);
    current.faltantes = uniqueStrings([...current.faltantes, ...candidate.faltantes]);
    current.observacoes = uniqueStrings([...current.observacoes, ...candidate.observacoes]);
  }
  return [...byKey.values()];
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    output.push(clean);
  }
  return output;
}

function buildSuborderForNeossolos(input: SoilClassificationInput, diagnostics: SoilClassificationDiagnostics): string | null {
  const depthRock = toFinite(input.campo.profundidade_rocha_cm);
  if (depthRock != null && depthRock <= 50) return 'Neossolos Litolicos';
  if (input.campo.estratificacao_fluvial) return 'Neossolos Fluvicos';
  if (
    diagnostics.argila_media_percent != null &&
    diagnostics.argila_media_percent <= 15 &&
    diagnostics.argila_max_percent != null &&
    diagnostics.argila_max_percent <= 20
  ) {
    return 'Neossolos Quartzarenicos';
  }
  if (depthRock != null && depthRock > 50) return 'Neossolos Regoliticos';
  return null;
}

function buildAgronomicNotes(order: string | null, diagnostics: SoilClassificationDiagnostics): string[] {
  const notes: string[] = [];
  if (order === 'Vertissolos') {
    notes.push('Janela de operação estreita: evitar preparo fora do ponto de umidade.');
  }
  if (order === 'Planossolos') {
    notes.push('Priorizar manejo de drenagem superficial e trafego controlado.');
  }
  if (order === 'Gleissolos' || order === 'Organossolos') {
    notes.push('Risco de anoxia radicular: usar culturas tolerantes a saturacao.');
  }
  if (diagnostics.v_bt_percentual != null && diagnostics.v_bt_percentual < 50) {
    notes.push('V% no subsolo abaixo de 50 indica maior necessidade de correcao de acidez.');
  }
  if (diagnostics.m_bt_percentual != null && diagnostics.m_bt_percentual > 20) {
    notes.push('m% elevado sugere risco de toxidez por Al para raizes sensiveis.');
  }
  return uniqueStrings(notes);
}

function sortCandidates(candidates: RuleCandidate[]): RuleCandidate[] {
  const priority: Record<string, number> = {
    Organossolos: 1,
    Gleissolos: 2,
    Plintossolos: 3,
    Vertissolos: 4,
    Planossolos: 5,
    Espodossolos: 6,
    Neossolos: 7,
    Cambissolos: 8,
    Luvissolos: 9,
    Argissolos: 10,
    Nitossolos: 11,
    Latossolos: 12,
    Chernossolos: 13,
  };
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (priority[a.ordem] ?? 99) - (priority[b.ordem] ?? 99);
  });
}

export function classifySoilProfile(input: SoilClassificationInput): SoilClassificationResult {
  const layers = buildComputedLayers(input.camadas ?? []);
  const surfaceLayer = layers[0] ?? null;
  const subsurfaceLayer = layers[1] ?? null;
  const btLayer = resolveBtCandidateLayer(layers);

  const mudancaTexturalAbrupta =
    input.campo.mudanca_textural_abrupta ?? detectAbruptTexturalChangeFromLayers(layers);

  const diagnostics: SoilClassificationDiagnostics = {
    mudanca_textural_abrupta: mudancaTexturalAbrupta,
    argila_media_percent: average(layers.map((layer) => layer.argila_percent)),
    argila_max_percent: layers.reduce<number | null>((max, layer) => {
      if (layer.argila_percent == null) return max;
      if (max == null || layer.argila_percent > max) return layer.argila_percent;
      return max;
    }, null),
    argila_superficial_percent: surfaceLayer?.argila_percent ?? null,
    argila_subsuperficial_percent: subsurfaceLayer?.argila_percent ?? null,
    v_bt_percentual: btLayer?.chemistry.v_percentual ?? null,
    m_bt_percentual: btLayer?.chemistry.m_percentual ?? null,
    ctc_bt_cmolc_dm3: btLayer?.chemistry.t ?? null,
    ph_superficie: surfaceLayer?.ph ?? null,
    ph_bt: btLayer?.ph ?? null,
  };

  const sandyProfile =
    (average(layers.map((layer) => layer.areia_percent)) ?? 0) >= 70 &&
    (diagnostics.argila_media_percent ?? 100) <= 15;
  const stronglyAcid = (diagnostics.ph_superficie ?? diagnostics.ph_bt ?? 99) <= 5.3;
  const highClayMajority = majorityClayAtLeast(layers, 30);
  const hasAnyBDiagnostic =
    input.campo.tem_bt || input.campo.tem_bw || input.campo.tem_bi || input.campo.tem_bn;

  const candidates: RuleCandidate[] = [];

  if (
    input.campo.espessura_organica_cm >= 40 ||
    (input.campo.espessura_organica_cm >= 20 && input.campo.saturacao === 'permanente')
  ) {
    candidates.push({
      ordem: 'Organossolos',
      subordem: null,
      score: 98,
      criterios: [
        'Espessura organica atende criterio histico',
        'Assinatura de solo organico sob saturacao hidrica',
      ],
      faltantes: ['Grau de decomposicao da MO (fibrico/hemico/saprico) para subordem'],
      observacoes: ['Manter drenagem controlada para reduzir risco de subsidencia.'],
    });
  }

  if (input.campo.saturacao !== 'nunca' && input.campo.cor_glei) {
    candidates.push({
      ordem: 'Gleissolos',
      subordem: null,
      score: 95,
      criterios: [
        'Saturacao hidrica recorrente + cor glei em subsuperficie',
        input.campo.mosqueado ? 'Mosqueado ferruginoso reforca ambiente redox' : 'Ambiente redox indicado por cor glei',
      ],
      faltantes: ['Duracao da saturacao (temporaria/permanente) para refinar subordem'],
      observacoes: ['Risco de anoxia e toxidez por Fe/Mn em sistemas não adaptados.'],
    });
  }

  if (input.campo.plintita) {
    candidates.push({
      ordem: 'Plintossolos',
      subordem: null,
      score: 94,
      criterios: ['Presenca de plintita/petroplintita em campo'],
      faltantes: ['Confirmar continuidade e grau de endurecimento para detalhar subordem'],
      observacoes: ['Evitar drenagem agressiva para não acelerar endurecimento irreversivel.'],
    });
  }

  if (input.campo.fendas_seca && input.campo.slickensides) {
    const baseScore = highClayMajority === true ? 92 : 78;
    const missing =
      highClayMajority == null
        ? ['Argila por camadas para confirmar criterio >= 30% na maior parte do perfil']
        : [];
    candidates.push({
      ordem: 'Vertissolos',
      subordem:
        input.campo.saturacao !== 'nunca' ? 'Vertissolos Hidromorficos' : 'Vertissolos Haplicos',
      score: baseScore,
      criterios: [
        'Fendas estacionais + slickensides presentes',
        highClayMajority === true
          ? 'Argila >= 30% confirmada na maior parte do perfil'
          : 'Necessita confirmar teor de argila ao longo do perfil',
      ],
      faltantes: missing,
      observacoes: ['Operar apenas em faixa de umidade adequada para evitar degradacao estrutural.'],
    });
  }

  if (input.campo.b_planco_adensado) {
    if (mudancaTexturalAbrupta === true) {
      candidates.push({
        ordem: 'Planossolos',
        subordem: null,
        score: 90,
        criterios: ['B planico adensado + mudanca textural abrupta'],
        faltantes: ['Informar ESP/Na para diferenciar Haplico vs Natrico'],
        observacoes: ['Restricao fisico-hidrica relevante no subsolo.'],
      });
    } else if (mudancaTexturalAbrupta == null) {
      candidates.push({
        ordem: 'Planossolos',
        subordem: null,
        score: 74,
        criterios: ['B planico adensado identificado em campo'],
        faltantes: ['Argila em pelo menos duas camadas para confirmar mudanca textural abrupta'],
        observacoes: ['Confirmar assinatura textural para elevar confianca.'],
      });
    }
  }

  if (input.campo.horizonte_E) {
    if (sandyProfile && stronglyAcid) {
      candidates.push({
        ordem: 'Espodossolos',
        subordem: null,
        score: 86,
        criterios: ['Horizonte E claro + contexto arenoso + acidez forte'],
        faltantes: ['Validar horizonte espodico (Bh/Bs/Bhs) para confirmacao morfologica'],
        observacoes: ['Aptidao agricola geralmente baixa, com foco conservacionista.'],
      });
    } else {
      const missing = [
        !sandyProfile ? 'Textura completa por camadas para confirmar contexto arenoso' : '',
        !stronglyAcid ? 'Perfil de acidez (pH) para confirmar podzolizacao' : '',
      ].filter(Boolean);
      candidates.push({
        ordem: 'Espodossolos',
        subordem: null,
        score: 68,
        criterios: ['Horizonte E presente em campo'],
        faltantes: missing,
        observacoes: ['Necessario confirmar horizonte espodico para fechar diagnostico.'],
      });
    }
  }

  if (!hasAnyBDiagnostic) {
    candidates.push({
      ordem: 'Neossolos',
      subordem: buildSuborderForNeossolos(input, diagnostics),
      score: 82,
      criterios: ['Ausencia de horizonte B diagnostico no perfil simplificado'],
      faltantes: ['Detalhar ambiente de origem para confirmar subordem com maior precisao'],
      observacoes: ['Classe fortemente dependente do material de origem e profundidade efetiva.'],
    });
  }

  if (input.campo.tem_bi && !input.campo.tem_bt && !input.campo.tem_bw && !input.campo.tem_bn) {
    candidates.push({
      ordem: 'Cambissolos',
      subordem: null,
      score: 80,
      criterios: ['Presenca de B incipiente (Bi) sem Bt/Bw/Bn'],
      faltantes: ['Caracterizacao morfologica adicional para refinamento taxonomico'],
      observacoes: ['Variabilidade fisica e quimica elevada entre ambientes de ocorrencia.'],
    });
  }

  if (input.campo.tem_bt) {
    const vBt = diagnostics.v_bt_percentual;
    if (vBt != null) {
      candidates.push({
        ordem: vBt >= 50 ? 'Luvissolos' : 'Argissolos',
        subordem: null,
        score: 85,
        criterios: [
          'Horizonte Bt informado',
          vBt >= 50 ? `V% no Bt = ${vBt} (>= 50)` : `V% no Bt = ${vBt} (< 50)`,
        ],
        faltantes: [],
        observacoes: [
          vBt >= 50
            ? 'Assinatura eutrica favorece enquadramento em Luvissolos.'
            : 'Assinatura distrofica favorece enquadramento em Argissolos.',
        ],
      });
    } else {
      const missing = ['Ca, Mg, K e H+Al na camada Bt para calcular V%'];
      candidates.push({
        ordem: 'Argissolos',
        subordem: null,
        score: 70,
        criterios: ['Horizonte Bt informado, sem V% calculado'],
        faltantes: missing,
        observacoes: ['Sem V% do Bt o motor retorna classe provavel com baixa segurança.'],
      });
      candidates.push({
        ordem: 'Luvissolos',
        subordem: null,
        score: 70,
        criterios: ['Horizonte Bt informado, sem V% calculado'],
        faltantes: missing,
        observacoes: ['Sem V% do Bt o motor retorna classe provavel com baixa segurança.'],
      });
    }
  }

  if (input.campo.tem_bn) {
    candidates.push({
      ordem: 'Nitossolos',
      subordem: null,
      score: 84,
      criterios: ['Horizonte B nitico (Bn) informado em campo'],
      faltantes: ['Confirmar criterios morfologicos de estrutura nítica para fechamento'],
      observacoes: ['Alta aptidao fisica quando bem manejado em relevo adequado.'],
    });
  }

  if (input.campo.tem_bw) {
    candidates.push({
      ordem: 'Latossolos',
      subordem: null,
      score: 83,
      criterios: ['Horizonte B latossolico (Bw) informado em campo'],
      faltantes: ['Confirmar transicoes difusas e ausencia de gradiente textural forte'],
      observacoes: ['Boa aptidao fisica com maior dependencia de correcao quimica.'],
    });
  }

  if (input.campo.tem_A_chernozemico) {
    const hasHighV = surfaceLayer?.chemistry.v_percentual != null && surfaceLayer.chemistry.v_percentual >= 50;
    candidates.push({
      ordem: 'Chernossolos',
      subordem: null,
      score: hasHighV ? 86 : 80,
      criterios: [
        'Horizonte A chernozemico informado',
        hasHighV ? 'V% superficial >= 50 reforca carater eutrofico' : 'V% superficial não confirmado para reforco quimico',
      ],
      faltantes: hasHighV ? [] : ['Ca, Mg, K, Na e H+Al da camada superficial para confirmar V%'],
      observacoes: ['Conservar estrutura e materia organica para manter alta funcionalidade.'],
    });
  }

  const merged = sortCandidates(mergeCandidateList(candidates));
  const best = merged[0] ?? null;

  const genericMissing: string[] = [];
  if (layers.length < 2) {
    genericMissing.push('Informar ao menos duas camadas laboratoriais para leitura de gradiente textural');
  }
  if (input.campo.tem_bt && diagnostics.v_bt_percentual == null) {
    genericMissing.push('Dados quimicos do Bt (Ca, Mg, K, Na, H+Al) para separar Argissolos e Luvissolos');
  }
  if (input.campo.b_planco_adensado && mudancaTexturalAbrupta == null) {
    genericMissing.push('Argila de A e B para confirmar mudanca textural abrupta');
  }

  const dadosFaltantes = uniqueStrings([
    ...(best?.faltantes ?? []),
    ...genericMissing,
  ]);
  const criteriosUsados = best?.criterios ?? ['Sem criterios suficientes para classificacao automatica confiavel'];
  const observacoes = uniqueStrings([
    ...(best?.observacoes ?? []),
    ...buildAgronomicNotes(best?.ordem ?? null, diagnostics),
  ]);

  return {
    ordem_provavel: best?.ordem ?? null,
    subordem_provavel: best?.subordem ?? null,
    alternativas: merged.slice(1, 4).map((candidate) => ({
      ordem: candidate.ordem,
      subordem: candidate.subordem,
      confianca: candidate.score,
      justificativa: candidate.criterios.join('; '),
    })),
    confianca: best?.score ?? 0,
    criterios_usados: criteriosUsados,
    dados_faltantes_para_confirmar: dadosFaltantes,
    observacoes_agronomicas: observacoes,
    diagnosticos: diagnostics,
  };
}
