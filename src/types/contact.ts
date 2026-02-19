export interface ContactChannel {
  id?: string;
  label?: string;
  value: string;
}

export interface ContactSocialLink {
  id?: string;
  network?: string;
  url: string;
}

export interface ContactAddress {
  id?: string;
  label?: string;
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  address_number?: string;
  address_complement?: string;
  ibge_code?: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  emails?: ContactChannel[];
  phones?: ContactChannel[];
  social_links?: ContactSocialLink[];
  addresses?: ContactAddress[];
  cep?: string;
  neighborhood?: string;
  address?: string;
  address_number?: string;
  address_complement?: string;
}

function normalizeText(value: string | undefined): string {
  return value?.trim() ?? '';
}

function normalizeChannels(input: ContactChannel[] | undefined): ContactChannel[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => ({
      id: normalizeText(row?.id) || undefined,
      label: normalizeText(row?.label) || undefined,
      value: normalizeText(row?.value),
    }))
    .filter((row) => row.value.length > 0);
}

export function getPrimaryEmail(contact?: ContactInfo | null): string | undefined {
  if (!contact) return undefined;
  const fromList = normalizeChannels(contact.emails)[0]?.value;
  if (fromList) return fromList;
  const fromField = normalizeText(contact.email);
  return fromField || undefined;
}

export function getPrimaryPhone(contact?: ContactInfo | null): string | undefined {
  if (!contact) return undefined;
  const fromList = normalizeChannels(contact.phones)[0]?.value;
  if (fromList) return fromList;
  const fromField = normalizeText(contact.phone);
  return fromField || undefined;
}
