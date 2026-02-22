export type SoilRange = {
  raw: string;
  min: number | null;
  max: number | null;
  comparator: '<' | '>' | null;
};

export type SoilDepthClass =
  | 'muito_raso'
  | 'raso'
  | 'moderado'
  | 'profundo'
  | 'muito_profundo'
  | 'nao_classificado';

export interface AbruptTexturalChangeRule {
  definicao_sibcs: string;
  fonte: string;
  criterio_ae_menor_200: string;
  criterio_ae_maior_igual_200: string;
  distancia_vertical_max_cm: number;
  campos_obrigatorios_recomendados: string[];
}

export interface SoilTechnicalProfile {
  id: string;
  ordem: string;
  criterio_diagnostico?: string;
  criterio_distintivo?: string;
  subordens_disponiveis: string[];
  campos_obrigatorios_recomendados?: string[];
  subordem: string | null;
  grande_grupo: string | null;
  subgrupo: string | null;
  horizonte_diagnostico: string;
  horizontes_sequencia: string[];
  criterios_horizonte_diagnostico: string[];
  processo_formacao: string;
  processos_dominantes: string[];
  clima_formacao: string[];
  ambiente_pedogenetico: string;
  material_origem: string[];
  minerais_secundarios: string[];
  profundidade_cm: SoilRange;
  classe_profundidade: SoilDepthClass;
  estrutura: string;
  estrutura_tipo: string;
  estrutura_grau: string;
  estrutura_estabilidade: string;
  estrutura_bt: string | null;
  consistencia_umida_bt: string | null;
  presenca_cerosidade: string | null;
  textura_argila_percentual: SoilRange;
  argila_ae_g_kg: SoilRange;
  argila_bt_g_kg: SoilRange;
  mudanca_textural_abrupta: AbruptTexturalChangeRule | null;
  densidade_solo_g_cm3: SoilRange;
  porosidade_descricao: string;
  infiltracao_agua_descricao: string;
  ctc_cmolc_kg: SoilRange;
  v_percentual: SoilRange;
  ph: SoilRange;
  calcio_magnesio_status: string;
  potassio_status: string;
  fosforo_status: string;
  materia_organica_percentual: SoilRange;
  aluminio_trocavel_status: string;
  fertilidade_natural: string;
  fertilidade_conceito_tecnico: string;
  limitacoes_agronomicas: string[];
  manejo_recomendado: string[];
  culturas_tipicas: string[];
  uso_agricola: string;
  distribuicao: string[];
  distribuicao_percentual_brasil: string | null;
  biomas_associados: string[];
  ambiente_relevo: string[];
  source: string;
  source_url: string;
}

type RawSoilTechnicalProfile = {
  id: string;
  ordem: string;
  criterio_diagnostico?: string;
  criterio_distintivo?: string;
  subordens_disponiveis: string[];
  campos_obrigatorios_recomendados?: string[];
  subordem: string | null;
  grande_grupo: string | null;
  subgrupo: string | null;
  horizonte_diagnostico: string;
  horizontes_sequencia: string[];
  criterios_horizonte_diagnostico: string[];
  processo_formacao: string;
  processos_dominantes: string[];
  clima_formacao: string[];
  ambiente_pedogenetico: string;
  material_origem: string[];
  minerais_secundarios: string[];
  profundidade_cm: string;
  classe_profundidade?: SoilDepthClass;
  estrutura: string;
  estrutura_tipo: string;
  estrutura_grau: string;
  estrutura_estabilidade: string;
  estrutura_bt: string | null;
  consistencia_umida_bt: string | null;
  presenca_cerosidade: string | null;
  textura_argila_percentual: string;
  argila_ae_g_kg: string;
  argila_bt_g_kg: string;
  mudanca_textural_abrupta: AbruptTexturalChangeRule | null;
  densidade_solo_g_cm3: string;
  porosidade_descricao: string;
  infiltracao_agua_descricao: string;
  ctc_cmolc_kg: string;
  v_percentual: string;
  ph: string;
  calcio_magnesio_status: string;
  potassio_status: string;
  fosforo_status: string;
  materia_organica_percentual: string;
  aluminio_trocavel_status: string;
  fertilidade_natural: string;
  fertilidade_conceito_tecnico: string;
  limitacoes_agronomicas: string[];
  manejo_recomendado: string[];
  culturas_tipicas: string[];
  uso_agricola: string;
  distribuicao: string[];
  distribuicao_percentual_brasil: string | null;
  biomas_associados: string[];
  ambiente_relevo: string[];
  source: string;
  source_url: string;
};

function deriveDepthClass(range: SoilRange): SoilDepthClass {
  if (range.comparator === '>' && range.min != null && range.min >= 200) {
    return 'muito_profundo';
  }
  if (range.min != null && range.max != null) {
    if (range.max < 25) return 'muito_raso';
    if (range.min >= 25 && range.max <= 50) return 'raso';
    if (range.min >= 50 && range.max <= 100) return 'moderado';
    if (range.min >= 100 && range.max <= 200) return 'profundo';
    if (range.min > 200) return 'muito_profundo';
  }
  return 'nao_classificado';
}

function parseRange(rawValue: string): SoilRange {
  const raw = (rawValue ?? '').toString().trim();
  if (!raw) {
    return { raw: '', min: null, max: null, comparator: null };
  }

  const normalized = raw.replace(/[–—]/g, '-').replace(/\s+/g, '');
  const betweenMatch = normalized.match(/^(-?\d+(?:\.\d+)?)\-(-?\d+(?:\.\d+)?)$/);
  if (betweenMatch) {
    const a = Number.parseFloat(betweenMatch[1]);
    const b = Number.parseFloat(betweenMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return {
        raw,
        min: Math.min(a, b),
        max: Math.max(a, b),
        comparator: null,
      };
    }
  }

  const ltMatch = normalized.match(/^<(-?\d+(?:\.\d+)?)$/);
  if (ltMatch) {
    const value = Number.parseFloat(ltMatch[1]);
    return Number.isFinite(value)
      ? { raw, min: null, max: value, comparator: '<' }
      : { raw, min: null, max: null, comparator: null };
  }

  const gtMatch = normalized.match(/^>(-?\d+(?:\.\d+)?)$/);
  if (gtMatch) {
    const value = Number.parseFloat(gtMatch[1]);
    return Number.isFinite(value)
      ? { raw, min: value, max: null, comparator: '>' }
      : { raw, min: null, max: null, comparator: null };
  }

  const exact = Number.parseFloat(normalized);
  if (Number.isFinite(exact)) {
    return { raw, min: exact, max: exact, comparator: null };
  }

  return { raw, min: null, max: null, comparator: null };
}

