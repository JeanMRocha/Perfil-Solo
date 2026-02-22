import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { formatCep, lookupAddressByCep, normalizeCep } from '../../services/cepService';
import { listClientsByUser, type ClientRecord } from '../../services/clientsService';
import {
  createEmptyContactAddressDraft,
  mapContactAddressDrafts,
  normalizeContactAddressDrafts,
  type ContactAddressDraft,
} from '../../modules/address';
import {
  mapCanonicalPointsToContactInfo,
  mapContactInfoToCanonicalPoints,
} from '../../modules/contact';
import {
  listPropertyAreaCategories,
  subscribePropertyAreaCategories,
  type PropertyAreaCategory,
} from '../../services/propertyAreaCategoriesService';
import type {
  ContactChannel,
  ContactInfo,
  ContactSocialLink,
} from '../../types/contact';
import type {
  PropertyAreaAllocation,
  Property,
  PropertyDocuments,
  PropertyFiscalData,
  PropertyOwnerRef,
} from '../../types/property';

type PropertyModalMode = 'create' | 'edit';

export type PropertyFullModalSubmitPayload = {
  nome: string;
  contact?: ContactInfo;
  patch: Partial<Property>;
};

type PropertyFullModalProps = {
  opened: boolean;
  mode: PropertyModalMode;
  onClose: () => void;
  onSubmit: (payload: PropertyFullModalSubmitPayload) => Promise<void> | void;
  saving?: boolean;
  userId?: string | null;
  property?: Property | null;
  talhoesAreaHa?: number;
};

type PropertyAreaAllocationDraft = {
  id: string;
  category_id: string;
  category_name: string;
  area_ha: string;
};

type ContactChannelDraft = {
  id: string;
  label: string;
  value: string;
};

type ContactSocialDraft = {
  id: string;
  network: string;
  url: string;
};

type PropertyFormDraft = {
  nome: string;
  cidade: string;
  estado: string;
  total_area: string;
  contato: ContactInfo;
  proprietario: PropertyOwnerRef | null;
  documentos: PropertyDocuments;
  fiscal: PropertyFiscalDraft;
  area_allocations: PropertyAreaAllocationDraft[];
};

type PropertyFiscalDraft = {
  cnpj: string;
  cnaes: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  data_abertura: string;
  natureza_juridica: string;
  porte: string;
  capital_social: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  regime_tributario: string;
  aliquota_icms: string;
  codigo_municipio: string;
  serie: string;
  ultima_nf_emitida: string;
  token: string;
};

function createLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toText(value: string | undefined): string {
  return value?.trim() ?? '';
}

function numberToText(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return String(value);
}

