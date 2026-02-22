export type SoilTriState = 'unknown' | 'yes' | 'no';

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
  | 'Vertissolos';

export interface SoilRuleLayerInput {
  top_cm: number;
  bottom_cm: number;
  clay_pct: number | null;
  sand_pct: number | null;
  silt_pct: number | null;
  ph_h2o: number | null;
  ca: number | null;
  mg: number | null;
  k: number | null;
  na: number | null;
  al: number | null;
  h_al: number | null;
  p: number | null;
  om_pct: number | null;
  ec_dS_m: number | null;
}

export interface SoilRuleFieldInput {
  profile_depth_cm: number | null;
  contact_rock_cm: number | null;
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
  histic_thickness_cm: number | null;
  morph_diag: {
    has_Bw: SoilTriState;
    has_Bt: SoilTriState;
    has_Bi: SoilTriState;
    has_Bn: SoilTriState;
    has_A_chernozemic: SoilTriState;
  };
}

export interface SoilRuleInput {
  lab_layers: SoilRuleLayerInput[];
  field: SoilRuleFieldInput;
}

export interface SoilRuleEvidence {
  key: string;
  detail: string;
  score_delta: number;
}

export interface SoilRuleCandidate {
  order: SoilOrder;
  score: number;
  cap: number;
  effective_cap: number;
  mode: 'deterministic' | 'probabilistic';
  positives: SoilRuleEvidence[];
  conflicts: SoilRuleEvidence[];
  missing_critical: string[];
}

export interface SoilRuleDerivedMetrics {
  abrupt_textural_change: boolean | null;
  median_clay_pct: number | null;
  clay_all_le_15: boolean | null;
  texture_homogeneous: boolean | null;
  depth_cm: number | null;
  ph_surface: number | null;
  om_surface_pct: number | null;
  sand_surface_pct: number | null;
  v_percent_a: number | null;
  sb_bt: number | null;
  t_bt: number | null;
  v_percent_bt: number | null;
  m_percent_bt: number | null;
  bt_layer_used: string | null;
  any_b_diag_yes: boolean | null;
}

export interface SoilRuleTableResult {
  ranked: SoilRuleCandidate[];
  derived_metrics: SoilRuleDerivedMetrics;
}

const BASE_SCORE = 10;

