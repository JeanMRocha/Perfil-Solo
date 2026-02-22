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

export type SoilChecklistAnswerType =
  | 'number_cm'
  | 'yes_no'
  | 'yes_no_unknown'
  | 'saturation';

export interface SoilChecklistQuestion {
  id: string;
  section: string;
  question: string;
  how_to_observe: string;
  answer_type: SoilChecklistAnswerType;
  field_key: string;
  favors_orders: SoilOrder[];
  penalizes_orders: SoilOrder[];
}

export interface SoilChecklistNextStep {
  action: 'field_check' | 'lab_test';
  what: string;
  why: string;
  expected_impact: 'raise_confidence' | 'resolve_conflict';
}

const CHECKLIST_QUESTIONS: SoilChecklistQuestion[] = [
  {
    id: 'q1_histic_thickness',
    section: 'Camada Organica',
    question: 'Existe camada organica espessa (>= 40 cm)?',
    how_to_observe: 'Medir com trena do topo ate o inicio claro mineral.',
    answer_type: 'number_cm',
    field_key: 'histic_thickness_cm',
    favors_orders: ['Organossolos'],
    penalizes_orders: ['Organossolos'],
  },
  {
    id: 'q2_water_saturation',
    section: 'Hidromorfia',
    question: 'O solo fica saturado com frequencia?',
    how_to_observe: 'Ver agua na cova, area brejosa, lencol alto e sinais de anaerobiose.',
    answer_type: 'saturation',
    field_key: 'water_saturation',
    favors_orders: ['Gleissolos', 'Plintossolos', 'Planossolos', 'Organossolos'],
    penalizes_orders: ['Gleissolos', 'Organossolos'],
  },
  {
    id: 'q3_gley_matrix',
    section: 'Hidromorfia',
    question: 'Ha matriz glei (cinza/azulada/esverdeada) no subsolo?',
    how_to_observe: 'Observar a cor na parede do perfil umido.',
    answer_type: 'yes_no',
    field_key: 'gley_matrix',
    favors_orders: ['Gleissolos'],
    penalizes_orders: ['Gleissolos'],
  },
  {
    id: 'q4_mottles',
    section: 'Hidromorfia',
    question: 'Ha mosqueados ferruginosos no subsolo?',
    how_to_observe: 'Procurar manchas vermelhas/amarelas em fundo acinzentado.',
    answer_type: 'yes_no',
    field_key: 'mottles',
    favors_orders: ['Gleissolos', 'Plintossolos', 'Planossolos'],
    penalizes_orders: [],
  },
  {
    id: 'q5_plinthite',
    section: 'Plintita',
    question: 'Ha plintita ou petroplintita no subsolo?',
    how_to_observe: 'Identificar nodulos/massas ferruginosas que podem endurecer ao secar.',
    answer_type: 'yes_no',
    field_key: 'plinthite_or_petroplinthite',
    favors_orders: ['Plintossolos'],
    penalizes_orders: ['Plintossolos'],
  },
  {
    id: 'q6_petroplinthite_continuous',
    section: 'Plintita',
    question: 'Existe camada continua muito dura (petroplintita)?',
    how_to_observe: 'Verificar impedimento fisico continuo no perfil (laje ferruginosa).',
    answer_type: 'yes_no',
    field_key: 'petroplinthite_continuous',
    favors_orders: ['Plintossolos'],
    penalizes_orders: [],
  },
  {
    id: 'q7_seasonal_cracks',
    section: 'Vertico',
    question: 'Na seca aparecem fendas largas (>= 1 cm) e profundas (>= 50 cm)?',
    how_to_observe: 'Inspecionar no periodo seco ou levantar histórico local.',
    answer_type: 'yes_no',
    field_key: 'seasonal_cracks',
    favors_orders: ['Vertissolos'],
    penalizes_orders: ['Vertissolos'],
  },
  {
    id: 'q8_slickensides',
    section: 'Vertico',
    question: 'Ha slickensides (superficies lisas/polidas) no subsolo?',
    how_to_observe: 'Observar faces brilhantes e alisadas nas paredes do perfil.',
    answer_type: 'yes_no',
    field_key: 'slickensides',
    favors_orders: ['Vertissolos'],
    penalizes_orders: ['Vertissolos'],
  },
  {
    id: 'q9_dense_bpl',
    section: 'Planico',
    question: 'Existe camada muito adensada no subsolo (B plânico)?',
    how_to_observe: 'Verificar resistencia a pa/trado e acúmulo de agua acima da camada.',
    answer_type: 'yes_no',
    field_key: 'dense_planic_layer_Bpl',
    favors_orders: ['Planossolos'],
    penalizes_orders: ['Planossolos'],
  },
  {
    id: 'q10_eluvial_e',
    section: 'Horizonte E',
    question: 'Existe horizonte E claro/esbranquicado?',
    how_to_observe: 'Identificar faixa clara lavada abaixo do horizonte A.',
    answer_type: 'yes_no',
    field_key: 'eluvial_E_horizon',
    favors_orders: ['Espodossolos', 'Argissolos'],
    penalizes_orders: ['Espodossolos'],
  },
  {
    id: 'q11_fluvial_stratification',
    section: 'Estratificacao',
    question: 'Ha estratificacao aluvial no perfil?',
    how_to_observe: 'Observar camadas alternadas de cor/textura como folhas deposicionais.',
    answer_type: 'yes_no',
    field_key: 'fluvial_stratification',
    favors_orders: ['Neossolos'],
    penalizes_orders: ['Latossolos', 'Nitossolos'],
  },
  {
    id: 'q12_contact_rock_cm',
    section: 'Profundidade',
    question: 'Qual a profundidade ate rocha/impedimento real?',
    how_to_observe: 'Medir até onde pá/trado não penetra por impedimento físico.',
    answer_type: 'number_cm',
    field_key: 'contact_rock_cm',
    favors_orders: ['Neossolos', 'Latossolos', 'Nitossolos'],
    penalizes_orders: [],
  },
  {
    id: 'q13_has_bt',
    section: 'Diagnosticos Morfologicos',
    question: 'Existe Bt (aumento claro de argila no subsolo)?',
    how_to_observe: 'Comparar tato/plasticidade da camada superficial com a subsuperficial.',
    answer_type: 'yes_no_unknown',
    field_key: 'morph_diag.has_Bt',
    favors_orders: ['Argissolos', 'Luvissolos'],
    penalizes_orders: ['Neossolos', 'Cambissolos'],
  },
  {
    id: 'q14_has_bi',
    section: 'Diagnosticos Morfologicos',
    question: 'Existe Bi (B incipiente) sem aumento forte de argila?',
    how_to_observe: 'Identificar horizonte B fraco sem assinatura clara de Bt/Bw/Bn.',
    answer_type: 'yes_no_unknown',
    field_key: 'morph_diag.has_Bi',
    favors_orders: ['Cambissolos'],
    penalizes_orders: ['Neossolos'],
  },
  {
    id: 'q15_has_bw',
    section: 'Diagnosticos Morfologicos',
    question: 'Existe Bw (B latossolico) com transicoes difusas e estrutura granular?',
    how_to_observe: 'Verificar perfil profundo, homogeneo e sem gradiente textural forte.',
    answer_type: 'yes_no_unknown',
    field_key: 'morph_diag.has_Bw',
    favors_orders: ['Latossolos'],
    penalizes_orders: ['Neossolos'],
  },
  {
    id: 'q16_has_bn',
    section: 'Diagnosticos Morfologicos',
    question: 'Existe Bn (nítico) com blocos fortes e faces níticas?',
    how_to_observe: 'Observar estrutura subangular forte com faces lisas bem definidas.',
    answer_type: 'yes_no_unknown',
    field_key: 'morph_diag.has_Bn',
    favors_orders: ['Nitossolos'],
    penalizes_orders: ['Neossolos'],
  },
  {
    id: 'q17_has_a_chernozemic',
    section: 'Diagnosticos Morfologicos',
    question: 'Existe A chernozemico (escuro, espesso, bem estruturado)?',
    how_to_observe: 'Confirmar A escuro espesso (>= 25 cm) com alta estabilidade estrutural.',
    answer_type: 'yes_no_unknown',
    field_key: 'morph_diag.has_A_chernozemic',
    favors_orders: ['Chernossolos'],
    penalizes_orders: [],
  },
];

