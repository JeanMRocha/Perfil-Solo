import { formatCep } from '../../services/cepService';
import type { ContactAddress } from '../../types/contact';
import { toTrimmedText } from './normalization';
import type {
  ContactAddressDraft,
  ContactAddressFallback,
  LocalIdFactory,
} from './types';

function hasAddressDraftContent(row: ContactAddressDraft): boolean {
  return Boolean(
    row.label ||
      row.cep ||
      row.state ||
      row.city ||
      row.neighborhood ||
      row.address ||
      row.address_number ||
      row.address_complement ||
      row.ibge_code,
  );
}

export function createEmptyContactAddressDraft(
  createId: LocalIdFactory,
): ContactAddressDraft {
  return {
    id: createId('address-item'),
    label: '',
    cep: '',
    state: '',
    city: '',
    neighborhood: '',
    address: '',
    address_number: '',
    address_complement: '',
    ibge_code: '',
  };
}

export function normalizeContactAddressDrafts(
  addresses: ContactAddress[] | undefined,
  createId: LocalIdFactory,
): ContactAddressDraft[] {
  if (!Array.isArray(addresses) || addresses.length === 0) return [];
  return addresses
    .map((row) => ({
      id: toTrimmedText(row?.id) || createId('address-item'),
      label: toTrimmedText(row?.label),
      cep: formatCep(row?.cep),
      state: toTrimmedText(row?.state),
      city: toTrimmedText(row?.city),
      neighborhood: toTrimmedText(row?.neighborhood),
      address: toTrimmedText(row?.address),
      address_number: toTrimmedText(row?.address_number),
      address_complement: toTrimmedText(row?.address_complement),
      ibge_code: toTrimmedText(row?.ibge_code),
    }))
    .filter((row) => hasAddressDraftContent(row));
}

export function mapContactAddressDrafts(
  addresses: ContactAddress[] | undefined,
  fallback: ContactAddressFallback,
  createId: LocalIdFactory,
): ContactAddressDraft[] {
  const normalized = normalizeContactAddressDrafts(addresses, createId);
  if (normalized.length > 0) return normalized;

  const fallbackDraft: ContactAddressDraft = {
    id: createId('address-item'),
    label: 'Principal',
    cep: formatCep(fallback.cep),
    state: toTrimmedText(fallback.state),
    city: toTrimmedText(fallback.city),
    neighborhood: toTrimmedText(fallback.neighborhood),
    address: toTrimmedText(fallback.address),
    address_number: toTrimmedText(fallback.address_number),
    address_complement: toTrimmedText(fallback.address_complement),
    ibge_code: '',
  };

  return hasAddressDraftContent(fallbackDraft) ? [fallbackDraft] : [];
}