const SPECIFICITY_PRIORITY: Record<SoilOrder, number> = {
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

function isFiniteNumber(value: unknown): value is number {
  return Number.isFinite(value);
}

function round2(value: number | null): number | null {
  if (!isFiniteNumber(value)) return null;
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function triIsYes(value: SoilTriState): boolean {
  return value === 'yes';
}

function triIsNo(value: SoilTriState): boolean {
  return value === 'no';
}

function triIsUnknown(value: SoilTriState): boolean {
  return value === 'unknown';
}

function median(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => isFiniteNumber(value)).sort((a, b) => a - b);
  if (!valid.length) return null;
  const mid = Math.floor(valid.length / 2);
  if (valid.length % 2 === 1) return valid[mid];
  return round2((valid[mid - 1] + valid[mid]) / 2);
}

function calcChemistry(layer: SoilRuleLayerInput): {
  sb: number | null;
  t: number | null;
  v_percent: number | null;
  m_percent: number | null;
} {
  const ca = layer.ca;
  const mg = layer.mg;
  const k = layer.k;
  const na = layer.na ?? 0;
  const al = layer.al;
  const hAl = layer.h_al;
  if (!isFiniteNumber(ca) || !isFiniteNumber(mg) || !isFiniteNumber(k) || !isFiniteNumber(hAl)) {
    return { sb: null, t: null, v_percent: null, m_percent: null };
  }
  const sb = ca + mg + k + na;
  const t = sb + hAl;
  const v = t > 0 ? (100 * sb) / t : null;
  const m = isFiniteNumber(al) && sb + al > 0 ? (100 * al) / (sb + al) : null;
  return {
    sb: round2(sb),
    t: round2(t),
    v_percent: round2(v),
    m_percent: round2(m),
  };
}

function detectAbruptTexturalChange(layers: SoilRuleLayerInput[]): boolean | null {
  if (layers.length < 2) return null;
  const surfaceClay = layers[0].clay_pct;
  const subsurfaceClay = layers[1].clay_pct;
  if (!isFiniteNumber(surfaceClay) || !isFiniteNumber(subsurfaceClay)) return null;
  if (surfaceClay < 20) return subsurfaceClay >= 2 * surfaceClay;
  return subsurfaceClay - surfaceClay >= 20;
}

function chooseBtLayer(input: SoilRuleInput, abruptTexturalChange: boolean | null): SoilRuleLayerInput | null {
  const layers = input.lab_layers;
  if (!layers.length) return null;
  if (layers.length === 1) return layers[0];
  if (triIsYes(input.field.morph_diag.has_Bt)) {
    const subsurface = layers.slice(1);
    return [...subsurface].sort((a, b) => (b.clay_pct ?? -1) - (a.clay_pct ?? -1))[0] ?? layers[1];
  }
  if (abruptTexturalChange) return layers[1];
  return layers[1];
}

function buildDerived(input: SoilRuleInput): SoilRuleDerivedMetrics {
  const layers = [...input.lab_layers].sort((a, b) => a.top_cm - b.top_cm);
  const abrupt = detectAbruptTexturalChange(layers);
  const btLayer = chooseBtLayer({ ...input, lab_layers: layers }, abrupt);
  const btChem = btLayer ? calcChemistry(btLayer) : { sb: null, t: null, v_percent: null, m_percent: null };
  const surface = layers[0] ?? null;
  const surfaceChem = surface ? calcChemistry(surface) : { sb: null, t: null, v_percent: null, m_percent: null };
  const clayValues = layers.map((layer) => layer.clay_pct);
  const clayValid = clayValues.filter((value): value is number => isFiniteNumber(value));
  const clayAllLe15 = clayValid.length > 0 ? clayValid.every((value) => value <= 15) : null;

  let depth = input.field.profile_depth_cm;
  if (!isFiniteNumber(depth) && layers.length) {
    depth = layers[layers.length - 1].bottom_cm;
  }

  let textureHomogeneous: boolean | null = null;
  if (layers.length >= 2 && isFiniteNumber(layers[0].clay_pct) && isFiniteNumber(layers[1].clay_pct)) {
    textureHomogeneous = Math.abs((layers[1].clay_pct ?? 0) - (layers[0].clay_pct ?? 0)) <= 10;
  }

  const anyBDiagnostic =
    triIsYes(input.field.morph_diag.has_Bw) ||
    triIsYes(input.field.morph_diag.has_Bt) ||
    triIsYes(input.field.morph_diag.has_Bi) ||
    triIsYes(input.field.morph_diag.has_Bn);
  const anyBDiagnosticNull =
    triIsUnknown(input.field.morph_diag.has_Bw) &&
    triIsUnknown(input.field.morph_diag.has_Bt) &&
    triIsUnknown(input.field.morph_diag.has_Bi) &&
    triIsUnknown(input.field.morph_diag.has_Bn)
      ? null
      : anyBDiagnostic;

  return {
    abrupt_textural_change: abrupt,
    median_clay_pct: median(clayValues),
    clay_all_le_15: clayAllLe15,
    texture_homogeneous: textureHomogeneous,
    depth_cm: isFiniteNumber(depth) ? depth : null,
    ph_surface: surface?.ph_h2o ?? null,
    om_surface_pct: surface?.om_pct ?? null,
    sand_surface_pct: surface?.sand_pct ?? null,
    v_percent_a: surfaceChem.v_percent,
    sb_bt: btChem.sb,
    t_bt: btChem.t,
    v_percent_bt: btChem.v_percent,
    m_percent_bt: btChem.m_percent,
    bt_layer_used: btLayer ? `${btLayer.top_cm}-${btLayer.bottom_cm}` : null,
    any_b_diag_yes: anyBDiagnosticNull,
  };
}

function createCandidate(order: SoilOrder, cap: number): SoilRuleCandidate {
  return {
    order,
    score: BASE_SCORE,
    cap,
    effective_cap: cap,
    mode: 'probabilistic',
    positives: [],
    conflicts: [],
    missing_critical: [],
  };
}

function addPositive(candidate: SoilRuleCandidate, key: string, detail: string, delta: number): void {
  candidate.score += delta;
  candidate.positives.push({ key, detail, score_delta: delta });
}

function addConflict(candidate: SoilRuleCandidate, key: string, detail: string, delta: number): void {
  candidate.score += delta;
  candidate.conflicts.push({ key, detail, score_delta: delta });
}

function addMissing(candidate: SoilRuleCandidate, detail: string): void {
  if (!candidate.missing_critical.includes(detail)) {
    candidate.missing_critical.push(detail);
  }
}

function applyCap(candidate: SoilRuleCandidate): SoilRuleCandidate {
  const capPenalty = candidate.missing_critical.length * 10;
  const effectiveCap = Math.max(40, candidate.cap - capPenalty);
  candidate.effective_cap = effectiveCap;
  candidate.score = clamp(Math.round(candidate.score), 0, effectiveCap);
  return candidate;
}

function sortCandidates(candidates: SoilRuleCandidate[]): SoilRuleCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.missing_critical.length !== b.missing_critical.length) {
      return a.missing_critical.length - b.missing_critical.length;
    }
    return SPECIFICITY_PRIORITY[a.order] - SPECIFICITY_PRIORITY[b.order];
  });
}