export function listSoilChecklistQuestions(): SoilChecklistQuestion[] {
  return CHECKLIST_QUESTIONS.map((row) => ({ ...row }));
}

export function buildOrderConfirmationChecklist(order: SoilOrder): SoilChecklistNextStep[] {
  if (order === 'Espodossolos') {
    return [
      {
        action: 'field_check',
        what: 'Confirmar horizonte espodico (Bh/Bs/Bhs) na descrição morfologica.',
        why: 'Fecha assinatura de podzolizacao e reduz falso positivo com horizonte E isolado.',
        expected_impact: 'raise_confidence',
      },
    ];
  }
  if (order === 'Argissolos' || order === 'Luvissolos') {
    return [
      {
        action: 'lab_test',
        what: 'Calcular V% na camada Bt (Ca, Mg, K, Na e H+Al).',
        why: 'Separa Argissolos (V%<50) de Luvissolos (V%>=50) com criterio objetivo.',
        expected_impact: 'resolve_conflict',
      },
    ];
  }
  if (order === 'Latossolos') {
    return [
      {
        action: 'field_check',
        what: 'Confirmar horizonte Bw (estrutura granular estavel e transicao difusa).',
        why: 'Diferencia Latossolos de classes com Bt/Bn quando o perfil e profundo.',
        expected_impact: 'raise_confidence',
      },
    ];
  }
  if (order === 'Nitossolos') {
    return [
      {
        action: 'field_check',
        what: 'Confirmar horizonte Bn (faces niticas e estrutura em blocos subangulares fortes).',
        why: 'Evita confusao com Bt quando ha argila alta sem diagnostico nitico confirmado.',
        expected_impact: 'raise_confidence',
      },
    ];
  }
  return [];
}
