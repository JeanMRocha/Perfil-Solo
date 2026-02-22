import {
  scoreSoilOrderCandidates,
  type SoilRuleInput,
} from '@services/soilClassificationRuleTableService';
import {
  buildOrderConfirmationChecklist,
  listSoilChecklistQuestions,
} from '@services/soilFieldChecklistService';

export type SoilSourceType = 'manual' | 'pdf' | 'csv' | 'api';
export type SoilLabMethodP = 'mehlich' | 'resina' | 'outro' | 'nao_informado';
export type SoilBiomeHint =
  | 'amazonia'
  | 'cerrado'
  | 'caatinga'
  | 'mata_atlantica'
  | 'pampa'
  | 'pantanal'
  | null;
export type SoilTriState = 'unknown' | 'yes' | 'no';
export type SoilEngineMode = 'deterministic' | 'probabilistic';
export type SoilOrder =
  | 'Latossolos'
  | 'Argissolos'
  | 'Cambissolos'
  | 'Neossolos'
  | 'Luvissolos'
  | 'Nitossolos'
  | 'Chernossolos'
  | 'Espodossolos'
  | 'Planossolos'
  | 'Plintossolos'
  | 'Gleissolos'
  | 'Organossolos'
  | 'Vertissolos'
  | 'Indeterminada';

export interface SoilRequestMeta {
  engine_version: string;
  source: SoilSourceType;
  lab_name: string | null;
  lab_method_p: SoilLabMethodP;
  units: {
    cations: 'cmolc_dm3' | 'mmolc_dm3';
    p: 'mg_dm3';
    mo: 'percent' | 'g_kg';
    texture: 'percent' | 'g_kg';
  };
  location: {
    country: 'BR';
    state: string | null;
    municipality: string | null;
    biome_hint: SoilBiomeHint;
  };
}

export interface SoilRequestLayer {
  top_cm: number;
  bottom_cm: number;
  texture: {
    clay_pct: number | null;
    sand_pct: number | null;
    silt_pct: number | null;
  };
  chem: {
    ph_h2o: number | null;
    ph_kcl: number | null;
    ca: number | null;
    mg: number | null;
    k: number | null;
    na: number | null;
    al: number | null;
    h_al: number | null;
    p: number | null;
    om_pct: number | null;
    c_org_pct: number | null;
    ec_dS_m: number | null;
  };
}

export interface SoilRequestField {
  profile_depth_cm: number | null;
  contact_rock_cm: number | null;
  high_gravel_stoniness: SoilTriState;
  water_saturation: 'never' | 'sometimes' | 'permanent';
  gley_matrix: SoilTriState;
  mottles: SoilTriState;
  plinthite_or_petroplinthite: SoilTriState;
  petroplinthite_continuous: SoilTriState;
  seasonal_cracks: SoilTriState;
  slickensides: SoilTriState;
  eluvial_E_horizon: SoilTriState;
  dense_planic_layer_Bpl: SoilTriState;
  fluvial_stratification: SoilTriState;
  histic_thickness_cm: number;
  morph_diag: {
    has_Bw: SoilTriState;
    has_Bt: SoilTriState;
    has_Bi: SoilTriState;
    has_Bn: SoilTriState;
    has_A_chernozemic: SoilTriState;
  };
}

export interface SoilClassificationRequest {
  meta: SoilRequestMeta;
  lab_layers: SoilRequestLayer[];
  field: SoilRequestField;
}

export interface SoilClassificationValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SoilResultResponse {
  result: {
    primary: {
      order: SoilOrder;
      confidence: number;
      mode: SoilEngineMode;
      explanation_short: string;
    };
  };
  alternatives: Array<{
    order: SoilOrder;
    confidence: number;
    why_competes: string;
  }>;
  audit: {
    positive_evidence: Array<{ key: string; detail: string; score_delta: number }>;
    conflicts: Array<{ key: string; detail: string; score_delta: number }>;
    missing_critical: Array<{ key: string; detail: string }>;
    derived_metrics: {
      abrupt_textural_change: boolean | null;
      sb: number | null;
      t_ctc: number | null;
      v_percent: number | null;
      m_percent: number | null;
      layer_used_for_bt: string | null;
    };
  };
  agronomic_alerts: Array<{
    type:
      | 'acidity'
      | 'al_toxicity'
      | 'low_p'
      | 'low_ctc'
      | 'waterlogging'
      | 'erosion_risk'
      | 'salinity'
      | 'sodicity'
      | 'low_water_storage';
    severity: 'low' | 'medium' | 'high';
    message: string;
    based_on: string[];
  }>;
  next_steps: Array<{
    action: 'field_check' | 'lab_test';
    what: string;
    why: string;
    expected_impact: 'raise_confidence' | 'resolve_conflict';
  }>;
  checklist: {
    question_count: number;
    order_confirmation_focus: Array<{
      action: 'field_check' | 'lab_test';
      what: string;
      why: string;
      expected_impact: 'raise_confidence' | 'resolve_conflict';
    }>;
  };
}