function evaluateOrganossolos(input: SoilRuleInput): SoilRuleCandidate {
  const candidate = createCandidate('Organossolos', 100);
  const histic = input.field.histic_thickness_cm;
  const sat = input.field.water_saturation;
  const omAll = input.lab_layers
    .map((layer) => layer.om_pct)
    .filter((value): value is number => isFiniteNumber(value));
  const omLowAll = omAll.length > 0 && omAll.every((value) => value <= 2);

  if (isFiniteNumber(histic) && histic >= 40) {
    addPositive(candidate, 'histic_ge_40', 'Espessura organica >= 40 cm.', 50);
    candidate.mode = 'deterministic';
    candidate.cap = 100;
  } else if (isFiniteNumber(histic) && histic >= 20 && sat === 'permanent') {
    addPositive(candidate, 'histic_ge_20_sat_perm', 'Espessura organica 20-39 cm com saturacao permanente.', 30);
    candidate.mode = 'deterministic';
    candidate.cap = 80;
  }
  if (sat !== 'never') addPositive(candidate, 'sat_not_never', 'Saturacao hidrica presente.', 10);
  if (isFiniteNumber(histic) && histic < 20) addConflict(candidate, 'histic_lt_20', 'Espessura organica < 20 cm.', -40);
  if ((histic == null || histic < 20) && omLowAll) {
    addConflict(candidate, 'om_low_no_histic', 'MO baixa sem camada organica significativa.', -30);
  }
  if (!isFiniteNumber(histic)) addMissing(candidate, 'Informar espessura organica (histic_thickness_cm).');
  return applyCap(candidate);
}

function evaluateGleissolos(input: SoilRuleInput): SoilRuleCandidate {
  const candidate = createCandidate('Gleissolos', 95);
  if (input.field.water_saturation !== 'never') {
    addPositive(candidate, 'sat_present', 'Saturacao hidrica recorrente.', 35);
  } else {
    addConflict(candidate, 'sat_never', 'Saturacao marcada como nunca.', -30);
  }
  if (triIsYes(input.field.gley_matrix)) addPositive(candidate, 'gley_yes', 'Matriz glei presente.', 35);
  if (triIsYes(input.field.mottles)) addPositive(candidate, 'mottles_yes', 'Mosqueados presentes.', 10);
  if (triIsNo(input.field.gley_matrix) && triIsNo(input.field.mottles)) {
    addConflict(candidate, 'no_redox_signals', 'Sem indicios redox (glei/mosqueado).', -20);
  }
  if (triIsUnknown(input.field.gley_matrix)) addMissing(candidate, 'Confirmar matriz glei em campo.');
  if (input.field.water_saturation !== 'never' && triIsYes(input.field.gley_matrix)) {
    candidate.mode = 'deterministic';
  }
  return applyCap(candidate);
}