const DEFAULT_SOIL_TECHNICAL_PROFILES_RAW: RawSoilTechnicalProfile[] = [
  {
    id: 'latossolos-referencia-embrapa-v1',
    ordem: 'Latossolos',
    criterio_diagnostico: 'Presenca de horizonte B latossolico (Bw)',
    criterio_distintivo: undefined,
    subordens_disponiveis: [],
    subordem: null,
    grande_grupo: null,
    subgrupo: null,
    horizonte_diagnostico: 'Bw',
    horizontes_sequencia: ['A', 'Bw', 'C'],
    criterios_horizonte_diagnostico: [
      'Espessura >= 50 cm',
      'Transicao difusa entre horizontes',
      'Estrutura granular muito pequena a pequena',
      'Forte agregacao mesmo em alta argila',
      'Ausencia de gradiente textural significativo',
    ],
    processo_formacao: 'Latolizacao',
    processos_dominantes: ['Latolizacao'],
    clima_formacao: ['Tropical umido', 'Tropical subumido'],
    ambiente_pedogenetico:
      'Longo tempo de exposicao pedogenetica, intensa lixiviacao de silica e bases, concentracao residual de oxidos de Fe e Al.',
    material_origem: [
      'Rochas cristalinas (granitos, gnaisses, basaltos)',
      'Sedimentos argilosos antigos',
    ],
    minerais_secundarios: ['Caulinita', 'Oxidos de Fe', 'Oxidos de Al'],
    profundidade_cm: '>200',
    classe_profundidade: 'muito_profundo',
    estrutura: 'Granular forte',
    estrutura_tipo: 'Granular',
    estrutura_grau: 'Forte',
    estrutura_estabilidade: 'Muito alta',
    estrutura_bt: null,
    consistencia_umida_bt: null,
    presenca_cerosidade: null,
    textura_argila_percentual: '35-80',
    argila_ae_g_kg: '',
    argila_bt_g_kg: '',
    mudanca_textural_abrupta: null,
    densidade_solo_g_cm3: '1.0-1.3',
    porosidade_descricao: 'Alta macroporosidade',
    infiltracao_agua_descricao: 'Excelente infiltracao de agua',
    ctc_cmolc_kg: '<10',
    v_percentual: '<50',
    ph: '4.5-5.8',
    calcio_magnesio_status: 'Baixos',
    potassio_status: 'Baixo a muito baixo',
    fosforo_status: 'Muito baixo (fixacao por oxidos)',
    materia_organica_percentual: '1-3',
    aluminio_trocavel_status: 'Pode estar presente',
    fertilidade_natural: 'Baixa',
    fertilidade_conceito_tecnico:
      'Fertilidade natural baixa, com CTC baixa, V% abaixo de 50% e deficiencia de Ca, Mg, K e P, demandando calagem e adubacao corretiva.',
    limitacoes_agronomicas: [
      'Baixa fertilidade natural',
      'Fixacao de fosforo',
      'Dependencia de insumos',
      'Possivel compactacao superficial por manejo inadequado',
    ],
    manejo_recomendado: [
      'Calagem para elevar V% (meta >= 60%)',
      'Adubacao fosfatada corretiva',
      'Manejo conservacionista',
      'Manutencao de materia organica',
    ],
    culturas_tipicas: [
      'Soja',
      'Milho',
      'Algodao',
      'Cafe',
      'Cana-de-acucar',
      'Fruticultura',
      'Pastagens intensivas',
    ],
    uso_agricola: 'Alta aptidao com correcao',
    distribuicao: ['Cerrado (Centro-Oeste)', 'Sudeste (SP, MG)', 'Sul (PR)', 'Norte'],
    distribuicao_percentual_brasil: '~31%',
    biomas_associados: ['Cerrado', 'Floresta Amazonica (terras firmes)', 'Mata Atlantica'],
    ambiente_relevo: ['Plano', 'Suave ondulado', 'Ondulado'],
    source: 'Embrapa - SiBCS',
    source_url: 'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil',
  },
  {
    id: 'argissolos-referencia-embrapa-v1',
    ordem: 'Argissolos',
    criterio_diagnostico: 'Presenca de horizonte B textural (Bt)',
    criterio_distintivo: 'Bt geralmente distrofico (V% < 50) na secao de controle',
    subordens_disponiveis: [
      'Argissolos Acinzentados',
      'Argissolos Amarelos',
      'Argissolos Vermelhos',
      'Argissolos Vermelho-Amarelos',
      'Argissolos Bruno-Acinzentados',
    ],
    subordem: null,
    grande_grupo: null,
    subgrupo: null,
    horizonte_diagnostico: 'Bt (B textural)',
    horizontes_sequencia: ['A', 'E (opcional)', 'Bt', 'C/saprolito'],
    criterios_horizonte_diagnostico: [
      'Presenca de Bt imediatamente abaixo de A ou E',
      'Acumulo iluvial de argila (argiluviacao)',
      'Estrutura em blocos subangulares/angulares e/ou prismatica',
      'Cerosidade pode ocorrer e reforca diagnostico',
    ],
    processo_formacao: 'Argiluviacao (lessivagem)',
    processos_dominantes: ['Argiluviacao (lessivagem)'],
    clima_formacao: ['Tropical', 'Subtropical'],
    ambiente_pedogenetico:
      'Ambientes com alternancia de umedecimento/secagem, com relevos ondulados a forte ondulados e materiais de origem diversos.',
    material_origem: [
      'Sedimentos diversos',
      'Rochas cristalinas intemperizadas',
    ],
    minerais_secundarios: [],
    profundidade_cm: '50-200',
    estrutura: 'Blocos subangulares/angulares e prismatica no Bt',
    estrutura_tipo: 'Blocos e/ou prismatica',
    estrutura_grau: 'Variavel',
    estrutura_estabilidade: 'Variavel',
    estrutura_bt: 'Blocos subangulares/angulares e/ou prismatica',
    consistencia_umida_bt: 'Firme a muito firme (variavel)',
    presenca_cerosidade: 'Pode ocorrer',
    textura_argila_percentual: '',
    argila_ae_g_kg: '',
    argila_bt_g_kg: '',
    mudanca_textural_abrupta: {
      definicao_sibcs:
        'Mudanca textural abrupta entre A/E e Bt em transicao curta.',
      fonte: 'SiBCS 2018 - Embrapa',
      criterio_ae_menor_200:
        'Se A/E < 200 g/kg de argila, Bt deve ser >= 2x o teor de argila do A/E.',
      criterio_ae_maior_igual_200:
        'Se A/E >= 200 g/kg de argila, incremento no Bt deve ser >= 200 g/kg.',
      distancia_vertical_max_cm: 7.5,
      campos_obrigatorios_recomendados: [
        'argila_AE_g_kg',
        'argila_Bt_g_kg',
        'V_percentual',
        'CTC_T_cmolc_kg',
        'Al3_cmolc_kg',
        'pH_H2O',
        'pH_KCl',
        'estrutura_Bt',
        'profundidade_efetiva_cm',
        'classe_profundidade',
      ],
    },
    densidade_solo_g_cm3: '',
    porosidade_descricao:
      'Variavel; menor macroporosidade no Bt quando ha adensamento ou mudanca textural abrupta.',
    infiltracao_agua_descricao:
      'Tende a reduzir no Bt, com maior escoamento superficial em declive.',
    ctc_cmolc_kg: '',
    v_percentual: '',
    ph: '',
    calcio_magnesio_status: 'Variavel; tende a baixa disponibilidade quando V% < 50',
    potassio_status: 'Variavel',
    fosforo_status: 'Pode ser baixo; atencao a estrategia de fosfatagem',
    materia_organica_percentual: '',
    aluminio_trocavel_status: 'Pode ser alto em ambientes mais acidos',
    fertilidade_natural: 'Variavel (depende de qualificadores como eutrofico/distrofico)',
    fertilidade_conceito_tecnico:
      'Interpretar por V%, CTC (T), Al/m%, pH e teores de nutrientes; a ordem por si só não define fertilidade.',
    limitacoes_agronomicas: [
      'Erosao em relevo ondulado/forte ondulado',
      'Restricao fisica/radicular no Bt em alguns perfis',
      'Drenagem interna variavel e encharcamento temporario acima do Bt',
    ],
    manejo_recomendado: [
      'Plantio em nivel, curvas de nivel e terraceamento quando necessario',
      'Cobertura permanente (palhada/adubos verdes)',
      'Trafego controlado para evitar compactacao',
      'Calagem/gessagem conforme diagnostico quimico e profundidade efetiva',
      'Manejo de P ajustado a textura e condicoes do Bt',
    ],
    culturas_tipicas: [],
    uso_agricola: 'Boa aptidao com manejo conservacionista e correcao quimica',
    distribuicao: [
      'Mata Atlantica',
      'Nordeste umido',
      'Faixas do Sudeste',
      'Faixas do Sul',
    ],
    distribuicao_percentual_brasil: null,
    biomas_associados: ['Mata Atlantica', 'Transicoes regionais'],
    ambiente_relevo: ['Suave ondulado', 'Ondulado', 'Forte ondulado'],
    source: 'Embrapa - SiBCS',
    source_url: 'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil',
  },
  {
    id: 'cambissolos-referencia-embrapa-v1',
    ordem: 'Cambissolos',
    criterio_diagnostico: 'Presenca de horizonte B incipiente (Bi)',
    criterio_distintivo: undefined,
    subordens_disponiveis: [
      'Cambissolos Haplicos',
      'Cambissolos Humicos',
      'Cambissolos Fluvicos',
    ],
    subordem: null,
    grande_grupo: null,
    subgrupo: null,
    horizonte_diagnostico: 'Bi (B incipiente)',
    horizontes_sequencia: ['A', 'Bi', 'C ou R'],
    criterios_horizonte_diagnostico: [
      'Alteracao estrutural e/ou cromatica em relacao ao horizonte A',
      'Espessura do Bi geralmente >= 15 cm',
      'Desenvolvimento pedogenetico fraco a moderado',
      'Sem Bt desenvolvido e sem Bw latossolico',
    ],
    processo_formacao: 'Intemperismo inicial',
    processos_dominantes: [
      'Intemperismo inicial de minerais primarios',
      'Alteracao estrutural e quimica incipiente',
      'Pouca ou nenhuma translocacao de argila',
    ],
    clima_formacao: ['Tropical', 'Subtropical', 'Temperado'],
    ambiente_pedogenetico:
      'Ambientes com relevo ondulado a montanhoso, erosao ativa e tempo pedogenetico relativamente curto.',
    material_origem: [
      'Rochas cristalinas',
      'Rochas sedimentares',
      'Materiais coluviais',
    ],
    minerais_secundarios: [],
    profundidade_cm: '25-150',
    classe_profundidade: 'nao_classificado',
    estrutura: 'Fraca a moderada, em blocos ou granular; podendo ser macica',
    estrutura_tipo: 'Blocos fracos, granular fraca ou macica',
    estrutura_grau: 'Fraco a moderado',
    estrutura_estabilidade: 'Menor que Latossolos e Nitossolos',
    estrutura_bt: null,
    consistencia_umida_bt: null,
    presenca_cerosidade: null,
    textura_argila_percentual: '',
    argila_ae_g_kg: '',
    argila_bt_g_kg: '',
    mudanca_textural_abrupta: null,
    densidade_solo_g_cm3: '',
    porosidade_descricao:
      'Variavel conforme material de origem e grau de desenvolvimento do perfil.',
    infiltracao_agua_descricao:
      'Variavel; menor retencao hidrica quando rasos e boa drenagem quando em relevo.',
    ctc_cmolc_kg: '',
    v_percentual: '',
    ph: '4.8-6.5',
    calcio_magnesio_status: 'Variavel conforme saturacao por bases',
    potassio_status: 'Variavel',
    fosforo_status: 'Geralmente baixo',
    materia_organica_percentual: '',
    aluminio_trocavel_status: 'Pode estar presente, sobretudo em ambientes umidos',
    fertilidade_natural: 'Variavel',
    fertilidade_conceito_tecnico:
      'Exigir análise química do perfil (V%, CTC, Al/m%, pH e nutrientes) para classificar fertilidade e recomendação.',
    limitacoes_agronomicas: [
      'Erosao',
      'Baixa profundidade efetiva em parte dos perfis',
      'Pedregosidade',
      'Alta variabilidade espacial',
    ],
    manejo_recomendado: [
      'Conservacao rigorosa do solo',
      'Evitar mecanizacao pesada',
      'Selecionar culturas adaptadas a profundidade efetiva',
      'Correcao quimica baseada em análise',
      'Cobertura permanente do solo',
    ],
    culturas_tipicas: [
      'Horticultura',
      'Fruticultura de clima ameno',
      'Pastagens bem manejadas',
    ],
    uso_agricola: 'Aptidao moderada, dependente de manejo conservacionista',
    distribuicao: [
      'Sul e Sudeste em relevo acidentado',
      'Bordas de planaltos',
      'Areas serranas',
      'Ambientes de transicao solo-rocha',
    ],
    distribuicao_percentual_brasil: null,
    biomas_associados: [
      'Mata Atlantica',
      'Campos Sulinos',
      'Regioes serranas do Cerrado',
    ],
    ambiente_relevo: ['Ondulado', 'Forte ondulado', 'Montanhoso'],
    source: 'Embrapa - SiBCS',
    source_url: 'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil',
  },
  {
    id: 'neossolos-referencia-embrapa-v1',
    ordem: 'Neossolos',
    criterio_diagnostico: 'Ausencia de horizonte B diagnostico',
    criterio_distintivo: undefined,
    subordens_disponiveis: [
      'Neossolos Litolicos',
      'Neossolos Regoliticos',
      'Neossolos Quartzarenicos',
      'Neossolos Fluvicos',
    ],
    campos_obrigatorios_recomendados: [
      'subordem',
      'profundidade_efetiva_cm',
      'classe_profundidade',
      'tipo_impedimento',
      'textura_perfil',
      'ctc_cmolc_kg',
      'v_percentual',
      'ph_h2o',
      'drenagem_interna',
    ],
    subordem: null,
    grande_grupo: null,
    subgrupo: null,
    horizonte_diagnostico: 'Ausente (sem Bw, Bt, Bn ou Bi desenvolvido)',
    horizontes_sequencia: ['A', 'C ou R'],
    criterios_horizonte_diagnostico: [
      'Não apresenta horizonte B diagnostico',
      'Presenca de pedogenese inicial controlada por material de origem e tempo curto',
      'Ocorrencia comum em ambientes jovens, instaveis ou fortemente condicionados por relevo/deposicao',
    ],
    processo_formacao: 'Pedogenese incipiente com intemperismo fisico dominante',
    processos_dominantes: [
      'Intemperismo fisico predominante',
      'Pedogenese incipiente',
      'Forte influencia do material de origem',
    ],
    clima_formacao: ['Tropical', 'Subtropical', 'Temperado'],
    ambiente_pedogenetico:
      'Ambientes jovens com tempo de formacao insuficiente, incluindo escarpas, encostas, chapadas arenosas e planicies aluviais recentes.',
    material_origem: [
      'Rocha pouco alterada (litolicos)',
      'Regolito/saprolito (regoliticos)',
      'Depositos quartzosos arenosos (quartzarenicos)',
      'Sedimentos aluviais recentes (fluvicos)',
    ],
    minerais_secundarios: [],
    profundidade_cm: '<25 a >150',
    classe_profundidade: 'nao_classificado',
    estrutura: 'Fraca a ausente, variando por subordem',
    estrutura_tipo: 'Graos simples, granular fraca, blocos fracos ou macica (dependente da subordem)',
    estrutura_grau: 'Muito fraco a moderado',
    estrutura_estabilidade: 'Baixa a variavel',
    estrutura_bt: null,
    consistencia_umida_bt: null,
    presenca_cerosidade: null,
    textura_argila_percentual: '',
    argila_ae_g_kg: '',
    argila_bt_g_kg: '',
    mudanca_textural_abrupta: null,
    densidade_solo_g_cm3: '',
    porosidade_descricao:
      'Muito variavel: baixa reserva hidrica em litolicos/quartzarenicos e heterogeneidade em fluvicos.',
    infiltracao_agua_descricao:
      'Variavel por subordem: drenagem excessiva em quartzarenicos e risco de inundacao em fluvicos.',
    ctc_cmolc_kg: '',
    v_percentual: '',
    ph: '',
    calcio_magnesio_status: 'Baixos a variaveis, conforme subordem e material de origem',
    potassio_status: 'Baixo a variavel',
    fosforo_status: 'Geralmente baixo (exceto fluvicos em alguns ambientes)',
    materia_organica_percentual: '',
    aluminio_trocavel_status: 'Variavel',
    fertilidade_natural: 'Restrita a moderada, fortemente dependente da subordem',
    fertilidade_conceito_tecnico:
      'A ordem não deve ser tratada como classe unica de fertilidade. Exigir diagnostico por subordem e análise laboratorial para recomendacao.',
    limitacoes_agronomicas: [
      'Baixa profundidade efetiva (lito/regoliticos rasos)',
      'Baixa reserva hidrica e baixa CTC (quartzarenicos)',
      'Erosao em relevo instavel',
      'Risco de inundacao em fluvicos',
      'Alta variabilidade espacial',
    ],
    manejo_recomendado: [
      'Manejo por subordem, sem generalizacao da ordem',
      'Conservacao rigorosa do solo e cobertura permanente',
      'Evitar mecanizacao pesada em perfis rasos',
      'Adequar culturas a profundidade efetiva e ao tipo de impedimento',
      'Correcao quimica com base em análise real',
      'Nos fluvicos, planejar drenagem e risco hidrologico',
    ],
    culturas_tipicas: [
      'Pastagens extensivas (lito/quartzarenicos)',
      'Silvicultura adaptada (quartzarenicos)',
      'Fruticultura adaptada (regoliticos)',
      'Culturas anuais e horticultura (fluvicos bem drenados)',
    ],
    uso_agricola: 'Restrito a moderado, dependente da subordem e do manejo especifico',
    distribuicao: [
      'Serras e escarpas (Litolicos)',
      'Encostas suaves (Regoliticos)',
      'Chapadas arenosas (Quartzarenicos)',
      'Vales e varzeas fluviais (Fluvicos)',
    ],
    distribuicao_percentual_brasil: null,
    biomas_associados: ['Distribuicao nacional, conforme subordem e ambiente local'],
    ambiente_relevo: ['Plano', 'Suave ondulado', 'Ondulado', 'Forte ondulado', 'Montanhoso'],
    source: 'Embrapa - SiBCS',
    source_url: 'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil',
  },
  {
    id: 'luvissolos-referencia-embrapa-v1',
    ordem: 'Luvissolos',
    criterio_diagnostico: 'Presenca de horizonte B textural (Bt)',
    criterio_distintivo: 'Carater eutrico no Bt: V% >= 50 na secao de controle',
    subordens_disponiveis: [
      'Luvissolos Cromicos',
      'Luvissolos Hipocromicos',
      'Luvissolos Palicos',
    ],
    campos_obrigatorios_recomendados: [
      'subordem',
      'v_percentual',
      'ctc_cmolc_kg',
      'ph_h2o',
      'al3_trocavel',
      'ca',
      'mg',
      'k',
      'p_disponivel',
      'textura_bt',
      'profundidade_efetiva_cm',
      'classe_profundidade',
    ],
    subordem: null,
    grande_grupo: null,
    subgrupo: null,
    horizonte_diagnostico: 'Bt (B textural)',
    horizontes_sequencia: ['A', 'E (opcional)', 'Bt', 'C/Cr'],
    criterios_horizonte_diagnostico: [
      'Presenca de Bt com argila elevada em relacao ao horizonte superficial',
      'Estrutura em blocos angulares/subangulares no Bt',
      'Cerosidade comum (evidencia de argiluviacao)',
      'Saturacao por bases elevada (carater eutrico)',
    ],
    processo_formacao: 'Argiluviacao com baixa lixiviacao de bases',
    processos_dominantes: [
      'Argiluviacao',
      'Retencao relativa de bases no Bt',
    ],
    clima_formacao: ['Subumido', 'Semiarido'],
    ambiente_pedogenetico:
      'Ambientes com menor intensidade de lavagem quimica e materiais de origem ricos em bases.',
    material_origem: [
      'Calcarios',
      'Rochas maficas',
      'Sedimentos ricos em bases',
    ],
    minerais_secundarios: [],
    profundidade_cm: '50-200',
    classe_profundidade: 'nao_classificado',
    estrutura: 'Bt em blocos bem desenvolvidos',
    estrutura_tipo: 'Blocos angulares/subangulares',
    estrutura_grau: 'Moderado a forte',
    estrutura_estabilidade: 'Moderada',
    estrutura_bt: 'Blocos angulares/subangulares bem desenvolvidos',
    consistencia_umida_bt: 'Coeso/firme, variavel por teor de argila',
    presenca_cerosidade: 'Comum',
    textura_argila_percentual: '',
    argila_ae_g_kg: '',
    argila_bt_g_kg: '',
    mudanca_textural_abrupta: null,
    densidade_solo_g_cm3: '',
    porosidade_descricao: 'Boa retencao de agua no Bt, com possibilidade de restricao fisica.',
    infiltracao_agua_descricao:
      'Pode reduzir no Bt, elevando risco de escoamento superficial em relevo ondulado.',
    ctc_cmolc_kg: '',
    v_percentual: '>=50',
    ph: '5.5-7.0',
    calcio_magnesio_status: 'Elevados em relacao a Argissolos',
    potassio_status: 'Medio a alto',
    fosforo_status: 'Baixo a medio (fixacao ainda pode ocorrer)',
    materia_organica_percentual: '',
    aluminio_trocavel_status: 'Baixo ou ausente (mais comum)',
    fertilidade_natural: 'Media a alta',
    fertilidade_conceito_tecnico:
      'Fertilidade natural media a alta com V% >= 50, condicionada ao manejo fisico do Bt e a estrategia de fosforo.',
    limitacoes_agronomicas: [
      'Erosao em relevo ondulado',
      'Compactacao do Bt',
      'Drenagem interna moderada',
    ],
    manejo_recomendado: [
      'Conservacao do solo com plantio em nivel/curvas de nivel',
      'Manejo da estrutura do Bt para reduzir compactacao',
      'Adubacao fosfatada estrategica',
      'Cobertura vegetal permanente',
    ],
    culturas_tipicas: [
      'Culturas exigentes em Ca e Mg (com manejo conservacionista)',
    ],
    uso_agricola: 'Alta aptidao com manejo conservacionista',
    distribuicao: [
      'Nordeste semiarido',
      'Norte de Minas Gerais',
      'Areas do Centro-Oeste com materiais ricos em bases',
    ],
    distribuicao_percentual_brasil: null,
    biomas_associados: ['Caatinga', 'Transicao Cerrado-Caatinga'],
    ambiente_relevo: ['Plano', 'Suave ondulado', 'Ondulado'],
    source: 'Embrapa - SiBCS',
    source_url: 'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil',
  },
  {
    id: 'nitossolos-referencia-embrapa-v1',
    ordem: 'Nitossolos',
    criterio_diagnostico: 'Presenca de horizonte B nitico (Bn)',
    criterio_distintivo:
      'Horizonte B nitico com alta argila, estrutura muito bem desenvolvida e agregacao forte',
    subordens_disponiveis: [
      'Nitossolos Vermelhos',
      'Nitossolos Haplicos',
    ],
    campos_obrigatorios_recomendados: [
      'subordem',
      'argila_g_kg',
      'estrutura_bn',
      'profundidade_efetiva_cm',
      'classe_profundidade',
      'v_percentual',
      'ctc_cmolc_kg',
      'ph_h2o',
      'ca',
      'mg',
      'k',
      'p_disponivel',
    ],
    subordem: null,
    grande_grupo: null,
    subgrupo: null,
    horizonte_diagnostico: 'Bn (B nitico)',
    horizontes_sequencia: ['A', 'Bn', 'C/Cr'],
    criterios_horizonte_diagnostico: [
      'Teor de argila elevado, geralmente > 350 g/kg',
      'Estrutura em blocos subangulares muito bem desenvolvidos',
      'Faces de agregados nitidas e lisas',
      'Alta estabilidade estrutural e boa porosidade',
      'Sem gradiente textural abrupto tipico de Argissolos',
    ],
    processo_formacao: 'Intemperismo avancado com reorganizacao intensa da fracao argila',
    processos_dominantes: [
      'Intemperismo quimico avancado',
      'Reorganizacao intensa da fracao argila',
      'Formacao de agregados muito estaveis',
    ],
    clima_formacao: ['Tropical umido', 'Tropical subumido'],
    ambiente_pedogenetico:
      'Ambientes bem drenados em relevo suave ondulado a ondulado, com materiais ricos em ferro e argila.',
    material_origem: [
      'Rochas maficas (basalto, diabasio)',
      'Rochas intermediarias ricas em ferro',
    ],
    minerais_secundarios: [],
    profundidade_cm: '100->200',
    classe_profundidade: 'nao_classificado',
    estrutura: 'Blocos subangulares fortes com alta estabilidade',
    estrutura_tipo: 'Blocos subangulares',
    estrutura_grau: 'Forte',
    estrutura_estabilidade: 'Muito alta',
    estrutura_bt: 'Bn com blocos subangulares muito bem desenvolvidos',
    consistencia_umida_bt: 'Firme a friavel conforme umidade; sem comportamento de Bt adensado',
    presenca_cerosidade: 'Não e criterio central',
    textura_argila_percentual: '',
    argila_ae_g_kg: '',
    argila_bt_g_kg: '>350',
    mudanca_textural_abrupta: null,
    densidade_solo_g_cm3: '',
    porosidade_descricao: 'Boa distribuicao de poros mesmo com alta argila.',
    infiltracao_agua_descricao:
      'Boa infiltracao e boa a excelente drenagem interna em condicoes naturais.',
    ctc_cmolc_kg: '',
    v_percentual: '',
    ph: '5.0-6.5',
    calcio_magnesio_status:
      'Medios a altos (especialmente em perfis eutroficos)',
    potassio_status: 'Medio',
    fosforo_status: 'Baixo a medio (fixacao pode ocorrer)',
    materia_organica_percentual: '',
    aluminio_trocavel_status: 'Geralmente baixo em eutroficos',
    fertilidade_natural: 'Media a alta (variavel por qualificadores e diagnostico)',
    fertilidade_conceito_tecnico:
      'Alta aptidao fisica com fertilidade quimica de media a alta, exigindo ajuste de P e manejo conservacionista em relevo.',
    limitacoes_agronomicas: [
      'Erosao em relevo ondulado',
      'Fixacao de fosforo',
      'Dependencia de manejo conservacionista',
    ],
    manejo_recomendado: [
      'Plantio em nivel',
      'Cobertura permanente do solo',
      'Correcao quimica conforme análise',
      'Manejo fosfatado de longo prazo',
    ],
    culturas_tipicas: [
      'Culturas anuais de alta exigencia',
      'Culturas perenes',
    ],
    uso_agricola: 'Muito alta aptidao agricola',
    distribuicao: [
      'Sul do Brasil (PR, SC, RS)',
      'Oeste de Sao Paulo',
      'Areas basalticas do Sudeste e Sul',
    ],
    distribuicao_percentual_brasil: null,
    biomas_associados: ['Mata Atlantica', 'Cerrado (areas especificas)'],
    ambiente_relevo: ['Suave ondulado', 'Ondulado'],
    source: 'Embrapa - SiBCS',
    source_url: 'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil',
  },
  {
    id: 'chernossolos-referencia-embrapa-v1',
    ordem: 'Chernossolos',
    criterio_diagnostico: 'Presenca de horizonte A chernozemico',
    criterio_distintivo:
      'Horizonte A escuro, espesso, com alto teor de materia organica e saturacao por bases >= 50%',
    subordens_disponiveis: [
      'Chernossolos Argiluvicos',
      'Chernossolos Rendzicos',
      'Chernossolos Ebanicos',
      'Chernossolos Haplicos',
    ],
    campos_obrigatorios_recomendados: [
      'subordem',
      'espessura_horizonte_a_cm',
      'v_percentual',
      'ctc_cmolc_kg',
      'ph_h2o',
      'ca',
      'mg',
      'k',
      'p_disponivel',
      'carbono_organico_percentual',
      'profundidade_efetiva_cm',
      'classe_profundidade',
    ],
    subordem: null,
    grande_grupo: null,
    subgrupo: null,
    horizonte_diagnostico: 'A chernozemico',
    horizontes_sequencia: ['A chernozemico', 'Bt (opcional)', 'C/Cr'],
    criterios_horizonte_diagnostico: [
      'Espessura do horizonte A >= 25 cm',
      'Cor escura (baixo valor e croma)',
      'Teor elevado de carbono organico',
      'Saturacao por bases >= 50%',
      'Estrutura superficial granular muito estavel',
    ],
    processo_formacao: 'Acumulo de materia organica com baixa lixiviacao de bases',
    processos_dominantes: [
      'Acumulo intenso de materia organica no horizonte superficial',
      'Forte atividade biologica (bioturbacao)',
      'Baixa lixiviacao de bases',
    ],
    clima_formacao: ['Subumido', 'Semiarido'],
    ambiente_pedogenetico:
      'Ambientes com estacao seca definida, vegetacao graminoide e relevo plano a suave ondulado.',
    material_origem: [
      'Calcarios',
      'Margas',
      'Basaltos',
      'Sedimentos finos ricos em Ca e Mg',
    ],
    minerais_secundarios: [],
    profundidade_cm: '50-200',
    classe_profundidade: 'nao_classificado',
    estrutura: 'Granular forte no A, com blocos estaveis em subsuperficie',
    estrutura_tipo: 'Granular forte (A) e blocos bem desenvolvidos (subsuperficie)',
    estrutura_grau: 'Forte',
    estrutura_estabilidade: 'Alta',
    estrutura_bt: 'Pode ocorrer em Chernossolos Argiluvicos',
    consistencia_umida_bt: 'Variavel quando presente',
    presenca_cerosidade: 'Pode ocorrer em perfis com Bt',
    textura_argila_percentual: '',
    argila_ae_g_kg: '',
    argila_bt_g_kg: '',
    mudanca_textural_abrupta: null,
    densidade_solo_g_cm3: '',
    porosidade_descricao: 'Boa porosidade e excelente ambiente radicular.',
    infiltracao_agua_descricao:
      'Boa infiltracao e alta retencao de agua disponivel.',
    ctc_cmolc_kg: '',
    v_percentual: '>=50',
    ph: '6.0-7.5',
    calcio_magnesio_status: 'Altos',
    potassio_status: 'Medio a alto',
    fosforo_status: 'Medio a alto (dependente do material de origem e manejo)',
    materia_organica_percentual: '>3-4',
    aluminio_trocavel_status: 'Ausente ou muito baixo',
    fertilidade_natural: 'Muito alta',
    fertilidade_conceito_tecnico:
      'Alta fertilidade natural com CTC alta, V% elevado e altos teores de Ca/Mg, exigindo foco na conservacao estrutural e reposicao de nutrientes exportados.',
    limitacoes_agronomicas: [
      'Distribuicao geografica muito restrita',
      'Risco de degradacao estrutural por manejo inadequado',
      'Erosao em areas declivosas',
    ],
    manejo_recomendado: [
      'Conservacao da estrutura do horizonte A',
      'Evitar revolvimento excessivo',
      'Manutencao de materia organica',
      'Manejo de fosforo conforme exportacao',
      'Praticas conservacionistas em declive',
    ],
    culturas_tipicas: [
      'Graos',
      'Forrageiras',
      'Culturas exigentes em alta fertilidade',
    ],
    uso_agricola: 'Muito alta aptidao agricola',
    distribuicao: [
      'Sul do Brasil (RS, ocorrencias pontuais)',
      'Areas especificas do Nordeste semiarido',
      'Ambientes calcarios/basalticos pontuais',
    ],
    distribuicao_percentual_brasil: null,
    biomas_associados: ['Campos Sulinos', 'Caatinga (locais especificos)'],
    ambiente_relevo: ['Plano', 'Suave ondulado', 'Ondulado'],
    source: 'Embrapa - SiBCS',
    source_url: 'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil',
  },
  {
    id: 'espodossolos-referencia-embrapa-v1',
    ordem: 'Espodossolos',
    criterio_diagnostico: 'Presenca de horizonte B espodico (Bh, Bs ou Bhs)',
    criterio_distintivo:
      'Acumulo iluvial de materia organica associada a Al e/ou Fe em subsuperficie (podzolizacao)',
    subordens_disponiveis: [
      'Espodossolos Humiluvicos',
      'Espodossolos Ferriluvicos',
      'Espodossolos Haplicos',
    ],
    campos_obrigatorios_recomendados: [
      'subordem',
      'horizonte_espodico_tipo',
      'profundidade_efetiva_cm',
      'classe_profundidade',
      'presenca_ortstein',
      'nivel_lencol_freatico',
      'textura_perfil',
      'argila_g_kg',
      'ph_h2o',
      'v_percentual',
      'ctc_cmolc_kg',
      'al3_trocavel',
    ],
    subordem: null,
    grande_grupo: null,
    subgrupo: null,
    horizonte_diagnostico: 'Bh / Bs / Bhs (B espodico)',
    horizontes_sequencia: ['A', 'E', 'Bh/Bs/Bhs', 'C'],
    criterios_horizonte_diagnostico: [
      'Acumulo iluvial de MO + Al ± Fe no horizonte espodico',
      'Presenca frequente de horizonte E eluviado e esbranquicado',
      'Cor escura (Bh) ou escura-avermelhada (Bhs/Bs)',
      'Pode ocorrer cimentacao parcial (ortstein/hardpan espodico)',
    ],
    processo_formacao: 'Podzolizacao',
    processos_dominantes: [
      'Complexacao de Al e Fe por acidos organicos',
      'Translocacao de complexos organometalicos',
      'Precipitacao no horizonte espodico',
    ],
    clima_formacao: ['Umido', 'Superumido'],
    ambiente_pedogenetico:
      'Ambientes arenosos pobres em bases, com drenagem variavel e frequente influencia de lencol freatico próximo.',
    material_origem: [
      'Depositos arenosos pobres em bases',
      'Areias quartzosas (areias brancas)',
      'Sedimentos costeiros/restingas',
    ],
    minerais_secundarios: [],
    profundidade_cm: '25->100',
    classe_profundidade: 'nao_classificado',
    estrutura: 'Fraca a ausente; podendo haver cimentacao no espodico',
    estrutura_tipo: 'Macica ou fraca',
    estrutura_grau: 'Muito fraco',
    estrutura_estabilidade: 'Baixa a moderada (com hardpan local)',
    estrutura_bt: null,
    consistencia_umida_bt: null,
    presenca_cerosidade: 'Não e criterio central',
    textura_argila_percentual: '<15',
    argila_ae_g_kg: '',
    argila_bt_g_kg: '',
    mudanca_textural_abrupta: null,
    densidade_solo_g_cm3: '',
    porosidade_descricao:
      'Retencao de agua muito baixa nos horizontes arenosos superiores; comportamento depende de lencol/ortstein.',
    infiltracao_agua_descricao:
      'Drenagem excessiva em perfis profundos arenosos, ou imperfeita quando ha lencol alto/cimentacao.',
    ctc_cmolc_kg: '',
    v_percentual: '<20',
    ph: '3.5-5.0',
    calcio_magnesio_status: 'Muito baixos',
    potassio_status: 'Muito baixo',
    fosforo_status: 'Extremamente baixo',
    materia_organica_percentual: '',
    aluminio_trocavel_status: 'Elevado',
    fertilidade_natural: 'Muito baixa',
    fertilidade_conceito_tecnico:
      'Fertilidade natural muito baixa por acidez elevada, alta atividade de Al e baixa CTC nos horizontes A/E (exceto concentracao organica no Bh).',
    limitacoes_agronomicas: [
      'Acidez extrema',
      'Toxidez por aluminio',
      'Baixissima retencao de agua',
      'Camadas cimentadas (ortstein)',
      'Baixa resposta economica a correcoes intensivas',
    ],
    manejo_recomendado: [
      'Priorizar conservacao ambiental',
      'Uso florestal adaptado quando viavel',
      'Evitar agricultura intensiva',
      'Correcao quimica apenas em sistemas altamente tecnificados e economicamente avaliados',
    ],
    culturas_tipicas: [
      'Uso agricola restrito',
      'Sistemas florestais adaptados',
    ],
    uso_agricola: 'Aptidao agronomica muito baixa',
    distribuicao: [
      'Faixa costeira do Norte e Nordeste',
      'Amazonia (areias brancas)',
      'Restingas e planicies costeiras',
    ],
    distribuicao_percentual_brasil: null,
    biomas_associados: ['Amazonia', 'Mata Atlantica (restingas)'],
    ambiente_relevo: ['Plano', 'Suave ondulado'],
    source: 'Embrapa - SiBCS',
    source_url: 'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil',
  },
  {
    id: 'planossolos-referencia-embrapa-v1',
    ordem: 'Planossolos',
    criterio_diagnostico: 'Presenca de horizonte B planico (Bpl)',
    criterio_distintivo:
      'Bpl adensado com baixa permeabilidade, mudanca textural abrupta e drenagem interna deficiente',
    subordens_disponiveis: [
      'Planossolos Haplicos',
      'Planossolos Natricos',
    ],
    campos_obrigatorios_recomendados: [
      'subordem',
      'profundidade_efetiva_cm',
      'classe_profundidade',
      'textura_ae',
      'textura_bpl',
      'densidade_bpl',
      'permeabilidade_bpl',
      'risco_lencol_suspenso',
      'na_trocavel',
      'esp_percentual',
      'ph_h2o',
      'v_percentual',
      'ctc_cmolc_kg',
    ],
    subordem: null,
    grande_grupo: null,
    subgrupo: null,
    horizonte_diagnostico: 'Bpl (B planico)',
    horizontes_sequencia: ['A', 'E', 'Bpl', 'C'],
    criterios_horizonte_diagnostico: [
      'Horizonte B com forte adensamento e baixa macroporosidade',
      'Permeabilidade muito lenta no Bpl',
      'Mudanca textural abrupta entre A/E e Bpl',
      'Drenagem interna deficiente e possibilidade de lencol suspenso',
      'Em planossolos natricos pode haver sodicidade elevada',
    ],
    processo_formacao: 'Adensamento subsuperficial com drenagem restrita',
    processos_dominantes: [
      'Eluviacao de argila nos horizontes superficiais',
      'Adensamento fisico no horizonte subsuperficial',
      'Sodificacao em parte dos perfis (natricos)',
    ],
    clima_formacao: ['Subumido', 'Semiarido', 'Tropical sazonal'],
    ambiente_pedogenetico:
      'Superficies planas ou suavemente onduladas, com alternancia de saturacao e secagem e materiais finos.',
    material_origem: [
      'Materiais finos sedimentares',
      'Depositos com tendencia a baixa drenagem vertical',
    ],
    minerais_secundarios: [],
    profundidade_cm: '25-100',
    classe_profundidade: 'nao_classificado',
    estrutura: 'Estrutura degradada, frequentemente macica ou em blocos muito densos no Bpl',
    estrutura_tipo: 'Macica ou blocos densos',
    estrutura_grau: 'Fraco a muito fraco',
    estrutura_estabilidade: 'Baixa',
    estrutura_bt: 'Bpl com alta densidade e baixa condutividade hidraulica',
    consistencia_umida_bt: 'Firme a muito firme',
    presenca_cerosidade: 'Não e criterio central',
    textura_argila_percentual: '',
    argila_ae_g_kg: '',
    argila_bt_g_kg: '',
    mudanca_textural_abrupta: {
      definicao_sibcs:
        'Mudanca textural abrupta associada ao comportamento planico e restricao hidrica.',
      fonte: 'SiBCS 2018 - Embrapa',
      criterio_ae_menor_200:
        'Usar relacao A/E e Bpl para confirmar contraste textural e risco de lencol suspenso.',
      criterio_ae_maior_igual_200:
        'Incrementos expressivos de argila no Bpl reforcam restricao fisica/hidrica.',
      distancia_vertical_max_cm: 7.5,
      campos_obrigatorios_recomendados: [
        'argila_AE_g_kg',
        'argila_Bpl_g_kg',
        'densidade_Bpl',
        'permeabilidade_Bpl',
      ],
    },
    densidade_solo_g_cm3: '',
    porosidade_descricao:
      'Baixa macroporosidade no Bpl com alta susceptibilidade a compactacao adicional.',
    infiltracao_agua_descricao:
      'Muito lenta no Bpl, com frequente encharcamento temporario acima do horizonte.',
    ctc_cmolc_kg: '',
    v_percentual: '',
    ph: '5.0-7.0',
    calcio_magnesio_status: 'Variavel',
    potassio_status: 'Variavel',
    fosforo_status: 'Variavel',
    materia_organica_percentual: '',
    aluminio_trocavel_status: 'Variavel',
    fertilidade_natural: 'Baixa a moderada (quimica secundaria frente a limitacao fisica)',
    fertilidade_conceito_tecnico:
      'A limitacao dominante e fisico-hidrica (Bpl), mesmo quando a fertilidade quimica e moderada.',
    limitacoes_agronomicas: [
      'Encharcamento',
      'Restricao radicular severa',
      'Compactacao',
      'Sodicidade em perfis natricos',
    ],
    manejo_recomendado: [
      'Drenagem superficial quando viavel',
      'Trafego controlado',
      'Evitar preparo profundo ineficaz',
      'Correcao de sodicidade com gesso agricola quando aplicavel',
      'Uso de culturas tolerantes a excesso de agua',
    ],
    culturas_tipicas: [
      'Pastagens adaptadas',
      'Arroz irrigado em ambientes adequados',
    ],
    uso_agricola: 'Aptidao baixa a moderada, dependente de manejo especifico',
    distribuicao: [
      'Sul do Brasil (RS)',
      'Centro-Oeste',
      'Nordeste semiarido',
      'Areas planas mal drenadas',
    ],
    distribuicao_percentual_brasil: null,
    biomas_associados: ['Pampa', 'Cerrado', 'Caatinga'],
    ambiente_relevo: ['Plano', 'Suave ondulado'],
    source: 'Embrapa - SiBCS',
    source_url: 'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil',
  },
  {
    id: 'plintossolos-referencia-embrapa-v1',
    ordem: 'Plintossolos',
    criterio_diagnostico: 'Presenca de plintita e/ou petroplintita',
    criterio_distintivo:
      'Solo condicionado por hidromorfismo periodico, com segregacao de ferro e possível endurecimento irreversivel da plintita',
    subordens_disponiveis: [
      'Plintossolos Haplicos',
      'Plintossolos Argiluvicos',
      'Plintossolos Petricos',
    ],
    campos_obrigatorios_recomendados: [
      'subordem',
      'tipo_plintita',
      'continuidade_plintita',
      'profundidade_efetiva_cm',
      'classe_profundidade',
      'drenagem_interna',
      'risco_endurecimento_irreversivel',
      'ph_h2o',
      'v_percentual',
      'ctc_cmolc_kg',
      'fosforo_disponivel',
    ],
    subordem: null,
    grande_grupo: null,
    subgrupo: null,
    horizonte_diagnostico: 'Horizonte plintico (plintita/petroplintita)',
    horizontes_sequencia: ['A', 'Horizonte plintico', 'Bt (opcional)', 'C'],
    criterios_horizonte_diagnostico: [
      'Plintita: concentracoes ferruginosas maleaveis quando umidas',
      'Petroplintita: forma endurecida e continua, com impedimento fisico permanente',
      'Condicoes de hidromorfismo periodico com alternancia reducao-oxidacao',
      'Possibilidade de endurecimento irreversivel apos ciclos de secagem',
    ],
    processo_formacao: 'Hidromorfismo periodico com segregacao e concentracao de ferro',
    processos_dominantes: [
      'Mobilizacao de Fe2+ em condicoes redutoras',
      'Precipitacao de Fe3+ na reoxidacao',
      'Concentracao progressiva de ferro em nodulos e massas',
      'Endurecimento de plintita em ciclos de secagem',
    ],
    clima_formacao: ['Tropical umido', 'Tropical sazonal'],
    ambiente_pedogenetico:
      'Relevos planos a suave ondulados, com flutuacao de lencol freatico e materiais de origem ricos em ferro.',
    material_origem: [
      'Materiais de origem ricos em ferro',
      'Sedimentos finos com drenagem imperfeita',
    ],
    minerais_secundarios: ['Oxidos de ferro'],
    profundidade_cm: '25-100',
    classe_profundidade: 'nao_classificado',
    estrutura: 'Fraca a moderada, com massas ferruginosas disruptivas',
    estrutura_tipo: 'Blocos fracos a moderados',
    estrutura_grau: 'Fraco a moderado',
    estrutura_estabilidade: 'Baixa a media',
    estrutura_bt: 'Pode ocorrer Bt em subordens argiluvicas',
    consistencia_umida_bt: 'Variavel conforme teor de argila e umidade',
    presenca_cerosidade: 'Pode ocorrer em perfis com Bt',
    textura_argila_percentual: '',
    argila_ae_g_kg: '',
    argila_bt_g_kg: '',
    mudanca_textural_abrupta: null,
    densidade_solo_g_cm3: '',
    porosidade_descricao:
      'Restricao por plintita/petroplintita e baixa continuidade de poros em zonas endurecidas.',
    infiltracao_agua_descricao:
      'Drenagem imperfeita a pobre, com saturacao periodica e risco de encharcamento.',
    ctc_cmolc_kg: '',
    v_percentual: '<50',
    ph: '4.5-6.0',
    calcio_magnesio_status: 'Baixos',
    potassio_status: 'Baixo',
    fosforo_status: 'Muito baixo (fixacao por Fe)',
    materia_organica_percentual: '',
    aluminio_trocavel_status: 'Frequente',
    fertilidade_natural: 'Baixa',
    fertilidade_conceito_tecnico:
      'Limitacao quimica (acidez e baixa disponibilidade de nutrientes) somada a limitacao fisica por plintita/petroplintita e hidromorfismo.',
    limitacoes_agronomicas: [
      'Encharcamento periodico',
      'Impedimento fisico por plintita/petroplintita',
      'Endurecimento irreversivel da plintita',
      'Baixa profundidade efetiva',
      'Fixacao de fosforo',
    ],
    manejo_recomendado: [
      'Evitar drenagens agressivas que acelerem endurecimento',
      'Uso de culturas tolerantes a umidade',
      'Manutencao de cobertura do solo',
      'Correcao quimica com cautela e base analitica',
      'Planejamento de uso em longo prazo',
    ],
    culturas_tipicas: [
      'Pastagens extensivas',
      'Sistemas agroflorestais adaptados',
    ],
    uso_agricola: 'Aptidao agronomica baixa',
    distribuicao: [
      'Amazonia',
      'Centro-Oeste',
      'Norte de Minas Gerais',
      'Transicao Cerrado-Amazonia',
    ],
    distribuicao_percentual_brasil: null,
    biomas_associados: ['Amazonia', 'Cerrado'],
    ambiente_relevo: ['Plano', 'Suave ondulado'],
    source: 'Embrapa - SiBCS',
    source_url: 'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil',
  },
  {
    id: 'gleissolos-referencia-embrapa-v1',
    ordem: 'Gleissolos',
    criterio_diagnostico: 'Presenca de horizonte glei (Bg/Cg) sob saturacao hidrica',
    criterio_distintivo:
      'Hidromorfia periodica ou permanente com condicoes redutoras e cores acinzentadas/azuladas',
    subordens_disponiveis: [
      'Gleissolos Haplicos',
      'Gleissolos Melanicos',
      'Gleissolos Salicos',
      'Gleissolos Tiomorficos',
    ],
    campos_obrigatorios_recomendados: [
      'subordem',
      'duracao_saturacao',
      'profundidade_morfologica_cm',
      'profundidade_efetiva_radicular_cm',
      'classe_profundidade',
      'drenagem_interna',
      'ph_h2o',
      'v_percentual',
      'ctc_cmolc_kg',
      'teor_fe2_mn2',
      'risco_tiomorfismo',
    ],
    subordem: null,
    grande_grupo: null,
    subgrupo: null,
    horizonte_diagnostico: 'Bg / Cg (horizonte glei)',
    horizontes_sequencia: ['A', 'Bg', 'Cg'],
    criterios_horizonte_diagnostico: [
      'Matriz com croma <= 2 e cores acinzentadas/azuladas/esverdeadas',
      'Mosqueados ferruginosos por reoxidacao parcial',
      'Estrutura fraca a macica',
      'Saturacao hidrica prolongada com ambiente redutor',
    ],
    processo_formacao: 'Gleizacao por saturacao hidrica prolongada',
    processos_dominantes: [
      'Reducao de Fe3+ para Fe2+ sob baixa disponibilidade de O2',
      'Mobilizacao de ferro e manganes em ambiente redutor',
      'Reoxidacao parcial com formacao de mosqueados',
    ],
    clima_formacao: ['Umido', 'Subumido', 'Tropical sazonal'],
    ambiente_pedogenetico:
      'Planicies aluviais, varzeas, baixadas mal drenadas e areas com lencol freatico alto.',
    material_origem: [
      'Sedimentos aluviais recentes',
      'Materiais finos de baixada',
      'Depositos com drenagem deficiente',
    ],
    minerais_secundarios: [],
    profundidade_cm: '>100',
    classe_profundidade: 'nao_classificado',
    estrutura: 'Fraca a macica, altamente sensivel a compactacao em condicao umida',
    estrutura_tipo: 'Fraca ou macica',
    estrutura_grau: 'Fraco',
    estrutura_estabilidade: 'Baixa',
    estrutura_bt: null,
    consistencia_umida_bt: null,
    presenca_cerosidade: null,
    textura_argila_percentual: '',
    argila_ae_g_kg: '',
    argila_bt_g_kg: '',
    mudanca_textural_abrupta: null,
    densidade_solo_g_cm3: '',
    porosidade_descricao:
      'Macroporosidade reduzida sob saturacao prolongada, com limitacao de aeracao radicular.',
    infiltracao_agua_descricao:
      'Drenagem muito pobre, com saturacao quase continua e baixa janela operacional.',
    ctc_cmolc_kg: '',
    v_percentual: '',
    ph: '4.5-6.5',
    calcio_magnesio_status: 'Variavel',
    potassio_status: 'Variavel',
    fosforo_status: 'Variavel',
    materia_organica_percentual: '',
    aluminio_trocavel_status: 'Variavel',
    fertilidade_natural: 'Variavel (limitacao principal e hidrica/redox)',
    fertilidade_conceito_tecnico:
      'Aptidao depende do regime hidrico: risco de anoxia, toxidez por Fe/Mn e restricao de mecanizacao dominam o manejo.',
    limitacoes_agronomicas: [
      'Anoxia radicular',
      'Toxidez por Fe e Mn',
      'Saturacao permanente ou periodica',
      'Janela curta de mecanizacao',
      'Risco ambiental elevado em drenagem inadequada',
    ],
    manejo_recomendado: [
      'Manejo compativel com regime hidrico local',
      'Drenagem controlada quando viavel',
      'Evitar drenagem de perfis tiomorficos',
      'Culturas tolerantes a saturacao',
      'Restringir trafego em solo umido',
    ],
    culturas_tipicas: [
      'Arroz irrigado',
      'Sistemas adaptados a encharcamento',
      'Uso aquiicola e agroecossistemas umidos',
    ],
    uso_agricola: 'Alta aptidao apenas para sistemas adaptados a inundacao',
    distribuicao: [
      'Varzeas amazonicas',
      'Planicies do Pantanal',
      'Baixadas costeiras',
      'Fundos de vale em todo o pais',
    ],
    distribuicao_percentual_brasil: null,
    biomas_associados: ['Amazonia', 'Pantanal', 'Mata Atlantica (baixadas)', 'Cerrado (veredas)'],
    ambiente_relevo: ['Plano', 'Suave ondulado'],
    source: 'Embrapa - SiBCS',
    source_url: 'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil',
  },
  {
    id: 'organossolos-referencia-embrapa-v1',
    ordem: 'Organossolos',
    criterio_diagnostico: 'Presenca de horizonte histico (O) com predominancia organica',
    criterio_distintivo:
      'Acumulo de material organico sob saturacao hidrica prolongada e baixa decomposicao',
    subordens_disponiveis: [
      'Organossolos Fibricos',
      'Organossolos Hemicos',
      'Organossolos Sapricos',
    ],
    campos_obrigatorios_recomendados: [
      'subordem',
      'grau_decomposicao_mo',
      'espessura_horizonte_histico_cm',
      'profundidade_efetiva_cm',
      'classe_profundidade',
      'densidade_aparente_g_cm3',
      'regime_hidrico',
      'ph_h2o',
      'ctc_cmolc_kg',
      'v_percentual',
      'risco_subsidencia',
    ],
    subordem: null,
    grande_grupo: null,
    subgrupo: null,
    horizonte_diagnostico: 'Horizonte histico (O)',
    horizontes_sequencia: ['O (histico)', 'Cg ou mineral subjacente (opcional)'],
    criterios_horizonte_diagnostico: [
      'Espessura do horizonte histico >= 40 cm (ou >= 20 cm em condicoes especificas)',
      'Carbono organico muito elevado com predominancia de material organico',
      'Estrutura fibrosa, amorfa ou muito fraca',
      'Baixa densidade aparente',
    ],
    processo_formacao: 'Acumulo de materia organica sob saturacao hidrica',
    processos_dominantes: [
      'Acumulo de residuos vegetais',
      'Decomposicao lenta por anoxia',
      'Preservacao de carbono por lencol freatico alto',
    ],
    clima_formacao: ['Umido', 'Frio umido local', 'Tropical umido'],
    ambiente_pedogenetico:
      'Brejos, turfeiras, varzeas permanentes, baixadas costeiras e fundos de vale mal drenados.',
    material_origem: [
      'Residuos vegetais acumulados',
      'Depositos organicos hidromorficos',
    ],
    minerais_secundarios: [],
    profundidade_cm: '20-100',
    classe_profundidade: 'nao_classificado',
    estrutura: 'Fibrosa a amorfa, com baixa resistencia mecanica',
    estrutura_tipo: 'Fibrosa ou amorfa',
    estrutura_grau: 'Muito fraco',
    estrutura_estabilidade: 'Baixa apos drenagem',
    estrutura_bt: null,
    consistencia_umida_bt: null,
    presenca_cerosidade: null,
    textura_argila_percentual: '',
    argila_ae_g_kg: '',
    argila_bt_g_kg: '',
    mudanca_textural_abrupta: null,
    densidade_solo_g_cm3: '<0.5',
    porosidade_descricao:
      'Alta porosidade total com baixa sustentacao mecanica e risco de colapso apos drenagem.',
    infiltracao_agua_descricao:
      'Alta retencao de agua, drenagem naturalmente deficiente e forte dependencia do manejo hidrico.',
    ctc_cmolc_kg: '',
    v_percentual: '',
    ph: '3.5-5.5',
    calcio_magnesio_status: 'Geralmente baixos',
    potassio_status: 'Geralmente baixo',
    fosforo_status: 'Baixo a medio',
    materia_organica_percentual: '',
    aluminio_trocavel_status: 'Variavel',
    fertilidade_natural: 'Restrita e altamente dependente do manejo hidrico e nutricional',
    fertilidade_conceito_tecnico:
      'CTC elevada por materia organica, mas com acidez, subsidencia potencial e dinamica de nutrientes dependente de mineralizacao.',
    limitacoes_agronomicas: [
      'Subsidencia apos drenagem',
      'Acidificacao intensa',
      'Instabilidade fisica',
      'Risco ambiental elevado',
      'Baixa capacidade de suporte para mecanizacao pesada',
    ],
    manejo_recomendado: [
      'Drenagem controlada e minima',
      'Monitoramento de subsidencia',
      'Calagem criteriosa',
      'Evitar mecanizacao pesada',
      'Uso preferencial conservacionista',
    ],
    culturas_tipicas: [
      'Hortalicas em sistemas altamente manejados',
      'Culturas adaptadas a solos organicos',
    ],
    uso_agricola: 'Aptidao restrita e altamente dependente de manejo especializado',
    distribuicao: [
      'Baixadas costeiras',
      'Regioes serranas umidas',
      'Varzeas amazonicas',
      'Brejos do Sul e Sudeste',
    ],
    distribuicao_percentual_brasil: null,
    biomas_associados: ['Amazonia', 'Mata Atlantica', 'Campos Sulinos'],
    ambiente_relevo: ['Plano', 'Baixada', 'Fundo de vale'],
    source: 'Embrapa - SiBCS',
    source_url: 'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil',
  },
  {
    id: 'vertissolos-referencia-embrapa-v1',
    ordem: 'Vertissolos',
    criterio_diagnostico: 'Presenca de carater vertico com argilas expansivas',
    criterio_distintivo:
      'Dinamica de contracao-expansao com fendas estacionais e superficies de friccao (slickensides)',
    subordens_disponiveis: [
      'Vertissolos Haplicos',
      'Vertissolos Ebanicos',
      'Vertissolos Hidromorficos',
    ],
    campos_obrigatorios_recomendados: [
      'subordem',
      'argila_g_kg',
      'presenca_fendas_estacionais',
      'largura_fenda_cm',
      'profundidade_fenda_cm',
      'slickensides',
      'profundidade_morfologica_cm',
      'profundidade_efetiva_radicular_cm',
      'ph_h2o',
      'ctc_cmolc_kg',
      'v_percentual',
    ],
    subordem: null,
    grande_grupo: null,
    subgrupo: null,
    horizonte_diagnostico: 'Carater vertico (Bv/Bn com dinamica vertica)',
    horizontes_sequencia: ['A', 'B vertico (Bv/Bn)', 'C'],
    criterios_horizonte_diagnostico: [
      'Argila >= 300 g/kg em grande parte do perfil',
      'Fendas estacionais com largura >= 1 cm e profundidade >= 50 cm na estacao seca',
      'Slickensides presentes',
      'Estrutura em blocos grandes a prismas',
      'Autoturbacao com mistura vertical de horizontes',
    ],
    processo_formacao: 'Intemperismo moderado com formacao de argilas expansivas',
    processos_dominantes: [
      'Expansao e contracao ciclica de argilas esmectiticas',
      'Intemperismo quimico moderado',
      'Alternancia de periodos secos e umidos',
    ],
    clima_formacao: ['Semiarido', 'Tropical sazonal'],
    ambiente_pedogenetico:
      'Relevos planos a suavemente ondulados, materiais ricos em Ca e Mg e drenagem imperfeita a moderada.',
    material_origem: [
      'Materiais ricos em Ca e Mg',
      'Sedimentos finos expansivos',
    ],
    minerais_secundarios: ['Esmectitas'],
    profundidade_cm: '100-200',
    classe_profundidade: 'nao_classificado',
    estrutura: 'Blocos grandes a prismas, com forte variacao sazonal de consistencia',
    estrutura_tipo: 'Blocos grandes ou prismatica',
    estrutura_grau: 'Moderado a forte',
    estrutura_estabilidade: 'Variavel (alta movimentacao sazonal)',
    estrutura_bt: 'Horizonte vertico com slickensides e blocos coesos',
    consistencia_umida_bt: 'Muito plastica e pegajosa quando umido, muito dura quando seca',
    presenca_cerosidade: 'Não e criterio principal',
    textura_argila_percentual: '30-80',
    argila_ae_g_kg: '',
    argila_bt_g_kg: '',
    mudanca_textural_abrupta: null,
    densidade_solo_g_cm3: '',
    porosidade_descricao:
      'Porosidade dinamica afetada por contracao-expansao; macroporos sazonais em periodos secos.',
    infiltracao_agua_descricao:
      'Infiltracao lenta quando umido, drenagem interna imperfeita e alta retencao hidrica com disponibilidade variavel.',
    ctc_cmolc_kg: '',
    v_percentual: '>=50',
    ph: '6.0-8.0',
    calcio_magnesio_status: 'Altos',
    potassio_status: 'Medio a alto',
    fosforo_status: 'Baixo a medio',
    materia_organica_percentual: '',
    aluminio_trocavel_status: 'Geralmente ausente',
    fertilidade_natural: 'Alta quimicamente, limitada por dinamica fisica',
    fertilidade_conceito_tecnico:
      'Solos com alta CTC e saturacao por bases, mas com forte restricao operacional por trabalhabilidade e movimento estrutural sazonal.',
    limitacoes_agronomicas: [
      'Trabalhabilidade restrita',
      'Movimento do solo',
      'Drenagem imperfeita',
      'Janela curta de preparo e mecanizacao',
      'Risco de compactacao estrutural',
    ],
    manejo_recomendado: [
      'Operacoes apenas em umidade ideal',
      'Trafego rigorosamente controlado',
      'Sistemas de cultivo adaptados',
      'Drenagem superficial quando necessario',
      'Evitar culturas sensiveis a movimentacao do solo',
    ],
    culturas_tipicas: [
      'Culturas adaptadas a vertissolos',
      'Sistemas com manejo conservacionista e janela operacional curta',
    ],
    uso_agricola: 'Alta aptidao quimica com limitacao fisica relevante',
    distribuicao: [
      'Nordeste semiarido',
      'Norte de Minas Gerais',
      'Pantanal',
      'Centro-Oeste',
    ],
    distribuicao_percentual_brasil: null,
    biomas_associados: ['Caatinga', 'Cerrado', 'Pantanal'],
    ambiente_relevo: ['Plano', 'Suave ondulado'],
    source: 'Embrapa - SiBCS',
    source_url: 'https://www.embrapa.br/tema-solos-brasileiros/solos-do-brasil',
  },
];