function isFiniteNumber(value: unknown): value is number {
  return Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number | null): number | null {
  if (!isFiniteNumber(value)) return null;
  return Math.round(value * 100) / 100;
}

function normalizeMaybe(value: number | null | undefined): number | null {
  return isFiniteNumber(value) ? value : null;
}

function normalizeTexture(value: number | null, unit: SoilRequestMeta['units']['texture']): number | null {
  if (!isFiniteNumber(value)) return null;
  return unit === 'g_kg' ? value / 10 : value;
}

function normalizeOm(value: number | null, unit: SoilRequestMeta['units']['mo']): number | null {
  if (!isFiniteNumber(value)) return null;
  return unit === 'g_kg' ? value / 10 : value;
}

function normalizeCation(value: number | null, unit: SoilRequestMeta['units']['cations']): number | null {
  if (!isFiniteNumber(value)) return null;
  return unit === 'mmolc_dm3' ? value / 10 : value;
}

export function normalizeSoilClassificationRequest(
  request: SoilClassificationRequest,
): SoilClassificationRequest {
  return {
    ...request,
    meta: {
      ...request.meta,
      units: {
        ...request.meta.units,
        cations: 'cmolc_dm3',
        texture: 'percent',
        mo: 'percent',
      },
    },
    lab_layers: request.lab_layers.map((layer) => ({
      ...layer,
      texture: {
        clay_pct: normalizeTexture(layer.texture.clay_pct, request.meta.units.texture),
        sand_pct: normalizeTexture(layer.texture.sand_pct, request.meta.units.texture),
        silt_pct: normalizeTexture(layer.texture.silt_pct, request.meta.units.texture),
      },
      chem: {
        ph_h2o: normalizeMaybe(layer.chem.ph_h2o),
        ph_kcl: normalizeMaybe(layer.chem.ph_kcl),
        ca: normalizeCation(layer.chem.ca, request.meta.units.cations),
        mg: normalizeCation(layer.chem.mg, request.meta.units.cations),
        k: normalizeCation(layer.chem.k, request.meta.units.cations),
        na: normalizeCation(layer.chem.na, request.meta.units.cations),
        al: normalizeCation(layer.chem.al, request.meta.units.cations),
        h_al: normalizeCation(layer.chem.h_al, request.meta.units.cations),
        p: normalizeMaybe(layer.chem.p),
        om_pct: normalizeOm(layer.chem.om_pct, request.meta.units.mo),
        c_org_pct: normalizeMaybe(layer.chem.c_org_pct),
        ec_dS_m: normalizeMaybe(layer.chem.ec_dS_m),
      },
    })),
  };
}