function evaluatePlintossolos(input: SoilRuleInput): SoilRuleCandidate {
  const candidate = createCandidate('Plintossolos', 95);
  if (triIsYes(input.field.plinthite_or_petroplinthite)) {
    addPositive(candidate, 'plinthite_yes', 'Presenca de plintita/petroplintita.', 55);
    candidate.mode = 'deterministic';
  }
  if (triIsYes(input.field.petroplinthite_continuous)) {
    addPositive(candidate, 'petro_continuous', 'Petroplintita continua informada.', 10);
  }
  if (input.field.water_saturation !== 'never') {
    addPositive(candidate, 'sat_present', 'Saturacao hidrica reforca ambiente plintico.', 10);
  }
  if (
    input.field.water_saturation === 'never' &&
    triIsNo(input.field.gley_matrix) &&
    triIsNo(input.field.mottles)
  ) {
    addConflict(candidate, 'no_hydromorphism', 'Sem indicios hidromorficos associados.', -25);
  }
  if (triIsUnknown(input.field.plinthite_or_petroplinthite)) {
    addConflict(candidate, 'plinthite_unknown', 'Plintita não informada.', -20);
    addMissing(candidate, 'Confirmar presenca de plintita/petroplintita em campo.');
  }
  return applyCap(candidate);
}

function evaluateVertissolos(input: SoilRuleInput, derived: SoilRuleDerivedMetrics): SoilRuleCandidate {
  const candidate = createCandidate('Vertissolos', 95);
  if (triIsYes(input.field.seasonal_cracks)) addPositive(candidate, 'cracks_yes', 'Fendas estacionais presentes.', 45);
  if (triIsYes(input.field.slickensides)) addPositive(candidate, 'slick_yes', 'Slickensides presentes.', 35);
  if (derived.median_clay_pct != null && derived.median_clay_pct >= 30) {
    addPositive(candidate, 'clay_ge_30', 'Argila mediana >= 30%.', 10);
  }
  if (derived.median_clay_pct != null && derived.median_clay_pct < 25) {
    addConflict(candidate, 'clay_lt_25', 'Argila mediana < 25%.', -30);
  }
  if (triIsNo(input.field.seasonal_cracks)) addConflict(candidate, 'cracks_no', 'Fendas estacionais ausentes.', -20);
  if (triIsUnknown(input.field.seasonal_cracks)) addMissing(candidate, 'Confirmar fendas largas na estacao seca.');
  if (triIsUnknown(input.field.slickensides)) addMissing(candidate, 'Confirmar slickensides no perfil.');
  if (
    triIsYes(input.field.seasonal_cracks) &&
    triIsYes(input.field.slickensides) &&
    derived.median_clay_pct != null &&
    derived.median_clay_pct >= 30
  ) {
    candidate.mode = 'deterministic';
  }
  return applyCap(candidate);
}

function evaluatePlanossolos(input: SoilRuleInput, derived: SoilRuleDerivedMetrics): SoilRuleCandidate {
  const candidate = createCandidate('Planossolos', 90);
  if (triIsYes(input.field.dense_planic_layer_Bpl)) addPositive(candidate, 'bpl_yes', 'Camada adensada Bpl presente.', 40);
  if (derived.abrupt_textural_change === true) addPositive(candidate, 'abrupt_true', 'Mudanca textural abrupta confirmada.', 30);
  if (input.field.water_saturation === 'sometimes') addPositive(candidate, 'sat_sometimes', 'Saturacao ocasional compativel com lençol suspenso.', 10);
  if (derived.texture_homogeneous === true) addConflict(candidate, 'texture_homogeneous', 'Textura homogenea contradiz assinatura planica.', -25);
  if (triIsNo(input.field.dense_planic_layer_Bpl)) addConflict(candidate, 'bpl_no', 'Bpl marcado como ausente.', -20);
  if (triIsUnknown(input.field.dense_planic_layer_Bpl)) addMissing(candidate, 'Confirmar presenca de camada adensada B plânico.');
  if (derived.abrupt_textural_change == null) addMissing(candidate, 'Informar textura em pelo menos duas camadas para mudanca abrupta.');
  if (triIsYes(input.field.dense_planic_layer_Bpl) && derived.abrupt_textural_change === true) {
    candidate.mode = 'deterministic';
  }
  return applyCap(candidate);
}

