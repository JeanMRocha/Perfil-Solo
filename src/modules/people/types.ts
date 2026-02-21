import type { ContactInfo } from '../../types/contact';

export const PERSON_TYPE_IDENTIFIERS = [
  'customer',
  'supplier',
  'administrator',
  'user_profile',
  'employee',
  'partner',
  'other',
] as const;

export type PersonTypeIdentifier = (typeof PERSON_TYPE_IDENTIFIERS)[number];

export interface PersonTypeMeta {
  id: PersonTypeIdentifier;
  label: string;
  color: string;
  description: string;
}

export interface CanonicalPersonIdentity {
  id?: string;
  userId: string;
  name: string;
  document?: string;
  types: PersonTypeIdentifier[];
  contact?: ContactInfo;
  notes?: string;
  metadata?: Record<string, unknown>;
}
