import { formatCep } from '../../services/cepService';
import type { CanonicalAddress } from './types';

export function toTrimmedText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export function normalizeCanonicalAddress(
  input: CanonicalAddress | null | undefined,
): CanonicalAddress {
  if (!input) return {};
  const normalizedCep = formatCep(input.cep);
  return {
    id: toTrimmedText(input.id) || undefined,
    label: toTrimmedText(input.label) || undefined,
    cep: normalizedCep || undefined,
    state: toTrimmedText(input.state) || undefined,
    city: toTrimmedText(input.city) || undefined,
    neighborhood: toTrimmedText(input.neighborhood) || undefined,
    street: toTrimmedText(input.street) || undefined,
    number: toTrimmedText(input.number) || undefined,
    complement: toTrimmedText(input.complement) || undefined,
    ibgeCode: toTrimmedText(input.ibgeCode) || undefined,
    metadata: input.metadata ?? undefined,
  };
}

export function isCanonicalAddressEmpty(
  input: CanonicalAddress | null | undefined,
): boolean {
  const row = normalizeCanonicalAddress(input);
  return !(
    row.label ||
    row.cep ||
    row.state ||
    row.city ||
    row.neighborhood ||
    row.street ||
    row.number ||
    row.complement ||
    row.ibgeCode
  );
}

export function buildAddressLine(
  parts: Array<string | null | undefined>,
  separator = ' - ',
): string {
  return parts
    .map((item) => toTrimmedText(item))
    .filter((item) => item.length > 0)
    .join(separator);
}

export function buildCanonicalAddressLine(input: CanonicalAddress): string {
  return buildAddressLine([
    input.street,
    input.number,
    input.complement,
    input.neighborhood,
    input.city,
    input.state,
    input.cep,
  ]);
}
