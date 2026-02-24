/**
 * Funções de geometria 2D — lógica pura, sem dependência de React.
 *
 * Todas operam sobre o tipo MapPoint { x, y } importado de propertyMapService.
 */

import type { MapPoint } from '../../../services/propertyMapService';

// ---------------------------------------------------------------------------
// Flatten / Bounds
// ---------------------------------------------------------------------------

/** Converte lista de pontos em array flat [x0, y0, x1, y1, ...] para Konva. */
export function flattenPoints(points: MapPoint[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}

/** Retorna bounding-box de um polígono. */
export function polygonBounds(points: MapPoint[]) {
  if (!points.length) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  return points.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y),
    }),
    {
      minX: points[0].x,
      maxX: points[0].x,
      minY: points[0].y,
      maxY: points[0].y,
    },
  );
}

// ---------------------------------------------------------------------------
// Ponto médio
// ---------------------------------------------------------------------------

export function midpoint(start: MapPoint, end: MapPoint): MapPoint {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

// ---------------------------------------------------------------------------
// Point/Segment/Polygon checks
// ---------------------------------------------------------------------------

export function isPointOnSegment(
  point: MapPoint,
  start: MapPoint,
  end: MapPoint,
): boolean {
  const cross =
    (point.y - start.y) * (end.x - start.x) -
    (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > 0.5) return false;

  const dot =
    (point.x - start.x) * (end.x - start.x) +
    (point.y - start.y) * (end.y - start.y);
  if (dot < 0) return false;

  const squaredLength =
    (end.x - start.x) * (end.x - start.x) +
    (end.y - start.y) * (end.y - start.y);
  return dot <= squaredLength;
}

export function isPointInsidePolygon(
  point: MapPoint,
  polygon: MapPoint[],
): boolean {
  if (polygon.length < 3) return false;

  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (isPointOnSegment(point, a, b)) return true;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function signedArea2(a: MapPoint, b: MapPoint, c: MapPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

export function isProperSegmentIntersection(
  a1: MapPoint,
  a2: MapPoint,
  b1: MapPoint,
  b2: MapPoint,
): boolean {
  const o1 = signedArea2(a1, a2, b1);
  const o2 = signedArea2(a1, a2, b2);
  const o3 = signedArea2(b1, b2, a1);
  const o4 = signedArea2(b1, b2, a2);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function isSegmentInsidePolygon(
  start: MapPoint,
  end: MapPoint,
  polygon: MapPoint[],
): boolean {
  if (polygon.length < 3) return false;
  if (
    !isPointInsidePolygon(start, polygon) ||
    !isPointInsidePolygon(end, polygon)
  ) {
    return false;
  }
  if (!isPointInsidePolygon(midpoint(start, end), polygon)) return false;

  for (let i = 0; i < polygon.length; i += 1) {
    const edgeA = polygon[i];
    const edgeB = polygon[(i + 1) % polygon.length];
    if (isProperSegmentIntersection(start, end, edgeA, edgeB)) {
      return false;
    }
  }
  return true;
}

export function isPolygonInsidePolygon(
  inner: MapPoint[],
  outer: MapPoint[],
): boolean {
  if (inner.length < 3 || outer.length < 3) return false;

  if (!inner.every((point) => isPointInsidePolygon(point, outer))) return false;

  for (let i = 0; i < inner.length; i += 1) {
    const innerA = inner[i];
    const innerB = inner[(i + 1) % inner.length];

    // Em polígonos côncavos, dois pontos internos podem formar aresta externa.
    // Validamos um ponto no meio da aresta para garantir que o segmento permaneceu dentro.
    if (!isSegmentInsidePolygon(innerA, innerB, outer)) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Projeção Geo → Canvas
// ---------------------------------------------------------------------------

import type { GeoPoint } from '../../../services/mapBackgroundService';
import { CRS, latLng } from 'leaflet';

export function geoPointToCanvasPoint(
  geoPoint: GeoPoint,
  viewCenter: GeoPoint,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
): MapPoint {
  const centerProjected = CRS.EPSG3857.latLngToPoint(
    latLng(viewCenter.lat, viewCenter.lon),
    zoom,
  );
  const targetProjected = CRS.EPSG3857.latLngToPoint(
    latLng(geoPoint.lat, geoPoint.lon),
    zoom,
  );

  return {
    x: targetProjected.x - centerProjected.x + canvasWidth / 2,
    y: targetProjected.y - centerProjected.y + canvasHeight / 2,
  };
}
