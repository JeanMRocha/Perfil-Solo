import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  listLocalCultureProfiles,
  type LocalCultureProduct,
  type LocalCultureProfile,
  upsertLocalCultureProfile,
} from '../../services/cultureProfilesService';

interface ProdutosManagerProps {
  startInCreateMode?: boolean;
}

interface ProductDraft {
  id?: string;
  nome: string;
  sku: string;
  valor_unitario: number | '';
  unidade_comercial: string;
  ncm: string;
  cfop: string;
  observacoes: string;
  profile_id: string;
}

interface FlatProductRow {
  profile_id: string;
  profile_label: string;
  product: LocalCultureProduct;
}

function createProductId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `product-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function optionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function optionalNumber(value: number | ''): number | null {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toProfileLabel(profile: LocalCultureProfile): string {
  return profile.variedade
    ? `${profile.cultura} / ${profile.variedade}`
    : profile.cultura;
}

function toEmptyDraft(profileId = ''): ProductDraft {
  return {
    nome: '',
    sku: '',
    valor_unitario: '',
    unidade_comercial: '',
    ncm: '',
    cfop: '',
    observacoes: '',
    profile_id: profileId,
  };
}

function persistProfileProducts(
  profile: LocalCultureProfile,
  products: LocalCultureProduct[],
) {
  upsertLocalCultureProfile({
    id: profile.id,
    cultura: profile.cultura,
    variedade: profile.variedade ?? null,
    estado: profile.estado ?? null,
    cidade: profile.cidade ?? null,
    extrator: profile.extrator ?? null,
    estagio: profile.estagio ?? null,
    idade_min: profile.idade_min ?? null,
    idade_max: profile.idade_max ?? null,
    ideal: profile.ideal,
    observacoes: profile.observacoes ?? null,
    produtos: products,
    ruleset_version: profile.ruleset_version ?? 'local-v1',
  });
}

export default function ProdutosManager({
  startInCreateMode = false,
}: ProdutosManagerProps) {
  const [profiles, setProfiles] = useState<LocalCultureProfile[]>(() =>
    listLocalCultureProfiles(),
  );
  const [searchValue, setSearchValue] = useState('');
  const [profileFilter, setProfileFilter] = useState<string>('all');
  const [modalOpened, setModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(() =>
    toEmptyDraft(profiles[0]?.id ?? ''),
  );
  const [sourceProfileId, setSourceProfileId] = useState<string | null>(null);
  const [baseProduct, setBaseProduct] = useState<LocalCultureProduct | null>(null);
  const [createOpenedOnce, setCreateOpenedOnce] = useState(false);

  useEffect(() => {
    setProfiles(listLocalCultureProfiles());
  }, []);

  useEffect(() => {
    if (!startInCreateMode || createOpenedOnce) return;
    if (profiles.length === 0) return;
    setCreateOpenedOnce(true);
    setBaseProduct(null);
    setSourceProfileId(null);
    setDraft(toEmptyDraft(profiles[0]?.id ?? ''));
    setModalOpened(true);
  }, [startInCreateMode, createOpenedOnce, profiles]);

  const profileOptions = useMemo(
    () =>
      profiles.map((profile) => ({
        value: profile.id,
        label: toProfileLabel(profile),
      })),
    [profiles],
  );

  const allProductRows = useMemo<FlatProductRow[]>(() => {
    const rows: FlatProductRow[] = [];
    profiles.forEach((profile) => {
      const label = toProfileLabel(profile);
      (profile.produtos ?? []).forEach((product) => {
        rows.push({
          profile_id: profile.id,
          profile_label: label,
          product,
        });
      });
    });
    return rows;
  }, [profiles]);

  const filteredRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return allProductRows.filter((row) => {
      if (profileFilter !== 'all' && row.profile_id !== profileFilter) return false;
      if (!query) return true;
      const productName = row.product.nome?.toLowerCase() ?? '';
      const sku = row.product.sku?.toLowerCase() ?? '';
      const cultureLabel = row.profile_label.toLowerCase();
      return (
        productName.includes(query) ||
        sku.includes(query) ||
        cultureLabel.includes(query)
      );
    });
  }, [allProductRows, profileFilter, searchValue]);

  const reload = () => {
    setProfiles(listLocalCultureProfiles());
  };

  const openCreate = () => {
    if (profiles.length === 0) {
      notifications.show({
        title: 'Sem culturas cadastradas',
        message: 'Cadastre uma cultura antes de adicionar produtos.',
        color: 'yellow',
      });
      return;
    }
    setBaseProduct(null);
    setSourceProfileId(null);
    setDraft(toEmptyDraft(profiles[0]?.id ?? ''));
    setModalOpened(true);
  };

  const openEdit = (row: FlatProductRow) => {
    setSourceProfileId(row.profile_id);
    setBaseProduct(row.product);
    setDraft({
      id: row.product.id,
      nome: row.product.nome ?? '',
      sku: row.product.sku ?? '',
      valor_unitario:
        row.product.valor_unitario == null || !Number.isFinite(row.product.valor_unitario)
          ? ''
          : row.product.valor_unitario,
      unidade_comercial: row.product.fiscal?.unidade_comercial ?? '',
      ncm: row.product.fiscal?.ncm ?? '',
      cfop: row.product.fiscal?.cfop ?? '',
      observacoes: row.product.observacoes ?? '',
      profile_id: row.profile_id,
    });
    setModalOpened(true);
  };

  const handleDelete = (row: FlatProductRow) => {
    const confirmed = window.confirm('Excluir este produto da cultura selecionada?');
    if (!confirmed) return;
    const profile = profiles.find((item) => item.id === row.profile_id);
    if (!profile) return;
    const nextProducts = (profile.produtos ?? []).filter(
      (item) => item.id !== row.product.id,
    );
    persistProfileProducts(profile, nextProducts);
    reload();
    notifications.show({
      title: 'Produto removido',
      message: 'Cadastro excluido com sucesso.',
      color: 'green',
    });
  };

  const handleSave = () => {
    const selectedProfile = profiles.find((item) => item.id === draft.profile_id);
    if (!selectedProfile) {
      notifications.show({
        title: 'Cultura obrigatoria',
        message: 'Selecione a cultura para vincular o produto.',
        color: 'yellow',
      });
      return;
    }

    const productName = draft.nome.trim();
    if (productName.length < 2) {
      notifications.show({
        title: 'Nome invalido',
        message: 'Informe pelo menos 2 caracteres no nome do produto.',
        color: 'yellow',
      });
      return;
    }

    try {
      setSaving(true);
      const baseFiscal = baseProduct?.fiscal ?? {};
      const mergedFiscal = {
        ...baseFiscal,
        unidade_comercial: optionalText(draft.unidade_comercial),
        ncm: optionalText(draft.ncm),
        cfop: optionalText(draft.cfop),
      };
      const hasFiscal = Object.values(mergedFiscal).some((value) => value != null);

      const normalizedProduct: LocalCultureProduct = {
        id: draft.id ?? createProductId(),
        nome: productName,
        sku: optionalText(draft.sku),
        valor_unitario: optionalNumber(draft.valor_unitario),
        observacoes: optionalText(draft.observacoes),
        fiscal: hasFiscal ? mergedFiscal : undefined,
      };

      const sourceProfile = sourceProfileId
        ? profiles.find((item) => item.id === sourceProfileId) ?? null
        : null;

      if (sourceProfile && draft.id) {
        const sourceWithoutItem = (sourceProfile.produtos ?? []).filter(
          (item) => item.id !== draft.id,
        );
        if (sourceProfile.id !== selectedProfile.id) {
          persistProfileProducts(sourceProfile, sourceWithoutItem);
        }
      }

      const targetBase =
        sourceProfile && sourceProfile.id === selectedProfile.id
          ? (selectedProfile.produtos ?? []).filter((item) => item.id !== draft.id)
          : [...(selectedProfile.produtos ?? [])];
      const targetProducts = [...targetBase, normalizedProduct];
      persistProfileProducts(selectedProfile, targetProducts);

      reload();
      setModalOpened(false);
      notifications.show({
        title: 'Produto salvo',
        message: 'Cadastro atualizado com sucesso.',
        color: 'green',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack>
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        centered
        title={draft.id ? 'Editar produto' : 'Novo produto'}
      >
        <Stack gap="sm">
          <Select
            label="Cultura vinculada"
            data={profileOptions}
            value={draft.profile_id || null}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, profile_id: value ?? '' }))
            }
            searchable
            nothingFoundMessage="Nenhuma cultura cadastrada"
          />
          <TextInput
            label="Nome do produto"
            value={draft.nome}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, nome: event.currentTarget.value }))
            }
          />
          <Group grow>
            <TextInput
              label="SKU"
              value={draft.sku}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, sku: event.currentTarget.value }))
              }
            />
            <NumberInput
              label="Valor unitario"
              value={draft.valor_unitario}
              min={0}
              decimalScale={2}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  valor_unitario:
                    Number.isFinite(Number(value)) && value !== ''
                      ? Number(value)
                      : '',
                }))
              }
            />
          </Group>
          <Group grow>
            <TextInput
              label="Unidade comercial"
              value={draft.unidade_comercial}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  unidade_comercial: event.currentTarget.value,
                }))
              }
            />
            <TextInput
              label="NCM"
              value={draft.ncm}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, ncm: event.currentTarget.value }))
              }
            />
            <TextInput
              label="CFOP"
              value={draft.cfop}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, cfop: event.currentTarget.value }))
              }
            />
          </Group>
          <TextInput
            label="Observacoes"
            value={draft.observacoes}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, observacoes: event.currentTarget.value }))
            }
          />
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => setModalOpened(false)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={handleSave}>
              Salvar produto
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Card withBorder>
        <Stack>
          <Group justify="space-between">
            <Text fw={700}>Busca de Produtos</Text>
            <Button onClick={openCreate}>Novo produto</Button>
          </Group>
          <Group grow>
            <TextInput
              label="Buscar"
              placeholder="Nome, SKU ou cultura"
              value={searchValue}
              onChange={(event) => setSearchValue(event.currentTarget.value)}
            />
            <Select
              label="Cultura"
              data={[{ value: 'all', label: 'Todas' }, ...profileOptions]}
              value={profileFilter}
              onChange={(value) => setProfileFilter(value ?? 'all')}
            />
          </Group>
        </Stack>
      </Card>

      <Card withBorder>
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <Badge color="indigo">{filteredRows.length} encontrados</Badge>
            <Badge color="teal">{allProductRows.length} no total</Badge>
          </Group>
        </Group>
        {filteredRows.length === 0 ? (
          <Text c="dimmed" size="sm">
            Nenhum produto encontrado.
          </Text>
        ) : (
          <Table highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Cultura</Table.Th>
                <Table.Th>SKU</Table.Th>
                <Table.Th>Valor</Table.Th>
                <Table.Th>Acoes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredRows.map((row) => (
                <Table.Tr key={`${row.profile_id}-${row.product.id}`}>
                  <Table.Td>{row.product.nome}</Table.Td>
                  <Table.Td>{row.profile_label}</Table.Td>
                  <Table.Td>{row.product.sku ?? '-'}</Table.Td>
                  <Table.Td>
                    {row.product.valor_unitario != null
                      ? row.product.valor_unitario.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : '-'}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" variant="light" onClick={() => openEdit(row)}>
                        Editar
                      </Button>
                      <Button
                        size="xs"
                        color="red"
                        variant="light"
                        onClick={() => handleDelete(row)}
                      >
                        Excluir
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
