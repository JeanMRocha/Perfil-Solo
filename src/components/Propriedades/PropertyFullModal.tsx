import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  X,
} from 'lucide-react';
import {
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
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
  contato: ContactFormDraft;
  proprietario: PropertyOwnerRef | null;
  documentos: PropertyDocuments;
  fiscal: PropertyFiscalDraft;
  area_allocations: PropertyAreaAllocationDraft[];
};

type ContactFormDraft = Omit<ContactInfo, 'emails' | 'phones' | 'social_links' | 'addresses'> & {
  emails: ContactChannelDraft[];
  phones: ContactChannelDraft[];
  social_links: ContactSocialDraft[];
  addresses: ContactAddressDraft[];
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
    addresses: (addresses as any[]).length > 0 ? (addresses as any[]) : undefined,
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

    const contact = normalizeContact(draft.contato as any);
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
    <Dialog open={opened} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[960px] w-[98vw] sm:w-[92vw] overflow-hidden flex flex-col h-[94vh] max-h-[860px] p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b shrink-0 flex flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <DialogTitle>{mode === 'create' ? 'Cadastrar propriedade' : 'Editar propriedade'}</DialogTitle>
            <DialogDescription className="hidden">
              Preencha os dados da propriedade para salvar no sistema.
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Fechar</span>
          </Button>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-4 pt-2">
          <Tabs defaultValue="gerais" className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TabsList className="grid grid-cols-4 sm:grid-cols-7 h-auto mb-4 bg-slate-100 dark:bg-slate-900 p-1 shrink-0">
              <TabsTrigger value="gerais" className="text-[11px] py-1.5 px-2">Gerais</TabsTrigger>
              <TabsTrigger value="enderecos" className="text-[11px] py-1.5 px-2">Endereços</TabsTrigger>
              <TabsTrigger value="contatos" className="text-[11px] py-1.5 px-2">Contatos</TabsTrigger>
              <TabsTrigger value="proprietario" className="text-[11px] py-1.5 px-2 text-center">Dono</TabsTrigger>
              <TabsTrigger value="documentos" className="text-[11px] py-1.5 px-2">Docs</TabsTrigger>
              <TabsTrigger value="fiscal" className="text-[11px] py-1.5 px-2 whitespace-nowrap">Fiscal</TabsTrigger>
              <TabsTrigger value="areas" className="text-[11px] py-1.5 px-2">Áreas</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 -mx-2 px-2 overflow-y-auto">
              <div className="flex flex-col gap-4 pb-4">
                <TabsContent value="gerais" className="mt-0 outline-none">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="prop-nome" className={cn(draftNameError ? "text-red-500" : "")}>
                        Nome da propriedade
                      </Label>
                      <Input
                        id="prop-nome"
                        value={draft.nome}
                        onChange={(event) => {
                          const nextValue = event.currentTarget?.value ?? '';
                          setDraft((prev) => ({ ...prev, nome: nextValue }));
                        }}
                        placeholder="Ex: Fazenda Santa Maria"
                        className={cn(draftNameError ? "border-red-500 focus-visible:ring-red-500" : "")}
                        autoFocus
                      />
                      {draftNameError && (
                        <span className="text-[11px] font-medium text-red-500">{draftNameError}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="prop-area-total" className="text-slate-500">
                        Área total (ha)
                      </Label>
                      <Input
                        id="prop-area-total"
                        value={formatAreaHa(normalizedTalhoesArea)}
                        readOnly
                        className="bg-slate-50 dark:bg-slate-900 border-dashed"
                      />
                      <span className="text-[10px] text-slate-400 font-medium italic">
                        Calculada automaticamente pela soma dos talhões.
                      </span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="enderecos" className="mt-0 outline-none">
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Endereços cadastrados
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                        onClick={addAddressRow}
                      >
                        <IconPlus className="mr-1 h-3 w-3" />
                        Novo endereço
                      </Button>
                    </div>

                    {(draft.contato.addresses ?? []).length === 0 ? (
                      <div className="p-8 text-center text-slate-400 italic text-xs bg-slate-50/50 dark:bg-slate-900/20 border border-dashed rounded-lg">
                        Nenhum endereço cadastrado.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {(draft.contato.addresses ?? []).map((addr, idx) => (
                          <Card key={addr.id} className="relative border-slate-200 dark:border-slate-800 shadow-none overflow-hidden">
                            <CardHeader className="p-2 px-3 pb-0 flex flex-row items-center justify-between space-y-0 bg-slate-50/80 dark:bg-slate-900/80 border-b dark:border-slate-800">
                              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {idx === 0 ? 'Endereço Principal' : `Endereço Secundário ${idx}`}
                              </CardTitle>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => removeAddressRow(addr.id)}
                                disabled={(draft.contato.addresses?.length ?? 0) <= 1}
                              >
                                <IconTrash className="h-3.5 w-3.5" />
                              </Button>
                            </CardHeader>
                            <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2">
                              <div className="flex flex-col gap-1 sm:col-span-1">
                                <Label className="text-[10px] font-bold text-slate-500">Categoria / Nome</Label>
                                <Input
                                  value={addr.label ?? ''}
                                  placeholder="Ex: Matriz, Filial..."
                                  className="h-8 text-xs"
                                  onChange={(e) => updateAddressRow(addr.id, 'label', e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <Label className="text-[10px] font-bold text-slate-500">CEP</Label>
                                <div className="relative">
                                  <Input
                                    value={addr.cep}
                                    className={cn("h-8 text-xs pr-7", cepErrorsByAddress[addr.id] ? "border-red-500" : "")}
                                    onChange={(e) => updateAddressRow(addr.id, 'cep', formatCep(e.target.value))}
                                    onBlur={(e) => applyCepLookupToAddress(addr.id, e.target.value)}
                                  />
                                  {loadingCepAddressId === addr.id && (
                                    <Loader2 size={14} className="animate-spin absolute right-2 top-1.5 text-slate-400" />
                                  )}
                                </div>
                                {cepErrorsByAddress[addr.id] && (
                                  <span className="text-[9px] text-red-500 font-medium">{cepErrorsByAddress[addr.id]}</span>
                                )}
                              </div>
                              <div className="flex flex-col gap-1">
                                <Label className="text-[10px] font-bold text-slate-500">Estado (UF)</Label>
                                <Input
                                  value={addr.state}
                                  className="h-8 text-xs"
                                  onChange={(e) => updateAddressRow(addr.id, 'state', e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <Label className="text-[10px] font-bold text-slate-500">Cidade</Label>
                                <Input
                                  value={addr.city}
                                  className="h-8 text-xs"
                                  onChange={(e) => updateAddressRow(addr.id, 'city', e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1 sm:col-span-2">
                                <Label className="text-[10px] font-bold text-slate-500">Bairro / Distrito</Label>
                                <Input
                                  value={addr.neighborhood}
                                  className="h-8 text-xs"
                                  onChange={(e) => updateAddressRow(addr.id, 'neighborhood', e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1 sm:col-span-2 md:col-span-2">
                                <Label className="text-[10px] font-bold text-slate-500">Endereço / Logradouro</Label>
                                <Input
                                  value={addr.address}
                                  className="h-8 text-xs"
                                  onChange={(e) => updateAddressRow(addr.id, 'address', e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <Label className="text-[10px] font-bold text-slate-500">Número</Label>
                                <Input
                                  value={addr.address_number}
                                  className="h-8 text-xs"
                                  onChange={(e) => updateAddressRow(addr.id, 'address_number', e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1 sm:col-span-3">
                                <Label className="text-[10px] font-bold text-slate-500">Complemento</Label>
                                <Input
                                  value={addr.address_complement}
                                  className="h-8 text-xs"
                                  onChange={(e) => updateAddressRow(addr.id, 'address_complement', e.target.value)}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="contatos" className="mt-0 outline-none">
                  <div className="flex flex-col gap-6">
                    <section className="flex flex-col gap-3">
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">E-mails</h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                          onClick={() => addContactChannel('emails')}
                        >
                          <IconPlus className="mr-1 h-3 w-3" />
                          Novo e-mail
                        </Button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {(draft.contato.emails ?? []).length === 0 ? (
                          <div className="text-[10px] text-slate-400 italic text-center py-2">Nenhum e-mail.</div>
                        ) : (
                          draft.contato.emails?.map((email) => (
                            <div key={email.id} className="flex gap-2 items-end group">
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <Label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Etiqueta</Label>
                                  <Input
                                    value={email.label}
                                    className="h-8 text-xs bg-white dark:bg-slate-950"
                                    onChange={(e) => updateContactChannel('emails', email.id, 'label', e.target.value)}
                                    placeholder="Ex: Financeiro"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Label className="text-[9px] font-bold text-slate-400 uppercase ml-1">E-mail</Label>
                                  <Input
                                    type="email"
                                    value={email.value}
                                    className="h-8 text-xs bg-white dark:bg-slate-950"
                                    onChange={(e) => updateContactChannel('emails', email.id, 'value', e.target.value)}
                                  />
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-40 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeContactChannel('emails', email.id)}
                              >
                                <IconTrash className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="flex flex-col gap-3">
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Telefones</h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                          onClick={() => addContactChannel('phones')}
                        >
                          <IconPlus className="mr-1 h-3 w-3" />
                          Novo telefone
                        </Button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {(draft.contato.phones ?? []).length === 0 ? (
                          <div className="text-[10px] text-slate-400 italic text-center py-2">Nenhum telefone.</div>
                        ) : (
                          draft.contato.phones?.map((phone) => (
                            <div key={phone.id} className="flex gap-2 items-end group">
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <Label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Etiqueta</Label>
                                  <Input
                                    value={phone.label}
                                    className="h-8 text-xs bg-white dark:bg-slate-950"
                                    onChange={(e) => updateContactChannel('phones', phone.id, 'label', e.target.value)}
                                    placeholder="Ex: WhatsApp"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Número</Label>
                                  <Input
                                    value={formatPhoneForDisplay(phone.value)}
                                    className="h-8 text-xs bg-white dark:bg-slate-950"
                                    onChange={(e) => updateContactChannel('phones', phone.id, 'value', e.target.value)}
                                  />
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-40 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeContactChannel('phones', phone.id)}
                              >
                                <IconTrash className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="flex flex-col gap-3">
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Redes Sociais</h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                          onClick={addSocialLink}
                        >
                          <IconPlus className="mr-1 h-3 w-3" />
                          Nova rede
                        </Button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {(draft.contato.social_links ?? []).length === 0 ? (
                          <div className="text-[10px] text-slate-400 italic text-center py-2">Nenhuma rede.</div>
                        ) : (
                          draft.contato.social_links?.map((link) => (
                            <div key={link.id} className="flex gap-2 items-end group">
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <Label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Plataforma</Label>
                                  <Select
                                    value={link.network}
                                    onValueChange={(val) => updateSocialLink(link.id, 'network', val)}
                                  >
                                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950">
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SOCIAL_NETWORK_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Label className="text-[9px] font-bold text-slate-400 uppercase ml-1">URL / Perfil</Label>
                                  <Input
                                    value={link.url}
                                    className="h-8 text-xs bg-white dark:bg-slate-950"
                                    onChange={(e) => updateSocialLink(link.id, 'url', e.target.value)}
                                    placeholder="@usuario ou link"
                                  />
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-40 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeSocialLink(link.id)}
                              >
                                <IconTrash className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  </div>
                </TabsContent>

                <TabsContent value="proprietario" className="mt-0 outline-none">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Vincular Proprietário</h3>
                      <p className="text-[10px] text-slate-400 italic">Vincule esta propriedade a um cliente já cadastrado.</p>
                    </div>

                    {draft.proprietario && (
                      <Card className="border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/10 shadow-none ring-1 ring-indigo-500/10">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-xs">
                              {draft.proprietario.nome.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{draft.proprietario.nome}</span>
                              <Badge variant="outline" className="w-fit h-4 text-[9px] px-1 font-bold border-indigo-200 text-indigo-600 bg-white">PROPRIETÁRIO ATIVO</Badge>
                            </div>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-[10px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDraft((prev) => ({ ...prev, proprietario: null }))}
                          >
                            DESVINCULAR
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    <div className="relative">
                      <IconSearch className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Pesquisar por nome, e-mail ou telefone..."
                        value={ownerQuery}
                        onChange={(e) => setOwnerQuery(e.target.value)}
                        className="pl-9 h-9 text-xs"
                      />
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y dark:divide-slate-800 max-h-[180px] overflow-y-auto bg-slate-50/30 dark:bg-slate-900/10">
                      {loadingClients ? (
                        <div className="p-8 justify-center flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin text-indigo-500" />
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Buscando base...</span>
                        </div>
                      ) : filteredClients.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 italic text-xs">
                          Nenhum cliente disponível.
                        </div>
                      ) : (
                        filteredClients.map((client) => {
                          const isSelected = draft.proprietario?.client_id === client.id;
                          return (
                            <button
                              key={client.id}
                              type="button"
                              className={cn(
                                "w-full text-left p-3 hover:bg-white dark:hover:bg-slate-900/50 transition-colors flex items-center justify-between group",
                                isSelected ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""
                              )}
                              onClick={() => {
                                setDraft((prev) => ({
                                  ...prev,
                                  proprietario: isSelected
                                    ? null
                                    : { client_id: client.id, nome: client.nome },
                                }));
                              }}
                            >
                              <div className="flex flex-col">
                                <span className={cn("text-xs font-bold transition-colors", isSelected ? "text-indigo-600" : "text-slate-600 dark:text-slate-300 group-hover:text-slate-900")}>
                                  {client.nome}
                                </span>
                                <span className="text-[9px] text-slate-400 font-medium">{client.contact.email || 'N/D'} | {client.contact.phone || 'N/D'}</span>
                              </div>
                              {isSelected ? (
                                <Badge className="bg-indigo-600 h-5 text-[9px] font-black uppercase">Ativo</Badge>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-6 text-[9px] font-bold text-slate-400 group-hover:text-indigo-600">VINCULAR</Button>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="documentos" className="mt-0 outline-none">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1 border-b pb-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Documentação Rural</h3>
                      <p className="text-[10px] text-slate-400 italic">Identificadores oficiais da propriedade rural.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="doc-car" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">CAR (Ambiental Rural)</Label>
                        <Input
                          id="doc-car"
                          value={draft.documentos.car ?? ''}
                          className="h-10 text-xs shadow-sm bg-slate-50/30 dark:bg-slate-950"
                          placeholder="Ex: MG-1234567-..."
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              documentos: { ...prev.documentos, car: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="doc-itr" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">ITR (Imposto Rural)</Label>
                        <Input
                          id="doc-itr"
                          value={draft.documentos.itr ?? ''}
                          className="h-10 text-xs shadow-sm bg-slate-50/30 dark:bg-slate-950"
                          placeholder="NIRF"
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              documentos: { ...prev.documentos, itr: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="doc-ccir" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">CCIR (Certificado INCRA)</Label>
                        <Input
                          id="doc-ccir"
                          value={draft.documentos.ccir ?? ''}
                          className="h-10 text-xs shadow-sm bg-slate-50/30 dark:bg-slate-950"
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              documentos: { ...prev.documentos, ccir: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="doc-rgi" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Matrícula (RGI)</Label>
                        <Input
                          id="doc-rgi"
                          value={draft.documentos.rgi ?? ''}
                          className="h-10 text-xs shadow-sm bg-slate-50/30 dark:bg-slate-950"
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              documentos: { ...prev.documentos, rgi: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="fiscal" className="mt-0 outline-none">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1 border-b pb-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Dados Fiscais</h3>
                      <p className="text-[10px] text-slate-400 italic">Informações para faturamento e emissão de notas.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] font-bold text-slate-400 ml-1">CNPJ</Label>
                        <Input
                          value={draft.fiscal.cnpj}
                          onChange={(e) => setDraft(p => ({ ...p, fiscal: { ...p.fiscal, cnpj: e.target.value } }))}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] font-bold text-slate-400 ml-1">Razão Social</Label>
                        <Input
                          value={draft.fiscal.razao_social}
                          onChange={(e) => setDraft(p => ({ ...p, fiscal: { ...p.fiscal, razao_social: e.target.value } }))}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] font-bold text-slate-400 ml-1">Inscrição Estadual</Label>
                        <Input
                          value={draft.fiscal.inscricao_estadual}
                          onChange={(e) => setDraft(p => ({ ...p, fiscal: { ...p.fiscal, inscricao_estadual: e.target.value } }))}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] font-bold text-slate-400 ml-1">Inscrição Municipal</Label>
                        <Input
                          value={draft.fiscal.inscricao_municipal}
                          onChange={(e) => setDraft(p => ({ ...p, fiscal: { ...p.fiscal, inscricao_municipal: e.target.value } }))}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="text-[10px] font-bold text-slate-400 ml-1">CNAEs</Label>
                      <Textarea
                        value={draft.fiscal.cnaes}
                        placeholder="Informe os códigos CNAE..."
                        className="text-xs min-h-[80px]"
                        onChange={(e) => setDraft(p => ({ ...p, fiscal: { ...p.fiscal, cnaes: e.target.value } }))}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="areas" className="mt-0 outline-none">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1 border-b pb-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Resumo de Áreas</h3>
                      <p className="text-[10px] text-slate-400 italic">Lance as áreas por categoria para consolidar o total.</p>
                    </div>

                    <div className="flex flex-wrap gap-4 items-end bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                      <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
                        <Label className="text-[10px] font-black tracking-widest text-slate-400 uppercase ml-1">Categoria de Uso</Label>
                        <Select
                          value={areaDraftCategoryId || ""}
                          onValueChange={(val) => setAreaDraftCategoryId(val)}
                        >
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {areaCategoryOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-[120px] flex flex-col gap-1.5">
                        <Label className="text-[10px] font-black tracking-widest text-slate-400 uppercase ml-1">Área (ha)</Label>
                        <Input
                          type="number"
                          value={areaDraftValue}
                          className="h-10 text-xs text-center font-bold"
                          onChange={(e) => setAreaDraftValue(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>
                      <Button
                        onClick={addAreaAllocation}
                        className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase px-4 shadow-lg shadow-indigo-500/20"
                        disabled={!selectedAreaCategory || parsedAreaDraftValue == null}
                      >
                        <IconPlus className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50">
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Categorias</span>
                        <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{areaTotalByCategory.length}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/50 text-right">
                        <span className="text-[9px] font-black uppercase tracking-widest text-teal-500">Total Geral (ha)</span>
                        <span className="text-xl font-black text-teal-600 dark:text-teal-400">
                          {areaTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {!hasAreaSummary ? (
                        <div className="p-8 text-center text-slate-400 italic text-xs bg-slate-50/50 dark:bg-slate-900/10 border border-dashed rounded-lg">
                          Nenhuma área lançada.
                        </div>
                      ) : (
                        areaTotalByCategory.map((group) => {
                          const isAutomaticTalhoes = group.category_id === 'talhoes';
                          const rows = draft.area_allocations.filter(
                            (item) => (item.category_id || item.category_name) === group.category_id,
                          );
                          return (
                            <Card key={group.category_id} className="border-slate-200 dark:border-slate-800 shadow-none">
                              <div className="p-3">
                                <div className="flex justify-between items-center mb-2">
                                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">{group.category_name}</h4>
                                  <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-none h-5">
                                    {group.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ha
                                  </Badge>
                                </div>
                                <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-slate-100 dark:border-slate-800">
                                  {isAutomaticTalhoes ? (
                                    <span className="text-[10px] text-slate-400 italic">Consolidado automático dos talhões</span>
                                  ) : (
                                    rows.map((item) => (
                                      <div key={item.id} className="flex justify-between items-center group/item">
                                        <span className="text-[11px] font-medium text-slate-500">
                                          {(parseOptionalNumber(item.area_ha) ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ha
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 text-slate-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                          onClick={() => removeAreaAllocation(item.id)}
                                        >
                                          <IconTrash className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>

        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t flex items-center justify-between sm:justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className={cn("h-2 w-2 rounded-full", saving ? "bg-amber-500 animate-pulse" : "bg-teal-500")} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              {saving ? 'Sincronizando...' : 'Sistema Online'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-4 text-xs font-bold text-slate-500 border-slate-200 dark:border-slate-800"
              onClick={onClose}
              disabled={saving}
            >
              CANCELAR
            </Button>
            <Button
              size="sm"
              className="h-9 px-6 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs uppercase shadow-lg shadow-teal-500/20"
              onClick={handleSave}
              disabled={Boolean(draftNameError) || saving}
            >
              {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
              {mode === 'create' ? 'SALVAR PROPRIEDADE' : 'SALVAR ALTERAÇÕES'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