function evaluateEspodossolos(input: SoilRuleInput, derived: SoilRuleDerivedMetrics): SoilRuleCandidate {
  const candidate = createCandidate('Espodossolos', 75);
  if (triIsYes(input.field.eluvial_E_horizon)) addPositive(candidate, 'e_horizon_yes', 'Horizonte E claro informado.', 25);
  if (derived.sand_surface_pct != null && derived.sand_surface_pct >= 70) addPositive(candidate, 'sand_ge_70', 'Areia superficial >= 70%.', 15);
  if (derived.ph_surface != null && derived.ph_surface <= 5.0) addPositive(candidate, 'ph_le_5', 'pH superficial <= 5.0.', 15);
  const subsurfaceOm = input.lab_layers[1]?.om_pct ?? null;
  if (
    derived.om_surface_pct != null &&
    derived.om_surface_pct <= 2 &&
    isFiniteNumber(subsurfaceOm) &&
    subsurfaceOm >= derived.om_surface_pct + 0.5
  ) {
    addPositive(candidate, 'om_pattern', 'Padrao de MO superficial baixa com incremento subsuperficial.', 10);
  }
  if (derived.median_clay_pct != null && derived.median_clay_pct >= 25) {
    addConflict(candidate, 'clay_ge_25', 'Argila mediana alta conflita com assinatura espodossolica.', -30);
  }
  if (triIsNo(input.field.eluvial_E_horizon)) addConflict(candidate, 'e_horizon_no', 'Horizonte E marcado como ausente.', -20);
  addMissing(candidate, 'Confirmar horizonte espodico (Bh/Bs/Bhs) em descrição morfologica.');
  return applyCap(candidate);
}

function evaluateNeossolos(input: SoilRuleInput, derived: SoilRuleDerivedMetrics): SoilRuleCandidate {
  const candidate = createCandidate('Neossolos', 90);
  const noneB =
    triIsNo(input.field.morph_diag.has_Bw) &&
    triIsNo(input.field.morph_diag.has_Bt) &&
    triIsNo(input.field.morph_diag.has_Bi) &&
    triIsNo(input.field.morph_diag.has_Bn);
  if (noneB) {
    addPositive(candidate, 'no_b_diag', 'Nenhum horizonte B diagnostico informado.', 40);
    candidate.mode = 'deterministic';
  }
  if (isFiniteNumber(input.field.contact_rock_cm) && input.field.contact_rock_cm < 50) {
    addPositive(candidate, 'rock_lt_50', 'Contato com rocha < 50 cm (litolico provavel).', 20);
  }
  if (derived.clay_all_le_15 === true) {
    addPositive(candidate, 'clay_all_le_15', 'Argila <= 15% em todas as camadas (quartzarênico provavel).', 20);
  }
  if (triIsYes(input.field.fluvial_stratification)) {
    addPositive(candidate, 'fluvial_yes', 'Estratificacao fluvial presente.', 15);
  }
  if (derived.any_b_diag_yes === true) {
    addConflict(candidate, 'any_b_yes', 'Horizonte B diagnostico presente conflita com Neossolos.', -30);
  }
  if (!noneB && derived.any_b_diag_yes == null) {
    addMissing(candidate, 'Confirmar ausencia/presenca de Bw, Bt, Bi e Bn.');
  }
  return applyCap(candidate);
}

function evaluateCambissolos(input: SoilRuleInput, derived: SoilRuleDerivedMetrics): SoilRuleCandidate {
  const candidate = createCandidate('Cambissolos', 90);
  if (triIsYes(input.field.morph_diag.has_Bi)) {
    addPositive(candidate, 'bi_yes', 'Horizonte Bi informado.', 50);
    candidate.mode = 'deterministic';
  }
  if (
    isFiniteNumber(derived.depth_cm) &&
    derived.depth_cm >= 50 &&
    derived.depth_cm <= 100 &&
    isFiniteNumber(input.field.contact_rock_cm) &&
    input.field.contact_rock_cm > 50
  ) {
    addPositive(candidate, 'depth_saprolite_proxy', 'Profundidade moderada compativel com perfil jovem.', 10);
  }
  if (
    triIsYes(input.field.morph_diag.has_Bt) ||
    triIsYes(input.field.morph_diag.has_Bw) ||
    triIsYes(input.field.morph_diag.has_Bn)
  ) {
    addConflict(candidate, 'other_b_diag', 'Bt/Bw/Bn presentes conflitam com Cambissolos.', -30);
  }
  if (triIsUnknown(input.field.morph_diag.has_Bi)) addMissing(candidate, 'Confirmar presenca de horizonte Bi.');
  return applyCap(candidate);
}

