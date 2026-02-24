/**
 * Módulo Talhao — barrel exports
 */

// Tipos
export type {
  DrawMode,
  CultureModalMode,
  SelectedVertex,
  CultureEntry,
} from './types';

// Constantes
export {
  UNCLASSIFIED_SOIL_VALUE,
  UNCLASSIFIED_SOIL_LABEL,
  DEFAULT_SOIL_LINKED_COLOR,
  SOIL_COLOR_BY_ORDER,
} from './constants';

// Geometria
export {
  flattenPoints,
  polygonBounds,
  midpoint,
  isPointOnSegment,
  isPointInsidePolygon,
  signedArea2,
  isProperSegmentIntersection,
  isSegmentInsidePolygon,
  isPolygonInsidePolygon,
  geoPointToCanvasPoint,
} from './utils/geometry';

// Formatters
export {
  normalizeMonthYear,
  monthYearOrder,
  formatMonthYear,
  normalizeKey,
  isUnclassifiedSoilValue,
  resolveSoilLinkedColor,
  normalizeGeoLayerId,
} from './utils/formatters';

// Hooks
export { useTalhaoDrawing } from './hooks/useTalhaoDrawing';
export { useTalhaoCultures } from './hooks/useTalhaoCultures';
export { useTalhaoMapBackground } from './hooks/useTalhaoMapBackground';