const DEFAULT_SOIL_TECHNICAL_PROFILES: SoilTechnicalProfile[] =
  DEFAULT_SOIL_TECHNICAL_PROFILES_RAW.map((row) => {
    const profundidade = parseRange(row.profundidade_cm);
    return {
      id: row.id,
      ordem: row.ordem,
      criterio_diagnostico: row.criterio_diagnostico,
      criterio_distintivo: row.criterio_distintivo,
      subordens_disponiveis: row.subordens_disponiveis,
      campos_obrigatorios_recomendados: row.campos_obrigatorios_recomendados,
      subordem: row.subordem,
      grande_grupo: row.grande_grupo,
      subgrupo: row.subgrupo,
      horizonte_diagnostico: row.horizonte_diagnostico,
      horizontes_sequencia: row.horizontes_sequencia,
      criterios_horizonte_diagnostico: row.criterios_horizonte_diagnostico,
      processo_formacao: row.processo_formacao,
      processos_dominantes: row.processos_dominantes,
      clima_formacao: row.clima_formacao,
      ambiente_pedogenetico: row.ambiente_pedogenetico,
      material_origem: row.material_origem,
      minerais_secundarios: row.minerais_secundarios,
      profundidade_cm: profundidade,
      classe_profundidade: row.classe_profundidade ?? deriveDepthClass(profundidade),
      estrutura: row.estrutura,
      estrutura_tipo: row.estrutura_tipo,
      estrutura_grau: row.estrutura_grau,
      estrutura_estabilidade: row.estrutura_estabilidade,
      estrutura_bt: row.estrutura_bt,
      consistencia_umida_bt: row.consistencia_umida_bt,
      presenca_cerosidade: row.presenca_cerosidade,
      textura_argila_percentual: parseRange(row.textura_argila_percentual),
      argila_ae_g_kg: parseRange(row.argila_ae_g_kg),
      argila_bt_g_kg: parseRange(row.argila_bt_g_kg),
      mudanca_textural_abrupta: row.mudanca_textural_abrupta,
      densidade_solo_g_cm3: parseRange(row.densidade_solo_g_cm3),
      porosidade_descricao: row.porosidade_descricao,
      infiltracao_agua_descricao: row.infiltracao_agua_descricao,
      ctc_cmolc_kg: parseRange(row.ctc_cmolc_kg),
      v_percentual: parseRange(row.v_percentual),
      ph: parseRange(row.ph),
      calcio_magnesio_status: row.calcio_magnesio_status,
      potassio_status: row.potassio_status,
      fosforo_status: row.fosforo_status,
      materia_organica_percentual: parseRange(row.materia_organica_percentual),
      aluminio_trocavel_status: row.aluminio_trocavel_status,
      fertilidade_natural: row.fertilidade_natural,
      fertilidade_conceito_tecnico: row.fertilidade_conceito_tecnico,
      limitacoes_agronomicas: row.limitacoes_agronomicas,
      manejo_recomendado: row.manejo_recomendado,
      culturas_tipicas: row.culturas_tipicas,
      uso_agricola: row.uso_agricola,
      distribuicao: row.distribuicao,
      distribuicao_percentual_brasil: row.distribuicao_percentual_brasil,
      biomas_associados: row.biomas_associados,
      ambiente_relevo: row.ambiente_relevo,
      source: row.source,
      source_url: row.source_url,
    };
  });

export function listDefaultSoilTechnicalProfiles(): SoilTechnicalProfile[] {
  return [...DEFAULT_SOIL_TECHNICAL_PROFILES];
}

export function findDefaultSoilTechnicalProfileByOrder(
  ordem: string | null | undefined,
): SoilTechnicalProfile | null {
  const needle = (ordem ?? '').trim().toLowerCase();
  if (!needle) return null;
  return (
    DEFAULT_SOIL_TECHNICAL_PROFILES.find(
      (item) => item.ordem.trim().toLowerCase() === needle,
    ) ?? null
  );
}
