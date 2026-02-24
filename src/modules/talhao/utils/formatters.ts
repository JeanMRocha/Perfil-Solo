/**
 * Funções de formatação e normalização — lógica pura, sem dependência de React.
 *
 * Lidam com datas mês/ano, chaves normalizadas e resolução de cores de solo.
 */

import {
  UNCLASSIFIED_SOIL_VALUE,
  UNCLASSIFIED_SOIL_LABEL,
  DEFAULT_SOIL_LINKED_COLOR,
  SOIL_COLOR_BY_ORDER,
} from '../constants';
import type { GeoLayerId } from '../../../modules/geo/baseLayers';

// ---------------------------------------------------------------------------
// Month / Year
// ---------------------------------------------------------------------------

export function normalizeMonthYear(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const isoMatch = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    if (year >= 1900 && month >= 1 && month <= 12) {
      return `${isoMatch[1]}-${isoMatch[2]}`;
    }
  }

  const brMatch = raw.match(/^(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const month = Number(brMatch[1]);
    const year = Number(brMatch[2]);
    if (year >= 1900 && month >= 1 && month <= 12) {
      return `${brMatch[2]}-${brMatch[1]}`;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  if (year < 1900 || month < 1 || month > 12) return '';
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`;
}

export function monthYearOrder(value?: string | null): number {
  const normalized = normalizeMonthYear(value);
  if (!normalized) return Number.NaN;
  const [yearText, monthText] = normalized.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return Number.NaN;
  return year * 12 + month;
}

export function formatMonthYear(value?: string | null): string {
  const normalized = normalizeMonthYear(value);
  if (!normalized) return '-';
  const [year, month] = normalized.split('-');
  return `${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Chaves / Strings
// ---------------------------------------------------------------------------

export function normalizeKey(value?: string | null): string {
  return (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ---------------------------------------------------------------------------
// Solo
// ---------------------------------------------------------------------------

export function isUnclassifiedSoilValue(value?: string | null): boolean {
  const normalized = normalizeKey(value);
  return (
    normalized === normalizeKey(UNCLASSIFIED_SOIL_VALUE) ||
    normalized === normalizeKey(UNCLASSIFIED_SOIL_LABEL)
  );
}

export function resolveSoilLinkedColor(
  soilValue?: string | null,
  fallback?: string | null,
): string {
  const normalized = normalizeKey(soilValue);
  if (normalized && SOIL_COLOR_BY_ORDER[normalized])
    return SOIL_COLOR_BY_ORDER[normalized];
  return (fallback && fallback.trim()) || DEFAULT_SOIL_LINKED_COLOR;
}

// ---------------------------------------------------------------------------
// Geo
// ---------------------------------------------------------------------------

export function normalizeGeoLayerId(value?: string | null): GeoLayerId {
  if (value === 'streets' || value === 'topographic' || value === 'satellite') {
    return value;
  }
  return 'satellite';
}