function evaluateArgissolos(input: SoilRuleInput, derived: SoilRuleDerivedMetrics): SoilRuleCandidate {
  const candidate = createCandidate('Argissolos', 90);
  if (triIsYes(input.field.morph_diag.has_Bt)) addPositive(candidate, 'bt_yes', 'Horizonte Bt informado.', 35);
  if (derived.abrupt_textural_change === true) addPositive(candidate, 'abrupt_true', 'Mudanca textural abrupta compativel com Bt.', 25);
  if (derived.v_percent_bt != null && derived.v_percent_bt < 50) addPositive(candidate, 'v_bt_lt_50', 'V% no Bt < 50.', 15);
  if (derived.texture_homogeneous === true) addConflict(candidate, 'texture_homogeneous', 'Textura homogenea conflita com assinatura argissolica.', -20);
  if (derived.v_percent_bt != null && derived.v_percent_bt >= 50) addConflict(candidate, 'v_bt_ge_50', 'V% no Bt >= 50 favorece Luvissolos.', -20);
  if (derived.v_percent_bt == null) addMissing(candidate, 'Calcular V% na camada Bt (Ca, Mg, K, Na e H+Al).');
  if (triIsUnknown(input.field.morph_diag.has_Bt)) addMissing(candidate, 'Confirmar horizonte Bt em morfologia.');
  if (triIsYes(input.field.morph_diag.has_Bt) && derived.v_percent_bt != null && derived.v_percent_bt < 50) {
    candidate.mode = 'deterministic';
  }
  return applyCap(candidate);
}

function evaluateLuvissolos(input: SoilRuleInput, derived: SoilRuleDerivedMetrics): SoilRuleCandidate {
  const candidate = createCandidate('Luvissolos', 90);
  if (triIsYes(input.field.morph_diag.has_Bt)) addPositive(candidate, 'bt_yes', 'Horizonte Bt informado.', 35);
  if (derived.abrupt_textural_change === true) addPositive(candidate, 'abrupt_true', 'Mudanca textural abrupta compativel com Bt.', 25);
  if (derived.v_percent_bt != null && derived.v_percent_bt >= 50) addPositive(candidate, 'v_bt_ge_50', 'V% no Bt >= 50.', 20);
  if (derived.v_percent_bt != null && derived.v_percent_bt < 50) addConflict(candidate, 'v_bt_lt_50', 'V% no Bt < 50 favorece Argissolos.', -20);
  if (derived.v_percent_bt == null) addMissing(candidate, 'Calcular V% na camada Bt (Ca, Mg, K, Na e H+Al).');
  if (triIsYes(input.field.morph_diag.has_Bt) && derived.v_percent_bt != null && derived.v_percent_bt >= 50) {
    candidate.mode = 'deterministic';
  }
  return applyCap(candidate);
}

function evaluateNitossolos(input: SoilRuleInput, derived: SoilRuleDerivedMetrics): SoilRuleCandidate {
  const candidate = createCandidate('Nitossolos', 90);
  if (triIsYes(input.field.morph_diag.has_Bn)) {
    addPositive(candidate, 'bn_yes', 'Horizonte Bn informado.', 50);
    candidate.mode = 'deterministic';
  }
  if (derived.median_clay_pct != null && derived.median_clay_pct >= 35) {
    addPositive(candidate, 'clay_high', 'Argila mediana alta compativel com Nitossolos.', 15);
  }
  if (isFiniteNumber(derived.depth_cm) && derived.depth_cm > 150) {
    addPositive(candidate, 'depth_gt_150', 'Perfil profundo (>150 cm).', 10);
  }
  if (derived.abrupt_textural_change === true) {
    addConflict(candidate, 'abrupt_true', 'Mudanca abrupta favorece Bt em vez de Bn.', -25);
  }
  if (triIsUnknown(input.field.morph_diag.has_Bn)) addMissing(candidate, 'Confirmar horizonte Bn em campo.');
  return applyCap(candidate);
}

