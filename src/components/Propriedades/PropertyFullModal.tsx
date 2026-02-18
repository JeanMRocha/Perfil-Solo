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
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { listClientsByUser, type ClientRecord } from '../../services/clientsService';
import type { ContactInfo } from '../../types/contact';
import type {
  Property,
  PropertyDocuments,
  PropertyFiscalData,
  PropertyGalpao,
  PropertyMachine,
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
};

type PropertyMachineDraft = {
  id: string;
  nome: string;
  tipo: string;
  valor: string;
};

type PropertyGalpaoDraft = {
  id: string;
  nome: string;
  area_construida_m2: string;
  valor: string;
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
  maquinas: PropertyMachineDraft[];
  galpoes: PropertyGalpaoDraft[];
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

function normalizeContact(contact: ContactInfo): ContactInfo | undefined {
  const normalized: ContactInfo = {
    email: toText(contact.email),
    phone: toText(contact.phone),
    address: toText(contact.address),
  };
  if (!normalized.email && !normalized.phone && !normalized.address) {
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

function mapMachinesDraft(input: PropertyMachine[] | undefined): PropertyMachineDraft[] {
  if (!input || input.length === 0) return [];
  return input.map((item) => ({
    id: item.id || createLocalId('machine'),
    nome: item.nome ?? '',
    tipo: item.tipo ?? '',
    valor: numberToText(item.valor),
  }));
}

function mapGalpoesDraft(input: PropertyGalpao[] | undefined): PropertyGalpaoDraft[] {
  if (!input || input.length === 0) return [];
  return input.map((item) => ({
    id: item.id || createLocalId('galpao'),
    nome: item.nome ?? '',
    area_construida_m2: numberToText(item.area_construida_m2),
    valor: numberToText(item.valor),
  }));
}

function buildInitialDraft(property?: Property | null): PropertyFormDraft {
  const fiscal = property?.fiscal;
  const fiscalCard = fiscal?.cartao_cnpj;
  const fiscalNfe = fiscal?.nfe;

  return {
    nome: property?.nome ?? '',
    cidade: property?.cidade ?? '',
    estado: property?.estado ?? '',
    total_area: numberToText(property?.total_area),
    contato: property?.contato_detalhes ?? {},
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
    maquinas: mapMachinesDraft(property?.maquinas),
    galpoes: mapGalpoesDraft(property?.galpoes),
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
}: PropertyFullModalProps) {
  const [draft, setDraft] = useState<PropertyFormDraft>(buildInitialDraft(property));
  const [ownerQuery, setOwnerQuery] = useState('');
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setDraft(buildInitialDraft(property));
    setOwnerQuery('');
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

  const filteredClients = useMemo(
    () => clients.filter((client) => matchesClient(client, ownerQuery)),
    [clients, ownerQuery],
  );

  const draftNameError = useMemo(() => {
    if (!opened) return null;
    if (draft.nome.trim().length < 3) return 'Use pelo menos 3 caracteres.';
    return null;
  }, [draft.nome, opened]);

  const addMachineRow = () => {
    setDraft((prev) => ({
      ...prev,
      maquinas: [
        ...prev.maquinas,
        { id: createLocalId('machine'), nome: '', tipo: '', valor: '' },
      ],
    }));
  };

  const addGalpaoRow = () => {
    setDraft((prev) => ({
      ...prev,
      galpoes: [
        ...prev.galpoes,
        {
          id: createLocalId('galpao'),
          nome: '',
          area_construida_m2: '',
          valor: '',
        },
      ],
    }));
  };

  const handleSave = async () => {
    const nome = draft.nome.trim();
    if (nome.length < 3) return;

    const contact = normalizeContact(draft.contato);
    const documents = normalizeDocuments(draft.documentos);
    const fiscal = normalizeFiscal(draft.fiscal);

    const maquinas: PropertyMachine[] = draft.maquinas
      .map((item) => ({
        id: item.id,
        nome: item.nome.trim(),
        tipo: toText(item.tipo),
        valor: parseOptionalNumber(item.valor),
      }))
      .filter((item) => item.nome.length > 0);

    const galpoes: PropertyGalpao[] = draft.galpoes
      .map((item) => ({
        id: item.id,
        nome: item.nome.trim(),
        area_construida_m2: parseOptionalNumber(item.area_construida_m2),
        valor: parseOptionalNumber(item.valor),
      }))
      .filter((item) => item.nome.length > 0);

    await onSubmit({
      nome,
      contact,
      patch: {
        cidade: toText(draft.cidade) || undefined,
        estado: toText(draft.estado) || undefined,
        total_area: parseOptionalNumber(draft.total_area),
        contato_detalhes: contact,
        proprietario_principal: draft.proprietario ?? null,
        documentos: documents,
        fiscal,
        maquinas: maquinas.length > 0 ? maquinas : undefined,
        galpoes: galpoes.length > 0 ? galpoes : undefined,
      },
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="xl"
      title={mode === 'create' ? 'Cadastrar propriedade' : 'Editar propriedade'}
    >
      <Stack gap="sm">
        <Tabs defaultValue="gerais">
          <Tabs.List>
            <Tabs.Tab value="gerais">Gerais</Tabs.Tab>
            <Tabs.Tab value="proprietario">Proprietario</Tabs.Tab>
            <Tabs.Tab value="documentos">Documentos</Tabs.Tab>
            <Tabs.Tab value="fiscal">Fiscal NFe</Tabs.Tab>
            <Tabs.Tab value="maquinas">Maquinas</Tabs.Tab>
            <Tabs.Tab value="galpoes">Galpoes</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="gerais" pt="sm">
            <Stack gap="sm">
              <TextInput
                label="Nome da propriedade"
                value={draft.nome}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, nome: event.currentTarget.value }))
                }
                error={draftNameError}
                data-autofocus
              />
              <Group grow>
                <TextInput
                  label="Cidade"
                  value={draft.cidade}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, cidade: event.currentTarget.value }))
                  }
                />
                <TextInput
                  label="Estado"
                  value={draft.estado}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, estado: event.currentTarget.value }))
                  }
                />
                <NumberInput
                  label="Area total (ha)"
                  value={draft.total_area}
                  min={0}
                  decimalScale={2}
                  onChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      total_area: value == null ? '' : String(value),
                    }))
                  }
                />
              </Group>

              <Text fw={600} size="sm">
                Contato da propriedade
              </Text>
              <Group grow>
                <TextInput
                  label="Email"
                  value={draft.contato.email ?? ''}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      contato: { ...prev.contato, email: event.currentTarget.value },
                    }))
                  }
                />
                <TextInput
                  label="Telefone"
                  value={draft.contato.phone ?? ''}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      contato: { ...prev.contato, phone: event.currentTarget.value },
                    }))
                  }
                />
              </Group>
              <TextInput
                label="Endereco"
                value={draft.contato.address ?? ''}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    contato: { ...prev.contato, address: event.currentTarget.value },
                  }))
                }
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="proprietario" pt="sm">
            <Stack gap="sm">
              {draft.proprietario ? (
                <Card withBorder radius="md" p="sm">
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
                onChange={(event) => setOwnerQuery(event.currentTarget.value)}
              />

              <ScrollArea h={220}>
                <Stack gap="xs">
                  {!userId ? (
                    <Text size="sm" c="dimmed">
                      Usuario nao identificado para carregar pessoas.
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

          <Tabs.Panel value="documentos" pt="sm">
            <Stack gap="sm">
              <TextInput
                label="CAR"
                value={draft.documentos.car ?? ''}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    documentos: { ...prev.documentos, car: event.currentTarget.value },
                  }))
                }
              />
              <TextInput
                label="ITR"
                value={draft.documentos.itr ?? ''}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    documentos: { ...prev.documentos, itr: event.currentTarget.value },
                  }))
                }
              />
              <TextInput
                label="CCIR"
                value={draft.documentos.ccir ?? ''}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    documentos: { ...prev.documentos, ccir: event.currentTarget.value },
                  }))
                }
              />
              <TextInput
                label="RGI"
                value={draft.documentos.rgi ?? ''}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    documentos: { ...prev.documentos, rgi: event.currentTarget.value },
                  }))
                }
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="fiscal" pt="sm">
            <Stack gap="sm">
              <Text fw={600} size="sm">
                Cartao CNPJ e CNAEs
              </Text>
              <Group grow>
                <TextInput
                  label="CNPJ"
                  placeholder="00.000.000/0000-00"
                  value={draft.fiscal.cnpj}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, cnpj: event.currentTarget.value },
                    }))
                  }
                />
                <TextInput
                  label="Razao social"
                  value={draft.fiscal.razao_social}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, razao_social: event.currentTarget.value },
                    }))
                  }
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Nome fantasia"
                  value={draft.fiscal.nome_fantasia}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, nome_fantasia: event.currentTarget.value },
                    }))
                  }
                />
                <TextInput
                  label="Situacao cadastral"
                  value={draft.fiscal.situacao_cadastral}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, situacao_cadastral: event.currentTarget.value },
                    }))
                  }
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Data de abertura"
                  placeholder="DD/MM/AAAA"
                  value={draft.fiscal.data_abertura}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, data_abertura: event.currentTarget.value },
                    }))
                  }
                />
                <TextInput
                  label="Natureza juridica"
                  value={draft.fiscal.natureza_juridica}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, natureza_juridica: event.currentTarget.value },
                    }))
                  }
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Porte"
                  value={draft.fiscal.porte}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, porte: event.currentTarget.value },
                    }))
                  }
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
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    fiscal: { ...prev.fiscal, cnaes: event.currentTarget.value },
                  }))
                }
              />

              <Text fw={600} size="sm">
                Parametros para emissao de NFe
              </Text>

              <Group grow>
                <TextInput
                  label="Inscricao estadual"
                  value={draft.fiscal.inscricao_estadual}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: {
                        ...prev.fiscal,
                        inscricao_estadual: event.currentTarget.value,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Inscricao municipal"
                  value={draft.fiscal.inscricao_municipal}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: {
                        ...prev.fiscal,
                        inscricao_municipal: event.currentTarget.value,
                      },
                    }))
                  }
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Regime tributario"
                  value={draft.fiscal.regime_tributario}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: {
                        ...prev.fiscal,
                        regime_tributario: event.currentTarget.value,
                      },
                    }))
                  }
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
                  label="Codigo do municipio (IBGE)"
                  value={draft.fiscal.codigo_municipio}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: {
                        ...prev.fiscal,
                        codigo_municipio: event.currentTarget.value,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Serie da NFe"
                  value={draft.fiscal.serie}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, serie: event.currentTarget.value },
                    }))
                  }
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Ultimo numero NFe emitida"
                  value={draft.fiscal.ultima_nf_emitida}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: {
                        ...prev.fiscal,
                        ultima_nf_emitida: event.currentTarget.value,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Token NFe"
                  value={draft.fiscal.token}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      fiscal: { ...prev.fiscal, token: event.currentTarget.value },
                    }))
                  }
                />
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="maquinas" pt="sm">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Cadastre maquinas com tipo e valor.
                </Text>
                <Button size="xs" leftSection={<IconPlus size={14} />} onClick={addMachineRow}>
                  Adicionar maquina
                </Button>
              </Group>

              {draft.maquinas.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Nenhuma maquina adicionada.
                </Text>
              ) : (
                <Stack gap="xs">
                  {draft.maquinas.map((machine) => (
                    <Card key={machine.id} withBorder radius="md" p="xs">
                      <Group align="flex-end" wrap="nowrap">
                        <TextInput
                          label="Nome"
                          value={machine.nome}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              maquinas: prev.maquinas.map((item) =>
                                item.id === machine.id
                                  ? { ...item, nome: event.currentTarget.value }
                                  : item,
                              ),
                            }))
                          }
                          style={{ flex: 1 }}
                        />
                        <TextInput
                          label="Tipo"
                          value={machine.tipo}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              maquinas: prev.maquinas.map((item) =>
                                item.id === machine.id
                                  ? { ...item, tipo: event.currentTarget.value }
                                  : item,
                              ),
                            }))
                          }
                          style={{ flex: 1 }}
                        />
                        <NumberInput
                          label="Valor"
                          min={0}
                          decimalScale={2}
                          value={machine.valor}
                          onChange={(value) =>
                            setDraft((prev) => ({
                              ...prev,
                              maquinas: prev.maquinas.map((item) =>
                                item.id === machine.id
                                  ? { ...item, valor: value == null ? '' : String(value) }
                                  : item,
                              ),
                            }))
                          }
                          style={{ width: 140 }}
                        />
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              maquinas: prev.maquinas.filter(
                                (item) => item.id !== machine.id,
                              ),
                            }))
                          }
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

          <Tabs.Panel value="galpoes" pt="sm">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Cadastre galpoes com area construida e valor.
                </Text>
                <Button size="xs" leftSection={<IconPlus size={14} />} onClick={addGalpaoRow}>
                  Adicionar galpao
                </Button>
              </Group>

              {draft.galpoes.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Nenhum galpao adicionado.
                </Text>
              ) : (
                <Stack gap="xs">
                  {draft.galpoes.map((galpao) => (
                    <Card key={galpao.id} withBorder radius="md" p="xs">
                      <Group align="flex-end" wrap="nowrap">
                        <TextInput
                          label="Nome"
                          value={galpao.nome}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              galpoes: prev.galpoes.map((item) =>
                                item.id === galpao.id
                                  ? { ...item, nome: event.currentTarget.value }
                                  : item,
                              ),
                            }))
                          }
                          style={{ flex: 1 }}
                        />
                        <NumberInput
                          label="Area construida (m2)"
                          min={0}
                          decimalScale={2}
                          value={galpao.area_construida_m2}
                          onChange={(value) =>
                            setDraft((prev) => ({
                              ...prev,
                              galpoes: prev.galpoes.map((item) =>
                                item.id === galpao.id
                                  ? {
                                      ...item,
                                      area_construida_m2:
                                        value == null ? '' : String(value),
                                    }
                                  : item,
                              ),
                            }))
                          }
                          style={{ width: 180 }}
                        />
                        <NumberInput
                          label="Valor"
                          min={0}
                          decimalScale={2}
                          value={galpao.valor}
                          onChange={(value) =>
                            setDraft((prev) => ({
                              ...prev,
                              galpoes: prev.galpoes.map((item) =>
                                item.id === galpao.id
                                  ? { ...item, valor: value == null ? '' : String(value) }
                                  : item,
                              ),
                            }))
                          }
                          style={{ width: 140 }}
                        />
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              galpoes: prev.galpoes.filter(
                                (item) => item.id !== galpao.id,
                              ),
                            }))
                          }
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
