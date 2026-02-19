import profileData from '../data/profile.json';
import type { ContactInfo } from '../types/contact';
import { storageReadJson, storageWriteJson } from './safeLocalStorage';

const LOCAL_PROFILE_KEY = 'perfilsolo_profile_v1';
export const PROFILE_UPDATED_EVENT = 'perfilsolo-profile-updated';

export interface ProducerProfile {
  id: string;
  razao_social: string;
  nome_exibicao: string;
  nome_referencia: string;
  website: string;
  cpf: string;
  cnpj: string;
  ie: string;
  im: string;
  cnae: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  estado: string;
  cidade: string;
  bairro: string;
  latitude: string;
  longitude: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_extension: string;
  nfe_process_version: string;
  tax_regime: string;
  icms_rate: string;
  city_code: string;
  nfe_token: string;
  nfe_series: string;
  nfe_last_invoice: string;
  notes: string;
}

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  avatar_url?: string;
  logo_url?: string;
  company_name?: string;
  contact?: ContactInfo;
  producer?: ProducerProfile;
}

function baseContact(): ContactInfo {
  return {
    email: (profileData as any).contact?.email ?? '',
    phone: (profileData as any).contact?.phone ?? '',
    address: (profileData as any).contact?.address ?? '',
  };
}

function baseProducer(): ProducerProfile {
  const company = (profileData as any).company_name ?? '';
  const name = profileData.name ?? '';
  const email = profileData.email ?? '';
  const contact = baseContact();

  return {
    id: '107',
    razao_social: company || name,
    nome_exibicao: company || name,
    nome_referencia: company || name,
    website: '',
    cpf: '',
    cnpj: '',
    ie: '',
    im: '',
    cnae: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    estado: '',
    cidade: '',
    bairro: '',
    latitude: '',
    longitude: '',
    contact_name: name,
    contact_email: contact.email || email,
    contact_phone: contact.phone || '',
    contact_extension: '',
    nfe_process_version: '',
    tax_regime: 'Regime Normal',
    icms_rate: '',
    city_code: '',
    nfe_token: '',
    nfe_series: '',
    nfe_last_invoice: '',
    notes: '',
  };
}

function baseProfile(): UserProfile {
  return {
    name: profileData.name,
    email: profileData.email ?? 'sem-email@perfilsolo.com.br',
    avatar_url: profileData.avatar_url ?? '',
    logo_url: (profileData as any).logo_url ?? '',
    company_name: (profileData as any).company_name ?? '',
    contact: baseContact(),
    producer: baseProducer(),
  };
}

function readLocalProfile(): Partial<UserProfile> {
  return storageReadJson<Partial<UserProfile>>(LOCAL_PROFILE_KEY, {});
}

function writeLocalProfile(profile: UserProfile) {
  const saved = storageWriteJson(LOCAL_PROFILE_KEY, profile);
  if (!saved) return;
  window.dispatchEvent(
    new CustomEvent(PROFILE_UPDATED_EVENT, { detail: profile }),
  );
}

function mergeProfile(base: UserProfile, input: Partial<UserProfile>): UserProfile {
  return {
    ...base,
    ...input,
    contact: {
      ...(base.contact ?? {}),
      ...((input.contact ?? {}) as ContactInfo),
    },
    producer: {
      ...(base.producer ?? baseProducer()),
      ...((input.producer ?? {}) as Partial<ProducerProfile>),
    },
  };
}

export async function getProfile(): Promise<UserProfile> {
  const profile = mergeProfile(baseProfile(), readLocalProfile());
  return Promise.resolve(profile);
}

export async function updateProfile(updated: Partial<UserProfile>): Promise<void> {
  const current = await getProfile();
  const next: UserProfile = mergeProfile(current, updated);
  writeLocalProfile(next);
  return Promise.resolve();
}