function evaluateLatossolos(input: SoilRuleInput, derived: SoilRuleDerivedMetrics): SoilRuleCandidate {
  const candidate = createCandidate('Latossolos', 90);
  if (triIsYes(input.field.morph_diag.has_Bw)) {
    addPositive(candidate, 'bw_yes', 'Horizonte Bw informado.', 40);
    addPositive(candidate, 'granular_proxy', 'Bw confirmado (proxy para estrutura granular).', 10);
    candidate.mode = 'deterministic';
  }
  if (isFiniteNumber(derived.depth_cm) && derived.depth_cm > 200) {
    addPositive(candidate, 'depth_gt_200', 'Perfil muito profundo (>200 cm).', 15);
  }
  if (derived.texture_homogeneous === true) addPositive(candidate, 'texture_homogeneous', 'Baixo gradiente textural.', 15);
  if (triIsYes(input.field.morph_diag.has_Bt) || triIsYes(input.field.morph_diag.has_Bn)) {
    addConflict(candidate, 'bt_or_bn_yes', 'Bt/Bn presentes reduzem probabilidade de Latossolos.', -25);
  }
  if (triIsUnknown(input.field.morph_diag.has_Bw)) addMissing(candidate, 'Confirmar horizonte Bw em morfologia.');
  return applyCap(candidate);
}

function evaluateChernossolos(input: SoilRuleInput, derived: SoilRuleDerivedMetrics): SoilRuleCandidate {
  const candidate = createCandidate('Chernossolos', 80);
  if (triIsYes(input.field.morph_diag.has_A_chernozemic)) addPositive(candidate, 'a_cherno_yes', 'Horizonte A chernozemico informado.', 40);
  const firstThickness = input.lab_layers.length > 0 ? input.lab_layers[0].bottom_cm - input.lab_layers[0].top_cm : null;
  if (isFiniteNumber(firstThickness) && firstThickness >= 25 && isFiniteNumber(derived.om_surface_pct) && derived.om_surface_pct >= 3) {
    addPositive(candidate, 'dark_a_proxy', 'Camada superficial espessa com MO elevada (proxy de A escuro).', 15);
  }
  if (derived.v_percent_a != null && derived.v_percent_a >= 50) addPositive(candidate, 'v_a_ge_50', 'V% superficial >= 50.', 15);
  if (derived.ph_surface != null && derived.ph_surface <= 5 && derived.v_percent_a != null && derived.v_percent_a < 50) {
    addConflict(candidate, 'acid_low_v', 'pH muito acido com V% baixo conflita com Chernossolos.', -30);
  }
  if (triIsUnknown(input.field.morph_diag.has_A_chernozemic)) addMissing(candidate, 'Confirmar horizonte A chernozemico.');
  candidate.mode = 'probabilistic';
  return applyCap(candidate);
}

export function scoreSoilOrderCandidates(input: SoilRuleInput): SoilRuleTableResult {
  const layers = [...input.lab_layers].sort((a, b) => a.top_cm - b.top_cm);
  const normalizedInput: SoilRuleInput = { ...input, lab_layers: layers };
  const derived = buildDerived(normalizedInput);

  const candidates: SoilRuleCandidate[] = [
    evaluateOrganossolos(normalizedInput),
    evaluateGleissolos(normalizedInput),
    evaluatePlintossolos(normalizedInput),
    evaluateVertissolos(normalizedInput, derived),
    evaluatePlanossolos(normalizedInput, derived),
    evaluateEspodossolos(normalizedInput, derived),
    evaluateNeossolos(normalizedInput, derived),
    evaluateCambissolos(normalizedInput, derived),
    evaluateArgissolos(normalizedInput, derived),
    evaluateLuvissolos(normalizedInput, derived),
    evaluateNitossolos(normalizedInput, derived),
    evaluateLatossolos(normalizedInput, derived),
    evaluateChernossolos(normalizedInput, derived),
  ];

  return {
    ranked: sortCandidates(candidates),
    derived_metrics: derived,
  };
}
