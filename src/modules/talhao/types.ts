/**
 * Tipos compartilhados do módulo Talhão.
 *
 * Centraliza todos os tipos que antes estavam definidos inline
 * dentro de TalhaoDetailModal.tsx.
 */

export type DrawMode = 'none' | 'main' | 'zone';

export type CultureModalMode = 'edit';

export type SelectedVertex =
  | { kind: 'main'; pointIndex: number }
  | { kind: 'zone'; zoneIndex: number; pointIndex: number };

export interface CultureEntry {
  cultura: string;
  cultivar?: string;
  especie_nome_comum?: string;
  especie_nome_cientifico?: string;
  grupo_especie?: string;
  rnc_detail_url?: string;
  technical_profile_id?: string;
  technical_priority?: 'species' | 'cultivar';
  data_inicio: string;
  data_fim: string;
  fonte?: string;
}
