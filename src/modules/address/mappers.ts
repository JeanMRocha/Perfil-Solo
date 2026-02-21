import type { CepAddress } from '../../services/cepService';
import type { ContactAddress } from '../../types/contact';
import { normalizeCanonicalAddress } from './normalization';
import type { CanonicalAddress } from './types';

export function canonicalAddressFromContactAddress(
  input: ContactAddress | null | undefined,
): CanonicalAddress {
  return normalizeCanonicalAddress({
    id: input?.id,
    label: input?.label,
    cep: input?.cep,
    state: input?.state,
    city: input?.city,
    neighborhood: input?.neighborhood,
    street: input?.address,
    number: input?.address_number,
    complement: input?.address_complement,
    ibgeCode: input?.ibge_code,
  });
}

export function contactAddressFromCanonicalAddress(
  input: CanonicalAddress | null | undefined,
): ContactAddress {
  const normalized = normalizeCanonicalAddress(input ?? {});
  return {
    id: normalized.id,
    label: normalized.label,
    cep: normalized.cep,
    state: normalized.state,
    city: normalized.city,
    neighborhood: normalized.neighborhood,
    address: normalized.street,
    address_number: normalized.number,
    address_complement: normalized.complement,
    ibge_code: normalized.ibgeCode,
  };
}

export function canonicalAddressFromCepLookup(
  input: CepAddress | null | undefined,
): CanonicalAddress {
  return normalizeCanonicalAddress({
    cep: input?.cep,
    state: input?.uf,
    city: input?.city,
    neighborhood: input?.neighborhood,
    street: input?.street,
    complement: input?.complement,
    ibgeCode: input?.ibgeCode,
  });
}