export function validateSoilClassificationRequest(
  request: SoilClassificationRequest,
): SoilClassificationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!request.lab_layers.length) {
    errors.push('lab_layers deve possuir pelo menos uma camada.');
  }

  const sorted = [...request.lab_layers].sort((a, b) => a.top_cm - b.top_cm);
  for (let i = 0; i < sorted.length; i += 1) {
    const layer = sorted[i];
    if (!isFiniteNumber(layer.top_cm) || !isFiniteNumber(layer.bottom_cm)) {
      errors.push(`Camada ${i + 1}: top_cm e bottom_cm devem ser numericos.`);
    } else if (layer.top_cm >= layer.bottom_cm) {
      errors.push(`Camada ${i + 1}: top_cm deve ser menor que bottom_cm.`);
    }
    if (i > 0 && isFiniteNumber(sorted[i - 1].bottom_cm) && isFiniteNumber(layer.top_cm)) {
      if (layer.top_cm < sorted[i - 1].bottom_cm) {
        errors.push(`Camadas com sobreposicao: ${sorted[i - 1].top_cm}-${sorted[i - 1].bottom_cm} e ${layer.top_cm}-${layer.bottom_cm}.`);
      }
    }

    const textureValues = [layer.texture.clay_pct, layer.texture.sand_pct, layer.texture.silt_pct];
    if (textureValues.every((value) => isFiniteNumber(value))) {
      const sum = (layer.texture.clay_pct ?? 0) + (layer.texture.sand_pct ?? 0) + (layer.texture.silt_pct ?? 0);
      if (sum < 95 || sum > 105) {
        errors.push(`Camada ${i + 1}: soma de textura fora da faixa 95-105 (valor: ${round2(sum)}).`);
      }
    }

    const numericValues: Array<[string, number | null]> = [
      ['clay_pct', layer.texture.clay_pct],
      ['sand_pct', layer.texture.sand_pct],
      ['silt_pct', layer.texture.silt_pct],
      ['ph_h2o', layer.chem.ph_h2o],
      ['ca', layer.chem.ca],
      ['mg', layer.chem.mg],
      ['k', layer.chem.k],
      ['na', layer.chem.na],
      ['al', layer.chem.al],
      ['h_al', layer.chem.h_al],
      ['p', layer.chem.p],
      ['om_pct', layer.chem.om_pct],
      ['c_org_pct', layer.chem.c_org_pct],
      ['ec_dS_m', layer.chem.ec_dS_m],
    ];

    for (const [key, value] of numericValues) {
      if (!isFiniteNumber(value)) continue;
      if (value < 0) {
        errors.push(`Camada ${i + 1}: ${key} nao pode ser negativo.`);
      }
    }

    if (isFiniteNumber(layer.chem.ph_h2o) && (layer.chem.ph_h2o < 3 || layer.chem.ph_h2o > 9)) {
      errors.push(`Camada ${i + 1}: ph_h2o fora da faixa 3-9.`);
    }

    const suspiciousCations: Array<[string, number | null]> = [
      ['ca', layer.chem.ca],
      ['mg', layer.chem.mg],
      ['k', layer.chem.k],
      ['na', layer.chem.na],
      ['al', layer.chem.al],
      ['h_al', layer.chem.h_al],
    ];
    for (const [key, value] of suspiciousCations) {
      if (isFiniteNumber(value) && value > 40 && request.meta.units.cations === 'cmolc_dm3') {
        warnings.push(`Camada ${i + 1}: ${key} muito alto para cmolc/dm3 (verifique unidade de origem).`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function buildRuleInput(request: SoilClassificationRequest): SoilRuleInput {
  return {
    lab_layers: request.lab_layers.map((layer) => ({
      top_cm: layer.top_cm,
      bottom_cm: layer.bottom_cm,
      clay_pct: layer.texture.clay_pct,
      sand_pct: layer.texture.sand_pct,
      silt_pct: layer.texture.silt_pct,
      ph_h2o: layer.chem.ph_h2o,
      ca: layer.chem.ca,
      mg: layer.chem.mg,
      k: layer.chem.k,
      na: layer.chem.na,
      al: layer.chem.al,
      h_al: layer.chem.h_al,
      p: layer.chem.p,
      om_pct: layer.chem.om_pct,
      ec_dS_m: layer.chem.ec_dS_m,
    })),
    field: {
      profile_depth_cm: request.field.profile_depth_cm,
      contact_rock_cm: request.field.contact_rock_cm,
      water_saturation: request.field.water_saturation,
      gley_matrix: request.field.gley_matrix,
      mottles: request.field.mottles,
      plinthite_or_petroplinthite: request.field.plinthite_or_petroplinthite,
      petroplinthite_continuous: request.field.petroplinthite_continuous,
      seasonal_cracks: request.field.seasonal_cracks,
      slickensides: request.field.slickensides,
      eluvial_E_horizon: request.field.eluvial_E_horizon,
      dense_planic_layer_Bpl: request.field.dense_planic_layer_Bpl,
      fluvial_stratification: request.field.fluvial_stratification,
      histic_thickness_cm: request.field.histic_thickness_cm,
      morph_diag: {
        has_Bw: request.field.morph_diag.has_Bw,
        has_Bt: request.field.morph_diag.has_Bt,
        has_Bi: request.field.morph_diag.has_Bi,
        has_Bn: request.field.morph_diag.has_Bn,
        has_A_chernozemic: request.field.morph_diag.has_A_chernozemic,
      },
    },
  };
}

function mapOrder(order: string | null): SoilOrder {
  const validOrders: SoilOrder[] = [
    'Latossolos',
    'Argissolos',
    'Cambissolos',
    'Neossolos',
    'Luvissolos',
    'Nitossolos',
    'Chernossolos',
    'Espodossolos',
    'Planossolos',
    'Plintossolos',
    'Gleissolos',
    'Organossolos',
    'Vertissolos',
  ];
  if (order && validOrders.includes(order as SoilOrder)) return order as SoilOrder;
  return 'Indeterminada';
}

function buildAgronomicAlerts(
  normalized: SoilClassificationRequest,
  derived: SoilResultResponse['audit']['derived_metrics'],
): SoilResultResponse['agronomic_alerts'] {
  const alerts: SoilResultResponse['agronomic_alerts'] = [];
  const surface = normalized.lab_layers[0] ?? null;
  const ph = surface?.chem.ph_h2o ?? null;
  const p = surface?.chem.p ?? null;
  const ec = surface?.chem.ec_dS_m ?? null;
  const na = surface?.chem.na ?? null;
  const sand = surface?.texture.sand_pct ?? null;
  const om = surface?.chem.om_pct ?? null;

  if ((ph != null && ph <= 5.0) || (derived.m_percent != null && derived.m_percent >= 20)) {
    alerts.push({
      type: 'acidity',
      severity: 'high',
      message: 'Acidez elevada no perfil; revisar necessidade de correcao.',
      based_on: ['ph_h2o', 'm_percent'],
    });
  }
  if (derived.m_percent != null && derived.m_percent >= 20) {
    alerts.push({
      type: 'al_toxicity',
      severity: 'high',
      message: 'Saturacao por aluminio alta com risco para desenvolvimento radicular.',
      based_on: ['m_percent', 'al'],
    });
  }
  if (p != null && p < 8) {
    alerts.push({
      type: 'low_p',
      severity: 'medium',
      message: 'Fosforo disponivel baixo; avaliar estrategia de fosfatagem.',
      based_on: ['p'],
    });
  }
  if (derived.t_ctc != null && derived.t_ctc < 10) {
    alerts.push({
      type: 'low_ctc',
      severity: 'medium',
      message: 'CTC baixa na camada de referencia do subsolo.',
      based_on: ['t_ctc'],
    });
  }
  if (normalized.field.water_saturation !== 'never') {
    alerts.push({
      type: 'waterlogging',
      severity: normalized.field.water_saturation === 'permanent' ? 'high' : 'medium',
      message: 'Sinal de saturacao hidrica recorrente; ajustar manejo do sistema de produção.',
      based_on: ['water_saturation', 'gley_matrix', 'mottles'],
    });
  }
  if (ec != null && ec >= 4) {
    alerts.push({
      type: 'salinity',
      severity: 'high',
      message: 'Condutividade eletrica elevada com risco de salinidade.',
      based_on: ['ec_dS_m'],
    });
  }
  if (na != null && na >= 1) {
    alerts.push({
      type: 'sodicity',
      severity: 'medium',
      message: 'Sodio trocavel elevado; investigar sodicidade/ESP.',
      based_on: ['na'],
    });
  }
  if (sand != null && sand >= 70 && om != null && om <= 2) {
    alerts.push({
      type: 'low_water_storage',
      severity: 'medium',
      message: 'Perfil superficial arenoso com baixa MO e baixa capacidade de armazenamento de agua.',
      based_on: ['sand_pct', 'om_pct'],
    });
  }

  return alerts;
}

function buildNextSteps(
  missing: SoilResultResponse['audit']['missing_critical'],
): SoilResultResponse['next_steps'] {
  return missing.map((item) => {
    const text = item.detail.toLowerCase();
    const isLab =
      text.includes('ca') ||
      text.includes('mg') ||
      text.includes('k') ||
      text.includes('h+al') ||
      text.includes('argila') ||
      text.includes('ph') ||
      text.includes('v%');
    return {
      action: isLab ? 'lab_test' : 'field_check',
      what: item.detail,
      why: 'Necessario para confirmar a classificacao com maior certeza.',
      expected_impact: 'raise_confidence' as const,
    };
  });
}

function mergeNextSteps(
  base: SoilResultResponse['next_steps'],
  extra: SoilResultResponse['next_steps'],
): SoilResultResponse['next_steps'] {
  const merged = [...base, ...extra];
  const seen = new Set<string>();
  const output: SoilResultResponse['next_steps'] = [];
  for (const step of merged) {
    const key = `${step.action}::${step.what.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(step);
  }
  return output;
}

export function classifySoilByContract(
  rawRequest: SoilClassificationRequest,
): {
  validation: SoilClassificationValidation;
  response: SoilResultResponse;
} {
  const validation = validateSoilClassificationRequest(rawRequest);
  const request = normalizeSoilClassificationRequest(rawRequest);
  const scoring = scoreSoilOrderCandidates(buildRuleInput(request));
  const primaryCandidate = scoring.ranked[0] ?? null;
  const hasMinimumConfidence = (primaryCandidate?.score ?? 0) >= 40;
  const order = hasMinimumConfidence
    ? mapOrder(primaryCandidate?.order ?? null)
    : 'Indeterminada';
  const mode: SoilEngineMode =
    order === 'Indeterminada'
      ? 'probabilistic'
      : (primaryCandidate?.mode ?? 'probabilistic');

  const missingCritical = [
    ...(primaryCandidate?.missing_critical ?? []),
    ...validation.errors.map((error) => `Validacao de entrada: ${error}`),
  ].map((detail, idx) => ({
    key: `missing_${idx + 1}`,
    detail,
  }));

  const explanationShort =
    primaryCandidate?.positives[0]?.detail ??
    primaryCandidate?.conflicts[0]?.detail ??
    'Dados insuficientes para classificacao conclusiva.';

  const response: SoilResultResponse = {
    result: {
      primary: {
        order,
        confidence: clamp(Math.round(primaryCandidate?.score ?? 0), 0, 100),
        mode,
        explanation_short: explanationShort,
      },
    },
    alternatives: scoring.ranked.slice(1, 4).map((candidate) => ({
      order: mapOrder(candidate.order),
      confidence: clamp(Math.round(candidate.score), 0, 100),
      why_competes:
        candidate.positives[0]?.detail ??
        candidate.conflicts[0]?.detail ??
        'Competiu por evidencias parciais.',
    })),
    audit: {
      positive_evidence: (primaryCandidate?.positives ?? []).map((row, idx) => ({
        key: row.key || `positive_${idx + 1}`,
        detail: row.detail,
        score_delta: row.score_delta,
      })),
      conflicts: (primaryCandidate?.conflicts ?? []).map((row, idx) => ({
        key: row.key || `conflict_${idx + 1}`,
        detail: row.detail,
        score_delta: row.score_delta,
      })),
      missing_critical: missingCritical,
      derived_metrics: {
        abrupt_textural_change: scoring.derived_metrics.abrupt_textural_change,
        sb: round2(scoring.derived_metrics.sb_bt),
        t_ctc: round2(scoring.derived_metrics.t_bt),
        v_percent: round2(scoring.derived_metrics.v_percent_bt),
        m_percent: round2(scoring.derived_metrics.m_percent_bt),
        layer_used_for_bt: scoring.derived_metrics.bt_layer_used,
      },
    },
    agronomic_alerts: buildAgronomicAlerts(request, {
      abrupt_textural_change: scoring.derived_metrics.abrupt_textural_change,
      sb: round2(scoring.derived_metrics.sb_bt),
      t_ctc: round2(scoring.derived_metrics.t_bt),
      v_percent: round2(scoring.derived_metrics.v_percent_bt),
      m_percent: round2(scoring.derived_metrics.m_percent_bt),
      layer_used_for_bt: scoring.derived_metrics.bt_layer_used,
    }),
    next_steps: mergeNextSteps(
      buildNextSteps(missingCritical),
      buildOrderConfirmationChecklist(order),
    ),
    checklist: {
      question_count: listSoilChecklistQuestions().length,
      order_confirmation_focus: buildOrderConfirmationChecklist(order),
    },
  };

  if (!response.audit.positive_evidence.length) {
    response.audit.positive_evidence.push({
      key: 'positive_default',
      detail: 'Sem evidencias positivas suficientes para confirmar uma ordem.',
      score_delta: 0,
    });
  }

  return { validation, response };
}
