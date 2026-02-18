// src/types/soil.ts
// src/types/soil.ts

export type NutrientKey =
  | 'pH'
  | 'N'
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
  | 'Zn'
  | 'Na'
  | 'Al'
  | 'H+Al'
  | 'SB'
  | 'CTC'
  | 'V%'
  | 'm%'
  | 'Argila';

export type UnitType = 'cmolc/dm³' | 'mg/dm³' | '%' | 'mmolc/dm³' | 'g/kg' | 'dm³';

export interface SoilNutrient {
  value: number;
  unit: UnitType;
  extractor?: string;
  original_value?: number;
  original_unit?: UnitType;
}

export type Range = [number, number];
export type RangeMap = Partial<Record<NutrientKey, Range>>;

export interface ModuleExecution {
  module_name: 'calagem' | 'gessagem' | 'adubacao';
  status: 'pending' | 'completed' | 'error';
  inputs_normalized: Record<string, any>;
  outputs: Record<string, any>;
  explain_steps: string[];
  ruleset_version: string; // "congelamento" da regra
  references: string;
  warnings: string[];
}

export interface AnalysisAlert {
  type: 'pedological' | 'unit_suspect' | 'missing_critical' | 'consistency';
  message: string;
  severity: 'low' | 'medium' | 'high';
  field?: NutrientKey;
}

export interface AnalysisContainer {
  id: string;
  user_id: string;
  property_id: string;
  talhao_id: string;
  data_amostragem: string;
  profundidade: '0-10' | '0-20' | '20-40' | 'outra';
  laboratorio?: string;
  
  // 1) Resultados como vieram do laudo
  raw: Record<string, SoilNutrient>;
  
  // 2) Resultados convertidos para padrão do motor
  normalized: Record<string, SoilNutrient>;
  
  // 3) Histórico de execução dos módulos
  executions: Partial<Record<string, ModuleExecution>>;
  
  // 4) Alertas de inconsistência
  alerts: AnalysisAlert[];
  
  created_at: string;
  updated_at: string;
  ruleset_frozen: boolean;
}

export interface SoilParams {
  id?: string | number;
  cultura: string;
  genero?: string;
  especie?: string;
  cultivar?: string;
  variedade?: string | null;
  estado?: string | null;
  cidade?: string | null;
  extrator?: string | null;
  estagio?: string | null;
  idade_meses?: number | null;
  ideal: RangeMap;
  ruleset_version?: string;
  fonte?: string | null;
  observacoes?: string | null;
  updated_at?: string | null;
}
