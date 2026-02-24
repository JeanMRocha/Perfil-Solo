/**
 * Constantes do módulo Talhão.
 *
 * Valores fixos de configuração, labels e paleta de cores de solo
 * usados em vários componentes e hooks do domínio.
 */

export const UNCLASSIFIED_SOIL_VALUE = '__nao_classificado__';
export const UNCLASSIFIED_SOIL_LABEL = 'Não classificado';
export const DEFAULT_SOIL_LINKED_COLOR = '#81C784';

/** Cor padrão de cada ordem taxonômica SiBCS */
export const SOIL_COLOR_BY_ORDER: Record<string, string> = {
  argissolos: '#B45309',
  cambissolos: '#A16207',
  chernossolos: '#78350F',
  espodossolos: '#475569',
  gleissolos: '#0EA5A4',
  latossolos: '#7C3AED',
  luvissolos: '#D97706',
  neossolos: '#6B7280',
  nitossolos: '#16A34A',
  organossolos: '#166534',
  planossolos: '#2563EB',
  plintossolos: '#B91C1C',
  vertissolos: '#4F46E5',
};
