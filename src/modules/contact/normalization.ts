import type { ContactInfo } from '../../types/contact';
import type { CanonicalContactPoint, ContactPointKind } from './types';

function toText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeWebsite(value: string): string {
  const trimmed = toText(value);
  if (!trimmed) return '';
  return trimmed.replace(/\s+/g, '');
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizedValue(kind: ContactPointKind, value: string): string {
  if (kind === 'phone') return normalizePhone(value);
  return value.toLowerCase();
}

function sanitizePoint(
  point: CanonicalContactPoint,
): CanonicalContactPoint | null {
  const kind = point.kind;
  const valueRaw = toText(point.value);
  const value =
    kind === 'website' ? normalizeWebsite(valueRaw) : valueRaw;
  if (!value) return null;

  const network = toText(point.network);
  if (kind === 'social' && !network) return null;

  const normalized = normalizedValue(kind, value);
  if (!normalized) return null;

  return {
    id: toText(point.id) || undefined,
    label: toText(point.label) || undefined,
    kind,
    network: kind === 'social' ? network : undefined,
    value,
    valueNormalized: normalized,
    isPrimary: Boolean(point.isPrimary),
    metadata: point.metadata ?? undefined,
  };
}

function dedupePoints(
  points: CanonicalContactPoint[],
): CanonicalContactPoint[] {
  const seen = new Set<string>();
  const rows: CanonicalContactPoint[] = [];

  for (const point of points) {
    const id = `${point.kind}|${point.network ?? ''}|${point.valueNormalized ?? ''}`;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push(point);
  }

  return rows;
}

function fromSingleValue(
  kind: ContactPointKind,
  value: string | undefined,
  label = 'Principal',
): CanonicalContactPoint[] {
  const parsed = sanitizePoint({
    kind,
    value: value ?? '',
    label,
    isPrimary: true,
  });
  return parsed ? [parsed] : [];
}

export function buildContactPointsFromContactInfo(
  contact: ContactInfo | null | undefined,
): CanonicalContactPoint[] {
  if (!contact) return [];

  const rows: CanonicalContactPoint[] = [
    ...fromSingleValue('email', contact.email),
    ...fromSingleValue('phone', contact.phone),
    ...fromSingleValue('website', contact.website),
  ];

  if (Array.isArray(contact.emails)) {
    for (const row of contact.emails) {
      const parsed = sanitizePoint({
        kind: 'email',
        label: row?.label,
        value: row?.value ?? '',
      });
      if (parsed) rows.push(parsed);
    }
  }

  if (Array.isArray(contact.phones)) {
    for (const row of contact.phones) {
      const parsed = sanitizePoint({
        kind: 'phone',
        label: row?.label,
        value: row?.value ?? '',
      });
      if (parsed) rows.push(parsed);
    }
  }

  if (Array.isArray(contact.websites)) {
    for (const row of contact.websites) {
      const parsed = sanitizePoint({
        kind: 'website',
        label: row?.label,
        value: row?.value ?? '',
      });
      if (parsed) rows.push(parsed);
    }
  }

  if (Array.isArray(contact.social_links)) {
    for (const row of contact.social_links) {
      const parsed = sanitizePoint({
        kind: 'social',
        network: row?.network,
        value: row?.url ?? '',
      });
      if (parsed) rows.push(parsed);
    }
  }

  return dedupePoints(rows);
}

export function getPrimaryContactPoint(
  points: CanonicalContactPoint[],
  kind: ContactPointKind,
): CanonicalContactPoint | undefined {
  const byKind = points.filter((row) => row.kind === kind);
  return byKind.find((row) => row.isPrimary) ?? byKind[0];
}
