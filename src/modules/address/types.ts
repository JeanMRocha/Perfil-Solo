export interface CanonicalAddress {
  id?: string;
  label?: string;
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  number?: string;
  complement?: string;
  ibgeCode?: string;
  metadata?: Record<string, unknown>;
}

export interface ContactAddressDraft {
  id: string;
  label: string;
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  address: string;
  address_number: string;
  address_complement: string;
  ibge_code: string;
}

export interface ContactAddressFallback {
  cep?: string;
  neighborhood?: string;
  address?: string;
  address_number?: string;
  address_complement?: string;
  city?: string;
  state?: string;
}

export type LocalIdFactory = (prefix: string) => string;
