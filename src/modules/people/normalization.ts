import {
  PERSON_TYPE_IDENTIFIERS,
  type PersonTypeIdentifier,
  type PersonTypeMeta,
} from './types';

const PERSON_TYPE_FALLBACK: PersonTypeIdentifier = 'other';

const PERSON_TYPE_META_BY_ID: Record<PersonTypeIdentifier, PersonTypeMeta> = {
  customer: {
    id: 'customer',
    label: 'Cliente',
    color: 'indigo',
    description: 'Pessoa ou empresa compradora.',
  },
  supplier: {
    id: 'supplier',
    label: 'Fornecedor',
    color: 'orange',
    description: 'Pessoa ou empresa fornecedora.',
  },
  administrator: {
    id: 'administrator',
    label: 'Administrador',
    color: 'grape',
    description: 'Responsavel administrativo.',
  },
  user_profile: {
    id: 'user_profile',
    label: 'Perfil do usuario',
    color: 'teal',
    description: 'Identidade vinculada ao usuario logado.',
  },
  employee: {
    id: 'employee',
    label: 'Colaborador',
    color: 'cyan',
    description: 'Pessoa colaboradora interna.',
  },
  partner: {
    id: 'partner',
    label: 'Parceiro',
    color: 'lime',
    description: 'Parceiro comercial ou tecnico.',
  },
  other: {
    id: 'other',
    label: 'Outro',
    color: 'gray',
    description: 'Classificacao generica.',
  },
};

export const PERSON_TYPE_META_LIST: PersonTypeMeta[] =
  PERSON_TYPE_IDENTIFIERS.map((id) => PERSON_TYPE_META_BY_ID[id]);

export function isPersonTypeIdentifier(
  input: unknown,
): input is PersonTypeIdentifier {
  return (
    typeof input === 'string' &&
    (PERSON_TYPE_IDENTIFIERS as readonly string[]).includes(input)
  );
}

export function normalizePersonType(input: unknown): PersonTypeIdentifier {
  if (!isPersonTypeIdentifier(input)) return PERSON_TYPE_FALLBACK;
  return input;
}

export function normalizePersonTypes(
  input: unknown,
  fallback: PersonTypeIdentifier[] = ['customer'],
): PersonTypeIdentifier[] {
  if (!Array.isArray(input)) return [...fallback];
  const seen = new Set<PersonTypeIdentifier>();

  for (const row of input) {
    const normalized = normalizePersonType(row);
    seen.add(normalized);
  }

  if (!seen.size) return [...fallback];
  return [...seen];
}

export function getPersonTypeMeta(type: PersonTypeIdentifier): PersonTypeMeta {
  return PERSON_TYPE_META_BY_ID[type] ?? PERSON_TYPE_META_BY_ID.other;
}

export function getPersonTypeLabel(type: PersonTypeIdentifier): string {
  return getPersonTypeMeta(type).label;
}

export function getPersonTypeColor(type: PersonTypeIdentifier): string {
  return getPersonTypeMeta(type).color;
}