function parseOptionalNumber(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatAreaHa(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPhoneForDisplay(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) {
    const start = rest.slice(0, 4);
    const end = rest.slice(4);
    return end ? `(${ddd}) ${start}-${end}` : `(${ddd}) ${start}`;
  }
  const start = rest.slice(0, 5);
  const end = rest.slice(5, 9);
  return end ? `(${ddd}) ${start}-${end}` : `(${ddd}) ${start}`;
}

const SOCIAL_NETWORK_OPTIONS = [
  { value: 'Instagram', label: 'Instagram' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'YouTube', label: 'YouTube' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'X', label: 'X' },
  { value: 'Site', label: 'Site' },
  { value: 'Outro', label: 'Outro' },
];

function normalizeContactChannels(
  channels: ContactChannel[] | undefined,
): ContactChannelDraft[] {
  if (!Array.isArray(channels) || channels.length === 0) return [];
  return channels
    .map((row) => ({
      id: toText(row?.id) || createLocalId('contact-item'),
      label: toText(row?.label),
      value: toText(row?.value),
    }))
    .filter((row) => row.value.length > 0);
}

function normalizeSocialLinks(
  links: ContactSocialLink[] | undefined,
): ContactSocialDraft[] {
  if (!Array.isArray(links) || links.length === 0) return [];
  return links
    .map((row) => ({
      id: toText(row?.id) || createLocalId('social-item'),
      network: toText(row?.network),
      url: toText(row?.url),
    }))
    .filter((row) => row.url.length > 0);
}

function mapContactChannelsDraft(
  channels: ContactChannel[] | undefined,
  fallbackValue: string | undefined,
): ContactChannelDraft[] {
  const normalized = normalizeContactChannels(channels);
  if (normalized.length > 0) return normalized;
  const fallback = toText(fallbackValue);
  if (!fallback) return [];
  return [{ id: createLocalId('contact-item'), label: 'Principal', value: fallback }];
}

function normalizeContact(contact: ContactInfo): ContactInfo | undefined {
  const contactPoints = mapContactInfoToCanonicalPoints(contact);
  const normalizedByModule = mapCanonicalPointsToContactInfo(
    contactPoints,
    contact,
  );
  const hasExplicitEmailsList = Array.isArray(contact.emails);
  const hasExplicitPhonesList = Array.isArray(contact.phones);

  // Prioriza sempre os canais editados no formulario (emails/phones).
  // Evita que campos legados (email/phone) restaurem valores antigos apos exclusao.
  const emailsFromDraft = normalizeContactChannels(contact.emails);
  const phonesFromDraft = normalizeContactChannels(contact.phones);
  const fallbackEmail = hasExplicitEmailsList ? '' : toText(normalizedByModule.email);
  const fallbackPhone = hasExplicitPhonesList ? '' : toText(normalizedByModule.phone);
  const emails =
    emailsFromDraft.length > 0
      ? emailsFromDraft
      : mapContactChannelsDraft(undefined, fallbackEmail);
  const phones =
    phonesFromDraft.length > 0
      ? phonesFromDraft
      : mapContactChannelsDraft(undefined, fallbackPhone);

  const socialLinks = normalizeSocialLinks(normalizedByModule.social_links);
  const addresses = normalizeContactAddressDrafts(contact.addresses, createLocalId);
  const primaryAddress = addresses[0];
  const primaryEmail = emails[0]?.value ?? '';
  const primaryPhone = phones[0]?.value ?? '';
  const website = toText(normalizedByModule.website);

  const normalized: ContactInfo = {
    email: primaryEmail || undefined,
    phone: primaryPhone || undefined,
    website: website || undefined,
    emails: emails.length > 0 ? emails : undefined,
    phones: phones.length > 0 ? phones : undefined,
    websites:
      normalizedByModule.websites && normalizedByModule.websites.length > 0
        ? normalizedByModule.websites
        : undefined,
    social_links: socialLinks.length > 0 ? socialLinks : undefined,
    addresses: addresses.length > 0 ? addresses : undefined,
    cep: primaryAddress?.cep || formatCep(contact.cep),
    neighborhood: primaryAddress?.neighborhood || toText(contact.neighborhood),
    address: primaryAddress?.address || toText(contact.address),
    address_number: primaryAddress?.address_number || toText(contact.address_number),
    address_complement:
      primaryAddress?.address_complement || toText(contact.address_complement),
  };
  if (
    !primaryEmail &&
    !primaryPhone &&
    emails.length === 0 &&
    phones.length === 0 &&
    !website &&
    socialLinks.length === 0 &&
    addresses.length === 0 &&
    !normalized.cep &&
    !normalized.neighborhood &&
    !normalized.address &&
    !normalized.address_number &&
    !normalized.address_complement
  ) {
    return undefined;
  }
  return normalized;
}

function normalizeDocuments(
  documents: PropertyDocuments,
): PropertyDocuments | undefined {
  const normalized: PropertyDocuments = {
    car: toText(documents.car),
    itr: toText(documents.itr),
    ccir: toText(documents.ccir),
    rgi: toText(documents.rgi),
  };
  if (!normalized.car && !normalized.itr && !normalized.ccir && !normalized.rgi) {
    return undefined;
  }
  return normalized;
}

function cnaesToText(cnaes: string[] | undefined): string {
  if (!cnaes || cnaes.length === 0) return '';
  return cnaes.join('\n');
}

function textToCnaes(value: string): string[] {
  return value
    .split(/[\n,;]/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeFiscal(
  fiscal: PropertyFiscalDraft,
): PropertyFiscalData | undefined {
  const cnpj = toText(fiscal.cnpj);
  const cnaes = textToCnaes(fiscal.cnaes);
  const cartao_cnpj = {
    razao_social: toText(fiscal.razao_social),
    nome_fantasia: toText(fiscal.nome_fantasia),
    situacao_cadastral: toText(fiscal.situacao_cadastral),
    data_abertura: toText(fiscal.data_abertura),
    natureza_juridica: toText(fiscal.natureza_juridica),
    porte: toText(fiscal.porte),
    capital_social: parseOptionalNumber(fiscal.capital_social),
  };
  const nfe = {
    inscricao_estadual: toText(fiscal.inscricao_estadual),
    inscricao_municipal: toText(fiscal.inscricao_municipal),
    regime_tributario: toText(fiscal.regime_tributario),
    aliquota_icms: parseOptionalNumber(fiscal.aliquota_icms),
    codigo_municipio: toText(fiscal.codigo_municipio),
    serie: toText(fiscal.serie),
    ultima_nf_emitida: toText(fiscal.ultima_nf_emitida),
    token: toText(fiscal.token),
  };

  const hasCardData = Boolean(
    cartao_cnpj.razao_social ||
      cartao_cnpj.nome_fantasia ||
      cartao_cnpj.situacao_cadastral ||
      cartao_cnpj.data_abertura ||
      cartao_cnpj.natureza_juridica ||
      cartao_cnpj.porte ||
      cartao_cnpj.capital_social != null,
  );
  const hasNfeData = Boolean(
    nfe.inscricao_estadual ||
      nfe.inscricao_municipal ||
      nfe.regime_tributario ||
      nfe.aliquota_icms != null ||
      nfe.codigo_municipio ||
      nfe.serie ||
      nfe.ultima_nf_emitida ||
      nfe.token,
  );

  if (!cnpj && cnaes.length === 0 && !hasCardData && !hasNfeData) {
    return undefined;
  }

  return {
    cnpj: cnpj || undefined,
    cnaes: cnaes.length > 0 ? cnaes : undefined,
    cartao_cnpj: hasCardData ? cartao_cnpj : undefined,
    nfe: hasNfeData ? nfe : undefined,
  };
}

function mapAreaAllocationsDraft(
  input: PropertyAreaAllocation[] | undefined,
): PropertyAreaAllocationDraft[] {
  if (!input || input.length === 0) return [];
  return input
    .map((item) => ({
      id: item.id || createLocalId('area-item'),
      category_id: item.category_id?.trim() ?? '',
      category_name: item.category_name?.trim() ?? '',
      area_ha: numberToText(item.area_ha),
    }))
    .filter((item) => item.category_name.length > 0);
}

function buildInitialDraft(property?: Property | null): PropertyFormDraft {
  const fiscal = property?.fiscal;
  const fiscalCard = fiscal?.cartao_cnpj;
  const fiscalNfe = fiscal?.nfe;
  const contact = property?.contato_detalhes ?? {};

  return {
    nome: property?.nome ?? '',
    cidade: property?.cidade ?? '',
    estado: property?.estado ?? '',
    total_area: numberToText(property?.total_area),
    contato: {
      ...contact,
      emails: mapContactChannelsDraft(contact.emails, contact.email),
      phones: mapContactChannelsDraft(contact.phones, contact.phone),
      social_links: normalizeSocialLinks(contact.social_links),
      addresses: mapContactAddressDrafts(
        contact.addresses,
        {
        cep: contact.cep,
        neighborhood: contact.neighborhood,
        address: contact.address,
        address_number: contact.address_number,
        address_complement: contact.address_complement,
        city: property?.cidade,
        state: property?.estado,
        },
        createLocalId,
      ),
    },
    proprietario: property?.proprietario_principal ?? null,
    documentos: property?.documentos ?? {},
    fiscal: {
      cnpj: fiscal?.cnpj ?? '',
      cnaes: cnaesToText(fiscal?.cnaes),
      razao_social: fiscalCard?.razao_social ?? '',
      nome_fantasia: fiscalCard?.nome_fantasia ?? '',
      situacao_cadastral: fiscalCard?.situacao_cadastral ?? '',
      data_abertura: fiscalCard?.data_abertura ?? '',
      natureza_juridica: fiscalCard?.natureza_juridica ?? '',
      porte: fiscalCard?.porte ?? '',
      capital_social: numberToText(fiscalCard?.capital_social),
      inscricao_estadual: fiscalNfe?.inscricao_estadual ?? '',
      inscricao_municipal: fiscalNfe?.inscricao_municipal ?? '',
      regime_tributario: fiscalNfe?.regime_tributario ?? '',
      aliquota_icms: numberToText(fiscalNfe?.aliquota_icms),
      codigo_municipio: fiscalNfe?.codigo_municipio ?? '',
      serie: fiscalNfe?.serie ?? '',
      ultima_nf_emitida: fiscalNfe?.ultima_nf_emitida ?? '',
      token: fiscalNfe?.token ?? '',
    },
    area_allocations: mapAreaAllocationsDraft(property?.area_allocations),
  };
}

function matchesClient(client: ClientRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const values = [client.nome, client.contact.email, client.contact.phone];
  return values.some((value) => value?.toLowerCase().includes(q));
}

export default function PropertyFullModal({
  opened,
  mode,
  onClose,
  onSubmit,
  saving = false,
  userId,
  property,
  talhoesAreaHa = 0,
}: PropertyFullModalProps) {
  const [draft, setDraft] = useState<PropertyFormDraft>(buildInitialDraft(property));
  const [ownerQuery, setOwnerQuery] = useState('');
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingCepAddressId, setLoadingCepAddressId] = useState<string | null>(null);
  const [cepErrorsByAddress, setCepErrorsByAddress] = useState<Record<string, string>>(
    {},
  );
  const [areaCategories, setAreaCategories] = useState<PropertyAreaCategory[]>(
    () => listPropertyAreaCategories(true),
  );
  const [areaDraftCategoryId, setAreaDraftCategoryId] = useState<string | null>(null);
  const [areaDraftValue, setAreaDraftValue] = useState<number | ''>('');

  useEffect(() => {
    if (!opened) return;
    setDraft(buildInitialDraft(property));
    setOwnerQuery('');
    setCepErrorsByAddress({});
    setLoadingCepAddressId(null);
    setAreaDraftCategoryId(null);
    setAreaDraftValue('');
  }, [opened, property]);

  useEffect(() => {
    if (!opened || !userId) {
      setClients([]);
      return;
    }
    let alive = true;
    const loadClients = async () => {
      setLoadingClients(true);
      try {
        const rows = await listClientsByUser(userId);
        if (!alive) return;
        setClients(rows);
      } finally {
        if (alive) setLoadingClients(false);
      }
    };
    void loadClients();
    return () => {
      alive = false;
    };
  }, [opened, userId]);

  useEffect(() => {
    if (!opened) return;
    setAreaCategories(listPropertyAreaCategories(true));
    const unsubscribe = subscribePropertyAreaCategories((rows) => {
      setAreaCategories(
        [...rows].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      );
    });
    return unsubscribe;
  }, [opened]);

  const areaCategoryOptions = useMemo(
    () =>
      areaCategories
        .filter((row) => row.active && row.id !== 'talhoes')
        .map((row) => ({
          value: row.id,
          label: row.name,
        })),
    [areaCategories],
  );

  const normalizedTalhoesArea = useMemo(() => {
    const parsed = Number(talhoesAreaHa);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return parsed;
  }, [talhoesAreaHa]);

  const talhoesCategoryName = useMemo(
    () =>
      areaCategories.find((row) => row.id === 'talhoes')?.name ?? 'Talhões',
    [areaCategories],
  );

  const selectedAreaCategory = useMemo(
    () =>
      areaCategories.find(
        (row) => row.id === areaDraftCategoryId && row.active,
      ) ?? null,
    [areaCategories, areaDraftCategoryId],
  );

  const parsedAreaDraftValue = useMemo(() => {
    if (areaDraftValue === '' || areaDraftValue == null) return null;
    const parsed = Number(areaDraftValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [areaDraftValue]);

  const areaTotalByCategory = useMemo(() => {
    const groups = new Map<
      string,
      { category_id: string; category_name: string; total: number }
    >();

    for (const item of draft.area_allocations) {
      const areaValue = parseOptionalNumber(item.area_ha);
      if (areaValue == null || areaValue <= 0) continue;
      const categoryId = item.category_id || item.category_name;
      const current = groups.get(categoryId);
      if (current) {
        current.total += areaValue;
        continue;
      }
      groups.set(categoryId, {
        category_id: categoryId,
        category_name: item.category_name || 'Sem categoria',
        total: areaValue,
      });
    }

    if (normalizedTalhoesArea > 0) {
      const current = groups.get('talhoes');
      if (current) {
        current.total += normalizedTalhoesArea;
      } else {
        groups.set('talhoes', {
          category_id: 'talhoes',
          category_name: talhoesCategoryName,
          total: normalizedTalhoesArea,
        });
      }
    }

    return [...groups.values()].sort((a, b) =>
      a.category_name.localeCompare(b.category_name, 'pt-BR'),
    );
  }, [draft.area_allocations, normalizedTalhoesArea, talhoesCategoryName]);

  const hasAreaSummary = useMemo(
    () => draft.area_allocations.length > 0 || normalizedTalhoesArea > 0,
    [draft.area_allocations.length, normalizedTalhoesArea],
  );

  const areaTotalGeral = useMemo(
    () =>
      areaTotalByCategory.reduce((acc, row) => acc + row.total, 0),
    [areaTotalByCategory],
  );

  const filteredClients = useMemo(
    () => clients.filter((client) => matchesClient(client, ownerQuery)),
    [clients, ownerQuery],
  );

  const draftNameError = useMemo(() => {
    if (!opened) return null;
    if (draft.nome.trim().length === 0) return 'Informe o nome da propriedade.';
    return null;
  }, [draft.nome, opened]);

  const addAreaAllocation = () => {
    if (!selectedAreaCategory || parsedAreaDraftValue == null) return;
    setDraft((prev) => ({
      ...prev,
      area_allocations: (() => {
        const existingIndex = prev.area_allocations.findIndex(
          (item) => item.category_id === selectedAreaCategory.id,
        );
        if (existingIndex < 0) {
          return [
            ...prev.area_allocations,
            {
              id: createLocalId('area-item'),
              category_id: selectedAreaCategory.id,
              category_name: selectedAreaCategory.name,
              area_ha: String(parsedAreaDraftValue),
            },
          ];
        }

        const nextRows = [...prev.area_allocations];
        const currentArea =
          parseOptionalNumber(nextRows[existingIndex].area_ha) ?? 0;
        nextRows[existingIndex] = {
          ...nextRows[existingIndex],
          category_name: selectedAreaCategory.name,
          area_ha: String(currentArea + parsedAreaDraftValue),
        };
        return nextRows;
      })(),
    }));
    setAreaDraftValue('');
  };

  const removeAreaAllocation = (allocationId: string) => {
    setDraft((prev) => ({
      ...prev,
      area_allocations: prev.area_allocations.filter(
        (item) => item.id !== allocationId,
      ),
    }));
  };

  const addContactChannel = (field: 'emails' | 'phones') => {
    setDraft((prev) => ({
      ...prev,
      contato: {
        ...prev.contato,
        [field]: [
          ...(prev.contato[field] ?? []),
          { id: createLocalId(field), label: '', value: '' },
        ],
      },
    }));
  };

  const updateContactChannel = (
    field: 'emails' | 'phones',
    itemId: string,
    key: 'label' | 'value',
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      contato: {
        ...prev.contato,
        [field]: (prev.contato[field] ?? []).map((item) =>
          item.id === itemId ? { ...item, [key]: value } : item,
        ),
      },
    }));
  };

  const removeContactChannel = (field: 'emails' | 'phones', itemId: string) => {
    setDraft((prev) => ({
      ...prev,
      contato: {
        ...prev.contato,
        [field]: (prev.contato[field] ?? []).filter((item) => item.id !== itemId),
      },
    }));
  };

  const addSocialLink = () => {
    setDraft((prev) => ({
      ...prev,
      contato: {
        ...prev.contato,
        social_links: [
          ...(prev.contato.social_links ?? []),
          { id: createLocalId('social-link'), network: '', url: '' },
        ],
      },
    }));
  };

  const updateSocialLink = (
    itemId: string,
    key: 'network' | 'url',
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      contato: {
        ...prev.contato,
        social_links: (prev.contato.social_links ?? []).map((item) =>
          item.id === itemId ? { ...item, [key]: value } : item,
        ),
      },
    }));
  };

  const removeSocialLink = (itemId: string) => {
    setDraft((prev) => ({
      ...prev,
      contato: {
        ...prev.contato,
        social_links: (prev.contato.social_links ?? []).filter(
          (item) => item.id !== itemId,
        ),
      },
    }));
  };

  const addAddressRow = () => {
    setDraft((prev) => ({
      ...prev,
      contato: {
        ...prev.contato,
        addresses: [
          ...(prev.contato.addresses ?? []),
          createEmptyContactAddressDraft(createLocalId),
        ],
      },
    }));
  };

  const updateAddressRow = (
    itemId: string,
    key: keyof ContactAddressDraft,
    value: string,
  ) => {
    setDraft((prev) => {
      const nextAddresses = (prev.contato.addresses ?? []).map((item) =>
        item.id === itemId ? { ...item, [key]: value } : item,
      );
      const firstAddress = nextAddresses[0];
      return {
        ...prev,
        estado: firstAddress?.state ?? prev.estado,
        cidade: firstAddress?.city ?? prev.cidade,
        fiscal: {
          ...prev.fiscal,
          codigo_municipio:
            firstAddress?.ibge_code || prev.fiscal.codigo_municipio,
        },
        contato: {
          ...prev.contato,
          addresses: nextAddresses,
        },
      };
    });
  };

  const removeAddressRow = (itemId: string) => {
    setCepErrorsByAddress((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    if (loadingCepAddressId === itemId) {
      setLoadingCepAddressId(null);
    }
    setDraft((prev) => {
      const nextAddresses = (prev.contato.addresses ?? []).filter(
        (item) => item.id !== itemId,
      );
      const firstAddress = nextAddresses[0];
      return {
        ...prev,
        estado: firstAddress?.state ?? prev.estado,
        cidade: firstAddress?.city ?? prev.cidade,
        fiscal: {
          ...prev.fiscal,
          codigo_municipio:
            firstAddress?.ibge_code || prev.fiscal.codigo_municipio,
        },
        contato: {
          ...prev.contato,
          addresses: nextAddresses,
        },
      };
    });
  };

  const applyCepLookupToAddress = async (addressId: string, rawCep: string) => {
    const cepDigits = normalizeCep(rawCep);
    if (cepDigits.length === 0) {
      setCepErrorsByAddress((prev) => {
        const next = { ...prev };
        delete next[addressId];
        return next;
      });
      return;
    }
    if (cepDigits.length !== 8) {
      setCepErrorsByAddress((prev) => ({
        ...prev,
        [addressId]: 'CEP deve ter 8 digitos.',
      }));
      return;
    }

    setLoadingCepAddressId(addressId);
    setCepErrorsByAddress((prev) => {
      const next = { ...prev };
      delete next[addressId];
      return next;
    });
    try {
      const result = await lookupAddressByCep(cepDigits);
      if (!result) {
        setCepErrorsByAddress((prev) => ({
          ...prev,
          [addressId]: 'CEP não encontrado.',
        }));
        return;
      }

      setDraft((prev) => {
        const firstAddressId = prev.contato.addresses?.[0]?.id;
        const isPrimaryAddress = firstAddressId === addressId;
        return {
          ...prev,
          estado: isPrimaryAddress ? result.uf || prev.estado : prev.estado,
          cidade: isPrimaryAddress ? result.city || prev.cidade : prev.cidade,
          contato: {
            ...prev.contato,
            addresses: (prev.contato.addresses ?? []).map((item) =>
              item.id === addressId
                ? {
                    ...item,
                    cep: result.cep || formatCep(cepDigits),
                    state: result.uf || item.state,
                    city: result.city || item.city,
                    neighborhood: result.neighborhood || item.neighborhood,
                    address: result.street || item.address,
                    address_complement:
                      item.address_complement?.trim().length
                        ? item.address_complement
                        : result.complement || item.address_complement,
                    ibge_code: result.ibgeCode || item.ibge_code,
                  }
                : item,
            ),
          },
          fiscal: {
            ...prev.fiscal,
            codigo_municipio:
              isPrimaryAddress
                ? result.ibgeCode || prev.fiscal.codigo_municipio
                : prev.fiscal.codigo_municipio,
          },
        };
      });
    } catch (error: any) {
      setCepErrorsByAddress((prev) => ({
        ...prev,
        [addressId]: error?.message ?? 'Falha ao consultar CEP.',
      }));
    } finally {
      setLoadingCepAddressId(null);
    }
  };

  const handleSave = async () => {
    const nome = draft.nome.trim();
    if (nome.length === 0) return;

    const contact = normalizeContact(draft.contato);
    const documents = normalizeDocuments(draft.documentos);
    const fiscal = normalizeFiscal(draft.fiscal);

    const areaAllocationsGrouped = new Map<string, PropertyAreaAllocation>();
    for (const item of draft.area_allocations) {
      const categoryId = item.category_id.trim();
      if (!categoryId || categoryId === 'talhoes') continue;

      const areaValue = parseOptionalNumber(item.area_ha);
      if (areaValue == null || areaValue <= 0) continue;

      const categoryName =
        areaCategories.find((row) => row.id === categoryId)?.name ??
        item.category_name.trim();
      if (!categoryName) continue;

      const existing = areaAllocationsGrouped.get(categoryId);
      if (existing) {
        existing.area_ha += areaValue;
      } else {
        areaAllocationsGrouped.set(categoryId, {
          id: item.id || createLocalId('area-item'),
          category_id: categoryId,
          category_name: categoryName,
          area_ha: areaValue,
          created_at: new Date().toISOString(),
        });
      }
    }

    const areaAllocations = [...areaAllocationsGrouped.values()].sort((a, b) =>
      a.category_name.localeCompare(b.category_name, 'pt-BR'),
    );

    const totalAreaFromTalhoes =
      normalizedTalhoesArea > 0 ? normalizedTalhoesArea : undefined;

    await onSubmit({
      nome,
      contact,
      patch: {
        cidade: toText(draft.cidade) || undefined,
        estado: toText(draft.estado) || undefined,
        total_area: totalAreaFromTalhoes,
        area_allocations: areaAllocations.length > 0 ? areaAllocations : undefined,
        contato_detalhes: contact,
        proprietario_principal: draft.proprietario ?? null,
        documentos: documents,
        fiscal,
      },
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="xl"
      padding="sm"
      title={mode === 'create' ? 'Cadastrar propriedade' : 'Editar propriedade'}
    >
      <Stack gap="xs">
        <Tabs defaultValue="gerais">
          <Tabs.List>
            <Tabs.Tab value="gerais">Gerais</Tabs.Tab>
            <Tabs.Tab value="enderecos">Endereços</Tabs.Tab>
            <Tabs.Tab value="contatos">Contatos</Tabs.Tab>
            <Tabs.Tab value="proprietario">Proprietário</Tabs.Tab>
            <Tabs.Tab value="documentos">Documentos</Tabs.Tab>
            <Tabs.Tab value="fiscal">Fiscal NFe</Tabs.Tab>
            <Tabs.Tab value="areas">Resumo de Áreas</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="gerais" pt="xs">
            <Stack gap="xs">
              <TextInput
                label="Nome da propriedade"
                value={draft.nome}
                onChange={(event) => {
                  const nextValue = event.currentTarget?.value ?? '';
                  setDraft((prev) => ({ ...prev, nome: nextValue }));
                }}
                error={draftNameError}
                data-autofocus
              />
              <TextInput
                label="Área total (ha)"
                value={formatAreaHa(normalizedTalhoesArea)}
                readOnly
                description="Calculada automaticamente pela soma dos talhões."
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="enderecos" pt="xs">
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text fw={600} size="sm">
                  Endereços da propriedade
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={addAddressRow}
                >
                  Adicionar endereço
                </Button>
              </Group>

              {(draft.contato.addresses ?? []).length === 0 ? (
                <Text size="sm" c="dimmed">
                  Nenhum endereço cadastrado.
                </Text>
              ) : (
                <Stack gap="xs">
                  {(draft.contato.addresses ?? []).map((item, index) => (
                    <Card key={item.id} withBorder radius="md" p="xs">
                      <Stack gap="xs">
                        <Group justify="space-between" align="center">
                          <Badge color={index === 0 ? 'green' : 'gray'} variant="light">
                            {index === 0 ? 'Endereço principal' : `Endereço ${index + 1}`}
                          </Badge>
                          <ActionIcon
                            color="red"
                            variant="light"
                            onClick={() => removeAddressRow(item.id ?? '')}
                            aria-label="Remover endereço"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>

                        <TextInput
                          label="Categoria / local"
                          placeholder="Unidade, correspondência, escritório..."
                          value={item.label ?? ''}
                          onChange={(event) =>
                            updateAddressRow(
                              item.id ?? '',
                              'label',
                              event.currentTarget?.value ?? '',
                            )
                          }
                        />

                        <Group align="end" grow>
                          <TextInput
                            label="CEP"
                            placeholder="00000-000"
                            value={formatCep(item.cep)}
                            onChange={(event) =>
                              updateAddressRow(
                                item.id ?? '',
                                'cep',
                                formatCep(event.currentTarget?.value ?? ''),
                              )
                            }
                            onBlur={() =>
                              void applyCepLookupToAddress(item.id ?? '', item.cep ?? '')
                            }
                          />
                          <Button
                            variant="light"
                            onClick={() =>
                              void applyCepLookupToAddress(item.id ?? '', item.cep ?? '')
                            }
                            loading={loadingCepAddressId === item.id}
                            disabled={normalizeCep(item.cep).length !== 8}
                          >
                            Buscar CEP
                          </Button>
                        </Group>
                        {cepErrorsByAddress[item.id ?? ''] ? (
                          <Text size="xs" c="red">
                            {cepErrorsByAddress[item.id ?? '']}
                          </Text>
                        ) : null}

                        <Group grow>
                          <TextInput
                            label="Estado (UF)"
                            placeholder="UF"
                            value={item.state ?? ''}
                            onChange={(event) =>
                              updateAddressRow(
                                item.id ?? '',
                                'state',
                                event.currentTarget?.value ?? '',
                              )
                            }
                          />
                          <TextInput
                            label="Cidade"
                            placeholder="Cidade"
                            value={item.city ?? ''}
                            onChange={(event) =>
                              updateAddressRow(
                                item.id ?? '',
                                'city',
                                event.currentTarget?.value ?? '',
                              )
                            }
                          />
                          <TextInput
                            label="Bairro"
                            placeholder="Bairro"
                            value={item.neighborhood ?? ''}
                            onChange={(event) =>
                              updateAddressRow(
                                item.id ?? '',
                                'neighborhood',
                                event.currentTarget?.value ?? '',
                              )
                            }
                          />
                        </Group>

                        <Group grow>
                          <TextInput
                            label="Endereço"
                            placeholder="Rua, avenida, estrada..."
                            value={item.address ?? ''}
                            onChange={(event) =>
                              updateAddressRow(
                                item.id ?? '',
                                'address',
                                event.currentTarget?.value ?? '',
                              )
                            }
                          />
                          <TextInput
                            label="Número"
                            placeholder="Sem número"
                            value={item.address_number ?? ''}
                            onChange={(event) =>
                              updateAddressRow(
                                item.id ?? '',
                                'address_number',
                                event.currentTarget?.value ?? '',
                              )
                            }
                          />
                          <TextInput
                            label="Complemento"
                            placeholder="Apartamento, bloco, referencia..."
                            value={item.address_complement ?? ''}
                            onChange={(event) =>
                              updateAddressRow(
                                item.id ?? '',
                                'address_complement',
                                event.currentTarget?.value ?? '',
                              )
                            }
                          />
                        </Group>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="contatos" pt="xs">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600} size="sm">
                  Emails da propriedade
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => addContactChannel('emails')}
                >
                  Adicionar email
                </Button>
              </Group>
              {(draft.contato.emails ?? []).length === 0 ? (
                <Text size="sm" c="dimmed">
                  Nenhum email cadastrado.
                </Text>
              ) : (
                <Stack gap="xs">
                  {(draft.contato.emails ?? []).map((item) => (
                    <Card key={item.id} withBorder radius="md" p="xs">
                      <Group align="flex-end" wrap="nowrap">
                        <TextInput
                          label="Categoria / local"
                          placeholder="Financeiro, matriz, filial..."
                          value={item.label ?? ''}
                          onChange={(event) =>
                            updateContactChannel(
                              'emails',
                              item.id ?? '',
                              'label',
                              event.currentTarget?.value ?? '',
                            )
                          }
                          style={{ flex: 1 }}
                        />
                        <TextInput
                          type="email"
                          label="Email"
                          placeholder="contato@empresa.com"
                          value={item.value ?? ''}
                          onChange={(event) =>
                            updateContactChannel(
                              'emails',
                              item.id ?? '',
                              'value',
                              event.currentTarget?.value ?? '',
                            )
                          }
                          style={{ flex: 1 }}
                        />
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => removeContactChannel('emails', item.id ?? '')}
                          aria-label="Remover email"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              )}

              <Group justify="space-between" align="center" mt="xs">
                <Text fw={600} size="sm">
                  Telefones da propriedade
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => addContactChannel('phones')}
                >
                  Adicionar telefone
                </Button>
              </Group>
              {(draft.contato.phones ?? []).length === 0 ? (
                <Text size="sm" c="dimmed">
                  Nenhum telefone cadastrado.
                </Text>
              ) : (
                <Stack gap="xs">
                  {(draft.contato.phones ?? []).map((item) => (
                    <Card key={item.id} withBorder radius="md" p="xs">
                      <Group align="flex-end" wrap="nowrap">
                        <TextInput
                          label="Categoria / local"
                          placeholder="Recepcao, operacional..."
                          value={item.label ?? ''}
                          onChange={(event) =>
                            updateContactChannel(
                              'phones',
                              item.id ?? '',
                              'label',
                              event.currentTarget?.value ?? '',
                            )
                          }
                          style={{ flex: 1 }}
                        />
                        <TextInput
                          label="Telefone"
                          placeholder="(00) 00000-0000"
                          value={item.value ?? ''}
                          onChange={(event) =>
                            updateContactChannel(
                              'phones',
                              item.id ?? '',
                              'value',
                              event.currentTarget?.value ?? '',
                            )
                          }
                          onBlur={(event) =>
                            updateContactChannel(
                              'phones',
                              item.id ?? '',
                              'value',
                              formatPhoneForDisplay(event.currentTarget?.value ?? ''),
                            )
                          }
                          style={{ flex: 1 }}
                        />
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => removeContactChannel('phones', item.id ?? '')}
                          aria-label="Remover telefone"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              )}

              <Group justify="space-between" align="center" mt="xs">
                <Text fw={600} size="sm">
                  Redes sociais
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={addSocialLink}
                >
                  Adicionar rede
                </Button>
              </Group>
              {(draft.contato.social_links ?? []).length === 0 ? (
                <Text size="sm" c="dimmed">
                  Nenhuma rede social cadastrada.
                </Text>
              ) : (
                <Stack gap="xs">
                  {(draft.contato.social_links ?? []).map((item) => (
                    <Card key={item.id} withBorder radius="md" p="xs">
                      <Group align="flex-end" wrap="nowrap">
                        <Select
                          label="Rede"
                          placeholder="Selecione a rede"
                          data={SOCIAL_NETWORK_OPTIONS}
                          searchable
                          value={item.network ?? null}
                          onChange={(value) =>
                            updateSocialLink(item.id ?? '', 'network', value ?? '')
                          }
                          style={{ width: 220 }}
                        />
                        <TextInput
                          label="Link ou @perfil"
                          placeholder="https://... ou @usuário"
                          value={item.url ?? ''}
                          onChange={(event) =>
                            updateSocialLink(
                              item.id ?? '',
                              'url',
                              event.currentTarget?.value ?? '',
                            )
                          }
                          style={{ flex: 1 }}
                        />
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => removeSocialLink(item.id ?? '')}
                          aria-label="Remover rede social"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="proprietario" pt="xs">
            <Stack gap="xs">
              {draft.proprietario ? (
                <Card withBorder radius="md" p="xs">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2}>
                      <Group gap={6}>
                        <Text fw={700}>{draft.proprietario.nome}</Text>
                        <Badge color="green" variant="light">
                          Vinculado
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        {draft.proprietario.email || '-'} | {draft.proprietario.phone || '-'}
                      </Text>
                    </Stack>
                    <Button
                      size="xs"
                      color="red"
                      variant="light"
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, proprietario: null }))
                      }
                    >
                      Remover
                    </Button>
                  </Group>
                </Card>
              ) : null}

              <TextInput
                leftSection={<IconSearch size={14} />}
                placeholder="Buscar pessoa por nome, email ou telefone"
                value={ownerQuery}
                onChange={(event) => setOwnerQuery(event.currentTarget?.value ?? '')}
              />

              <ScrollArea h={180}>
                <Stack gap="xs">
                  {!userId ? (
                    <Text size="sm" c="dimmed">
                      Usuário não identificado para carregar pessoas.
                    </Text>
                  ) : loadingClients ? (
                    <Text size="sm" c="dimmed">
                      Carregando pessoas...
                    </Text>
                  ) : filteredClients.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      Nenhuma pessoa encontrada.
                    </Text>
                  ) : (
                    filteredClients.map((client) => (
                      <Card key={client.id} withBorder radius="md" p="xs">
                        <Group justify="space-between" align="center">
                          <Stack gap={0}>
                            <Text fw={600}>{client.nome}</Text>
                            <Text size="xs" c="dimmed">
                              {client.contact.email || '-'} | {client.contact.phone || '-'}
                            </Text>
                          </Stack>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                proprietario: {
                                  client_id: client.id,
                                  nome: client.nome,
                                  email: client.contact.email,
                                  phone: client.contact.phone,
                                  address: client.contact.address,
                                },
                              }))
                            }
                          >
                            Vincular
                          </Button>
                        </Group>
                      </Card>
                    ))
                  )}
                </Stack>
              </ScrollArea>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="documentos" pt="xs">
            <Stack gap="xs">
              <TextInput
                label="CAR"
                value={draft.documentos.car ?? ''}
                onChange={(event) => {
                  const nextValue = event.currentTarget?.value ?? '';
                  setDraft((prev) => ({
                    ...prev,
                    documentos: { ...prev.documentos, car: nextValue },
                  }));
                }}
              />
              <TextInput
                label="ITR"
                value={draft.documentos.itr ?? ''}
                onChange={(event) => {
                  const nextValue = event.currentTarget?.value ?? '';
                  setDraft((prev) => ({
                    ...prev,
                    documentos: { ...prev.documentos, itr: nextValue },
                  }));
                }}
              />
              <TextInput
                label="CCIR"
                value={draft.documentos.ccir ?? ''}
                onChange={(event) => {
                  const nextValue = event.currentTarget?.value ?? '';
                  setDraft((prev) => ({
                    ...prev,
                    documentos: { ...prev.documentos, ccir: nextValue },
                  }));
                }}
              />
              <TextInput
                label="RGI"
                value={draft.documentos.rgi ?? ''}
                onChange={(event) => {
                  const nextValue = event.currentTarget?.value ?? '';
                  setDraft((prev) => ({
                    ...prev,
                    documentos: { ...prev.documentos, rgi: nextValue },
                  }));
                }}
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="fiscal" pt="xs">
            <Stack gap="xs">
              <Text fw={600} size="sm">
                Cartao CNPJ e CNAEs
              </Text>
              <Group grow>
                <TextInput
                  label="CNPJ"
                  placeholder="00.000.000/0000-00"
                  value={draft.fiscal.cnpj}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, cnpj: nextValue },
                    }));
                  }}
                />
                <TextInput
                  label="Razão social"
                  value={draft.fiscal.razao_social}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, razao_social: nextValue },
                    }));
                  }}
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Nome fantasia"
                  value={draft.fiscal.nome_fantasia}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, nome_fantasia: nextValue },
                    }));
                  }}
                />
                <TextInput
                  label="Situacao cadastral"
                  value={draft.fiscal.situacao_cadastral}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, situacao_cadastral: nextValue },
                    }));
                  }}
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Data de abertura"
                  placeholder="DD/MM/AAAA"
                  value={draft.fiscal.data_abertura}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, data_abertura: nextValue },
                    }));
                  }}
                />
                <TextInput
                  label="Natureza juridica"
                  value={draft.fiscal.natureza_juridica}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, natureza_juridica: nextValue },
                    }));
                  }}
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Porte"
                  value={draft.fiscal.porte}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, porte: nextValue },
                    }));
                  }}
                />
                <NumberInput
                  label="Capital social"
                  min={0}
                  decimalScale={2}
                  value={draft.fiscal.capital_social}
                  onChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: {
                        ...prev.fiscal,
                        capital_social: value == null ? '' : String(value),
                      },
                    }))
                  }
                />
              </Group>

              <Textarea
                label="CNAEs"
                description="Informe um por linha (ou separado por virgula/;)."
                minRows={3}
                value={draft.fiscal.cnaes}
                onChange={(event) => {
                  const nextValue = event.currentTarget?.value ?? '';
                  setDraft((prev) => ({
                    ...prev,
                    fiscal: { ...prev.fiscal, cnaes: nextValue },
                  }));
                }}
              />

              <Text fw={600} size="sm">
                Parametros para emissao de NFe
              </Text>

              <Group grow>
                <TextInput
                  label="Inscricao estadual"
                  value={draft.fiscal.inscricao_estadual}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: {
                        ...prev.fiscal,
                        inscricao_estadual: nextValue,
                      },
                    }));
                  }}
                />
                <TextInput
                  label="Inscricao municipal"
                  value={draft.fiscal.inscricao_municipal}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: {
                        ...prev.fiscal,
                        inscricao_municipal: nextValue,
                      },
                    }));
                  }}
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Regime tributario"
                  value={draft.fiscal.regime_tributario}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: {
                        ...prev.fiscal,
                        regime_tributario: nextValue,
                      },
                    }));
                  }}
                />
                <NumberInput
                  label="Aliquota ICMS (%)"
                  min={0}
                  max={100}
                  decimalScale={2}
                  value={draft.fiscal.aliquota_icms}
                  onChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: {
                        ...prev.fiscal,
                        aliquota_icms: value == null ? '' : String(value),
                      },
                    }))
                  }
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Código do municipio (IBGE)"
                  value={draft.fiscal.codigo_municipio}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: {
                        ...prev.fiscal,
                        codigo_municipio: nextValue,
                      },
                    }));
                  }}
                />
                <TextInput
                  label="Serie da NFe"
                  value={draft.fiscal.serie}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, serie: nextValue },
                    }));
                  }}
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Último número NFe emitida"
                  value={draft.fiscal.ultima_nf_emitida}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: {
                        ...prev.fiscal,
                        ultima_nf_emitida: nextValue,
                      },
                    }));
                  }}
                />
                <TextInput
                  label="Token NFe"
                  value={draft.fiscal.token}
                  onChange={(event) => {
                    const nextValue = event.currentTarget?.value ?? '';
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, token: nextValue },
                    }));
                  }}
                />
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="areas" pt="xs">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Lance as áreas por categoria para o sistema consolidar subtotal por
                categoria e o total geral da propriedade.
              </Text>
              <Text size="xs" c="dimmed">
                A categoria Talhões é calculada automaticamente com base nos talhões
                cadastrados nesta propriedade.
              </Text>

              <Group align="end" grow>
                <Select
                  label="Categoria"
                  placeholder="Selecione a categoria"
                  data={areaCategoryOptions}
                  value={areaDraftCategoryId}
                  searchable
                  nothingFoundMessage="Nenhuma categoria ativa"
                  onChange={setAreaDraftCategoryId}
                />
                <NumberInput
                  label="Área (ha)"
                  min={0}
                  decimalScale={2}
                  value={areaDraftValue}
                  onChange={(value) =>
                    setAreaDraftValue(value == null || value === '' ? '' : Number(value))
                  }
                />
                <Button
                  onClick={addAreaAllocation}
                  leftSection={<IconPlus size={14} />}
                  disabled={!selectedAreaCategory || parsedAreaDraftValue == null}
                >
                  Adicionar
                </Button>
              </Group>

              <Group gap="sm">
                <Badge color="cyan" variant="light">
                  {`Categorias com área: ${areaTotalByCategory.length}`}
                </Badge>
                <Badge color="green" variant="light">
                  {`Total geral: ${areaTotalGeral.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} ha`}
                </Badge>
              </Group>

              {!hasAreaSummary ? (
                <Text size="sm" c="dimmed">
                  Nenhuma área cadastrada no resumo.
                </Text>
              ) : (
                <Stack gap="xs">
                  {areaTotalByCategory.map((group) => {
                    const isAutomaticTalhoes = group.category_id === 'talhoes';
                    const rows = draft.area_allocations.filter(
                      (item) =>
                        (item.category_id || item.category_name) === group.category_id,
                    );
                    return (
                      <Card key={group.category_id} withBorder radius="md" p="xs">
                        <Group justify="space-between" mb="xs">
                          <Text fw={700}>{group.category_name}</Text>
                          <Badge color="blue" variant="light">
                            {`${group.total.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} ha`}
                          </Badge>
                        </Group>
                        <Stack gap={6}>
                          {isAutomaticTalhoes ? (
                            <Text size="sm" c="dimmed">
                              Total calculado automaticamente dos talhões cadastrados.
                            </Text>
                          ) : (
                            rows.map((item) => (
                              <Group key={item.id} justify="space-between" wrap="nowrap">
                                <Text size="sm">
                                  {`${(parseOptionalNumber(item.area_ha) ?? 0).toLocaleString(
                                    'pt-BR',
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    },
                                  )} ha`}
                                </Text>
                                <ActionIcon
                                  color="red"
                                  variant="light"
                                  onClick={() => removeAreaAllocation(item.id)}
                                  aria-label="Remover area"
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Group>
                            ))
                          )}
                        </Stack>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>

        </Tabs>

        <Group justify="flex-end">
          <Button variant="light" color="gray" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={Boolean(draftNameError)}>
            {mode === 'create' ? 'Salvar propriedade' : 'Salvar alteracoes'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
