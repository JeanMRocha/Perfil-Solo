import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  Badge,
  Button,
  Card,
  ColorInput,
  Container,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconEdit,
  IconMapPin,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import PageHeader from '../../components/PageHeader';
import PropertyFullModal, {
  type PropertyFullModalSubmitPayload,
} from '../../components/Propriedades/PropertyFullModal';
import TalhaoDetailModal from '../../components/Propriedades/TalhaoDetailModal';
import { $currUser } from '../../global-state/user';
import { isLocalDataMode } from '../../services/dataProvider';
import {
  createPropertyForUser,
  createTalhaoForProperty,
  deletePropertyForUser,
  deleteTalhaoForProperty,
  fetchOrCreateUserProperties,
  fetchTalhoesByProperty,
  fetchTalhoesByProperties,
  updatePropertyForUser,
  updateTalhaoForProperty,
} from '../../services/propertyMapService';
import type { Property, Talhao } from '../../types/property';

type PropertyRow = Property & { talhoesCount: number };
type PropertyModalMode = 'create' | 'edit';
type TalhaoModalMode = 'create' | 'edit';
type AreaSummaryRow = {
  categoryId: string;
  categoryName: string;
  areaHa: number;
};

const DEFAULT_TALHAO_COLOR = '#81C784';
const SKELETON_ROW_COUNT = 4;

function asOptionalNumber(value: number | string | null): number | undefined {
  if (value == null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function formatAreaHa(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Propriedades() {
  const user = useStore($currUser);
  const currentUserId = user?.id ?? (isLocalDataMode ? 'local-user' : null);

  const [loadingProperties, setLoadingProperties] = useState(true);
  const [loadingTalhoes, setLoadingTalhoes] = useState(false);
  const [propertiesLoadError, setPropertiesLoadError] = useState<string | null>(null);
  const [talhoesLoadError, setTalhoesLoadError] = useState<string | null>(null);

  const [propertyRows, setPropertyRows] = useState<PropertyRow[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedTalhaoId, setSelectedTalhaoId] = useState<string | null>(null);

  const [propertySearch, setPropertySearch] = useState('');
  const [talhaoSearch, setTalhaoSearch] = useState('');

  const [propertyModalMode, setPropertyModalMode] = useState<PropertyModalMode | null>(null);
  const [savingProperty, setSavingProperty] = useState(false);

  const [talhaoModalMode, setTalhaoModalMode] = useState<TalhaoModalMode | null>(null);
  const [talhaoDraft, setTalhaoDraft] = useState({
    nome: '',
    area_ha: '' as number | string,
    tipo_solo: '',
    color: DEFAULT_TALHAO_COLOR,
  });
  const [savingTalhao, setSavingTalhao] = useState(false);
  const [talhaoDetailOpened, setTalhaoDetailOpened] = useState(false);

  const loadProperties = useCallback(async () => {
    if (!currentUserId) {
      setPropertyRows([]);
      setSelectedPropertyId(null);
      setLoadingProperties(false);
      return;
    }

    setLoadingProperties(true);
    setPropertiesLoadError(null);
    try {
      const properties = await fetchOrCreateUserProperties(currentUserId);
      const allTalhoes = await fetchTalhoesByProperties(
        properties.map((property) => property.id),
      );
      const talhoesCountByProperty = new Map<string, number>();
      for (const talhao of allTalhoes) {
        talhoesCountByProperty.set(
          talhao.property_id,
          (talhoesCountByProperty.get(talhao.property_id) ?? 0) + 1,
        );
      }
      const withTalhoes = properties.map((property) => ({
        ...property,
        talhoesCount: talhoesCountByProperty.get(property.id) ?? 0,
      }));

      setPropertyRows(withTalhoes);
      setSelectedPropertyId((prev) => {
        if (prev && withTalhoes.some((row) => row.id === prev)) return prev;
        return withTalhoes[0]?.id ?? null;
      });
    } catch (err: any) {
      setPropertiesLoadError(
        err?.message ?? 'Nao foi possivel carregar as propriedades.',
      );
      notifications.show({
        title: 'Falha ao carregar propriedades',
        message: err?.message ?? 'Nao foi possivel carregar as propriedades.',
        color: 'red',
      });
    } finally {
      setLoadingProperties(false);
    }
  }, [currentUserId]);

  const loadTalhoes = useCallback(async () => {
    if (!selectedPropertyId) {
      setTalhoes([]);
      setSelectedTalhaoId(null);
      return;
    }

    setLoadingTalhoes(true);
    setTalhoesLoadError(null);
    try {
      const rows = await fetchTalhoesByProperty(selectedPropertyId);
      setTalhoes(rows);
      setSelectedTalhaoId((prev) => {
        if (prev && rows.some((row) => row.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (err: any) {
      setTalhoes([]);
      setTalhoesLoadError(
        err?.message ?? 'Nao foi possivel carregar os talhoes da propriedade.',
      );
      notifications.show({
        title: 'Falha ao carregar talhoes',
        message: err?.message ?? 'Nao foi possivel carregar os talhoes da propriedade.',
        color: 'red',
      });
    } finally {
      setLoadingTalhoes(false);
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    void loadTalhoes();
  }, [loadTalhoes]);

  const filteredProperties = useMemo(() => {
    const search = propertySearch.trim().toLowerCase();
    if (!search) return propertyRows;
    return propertyRows.filter((row) => row.nome.toLowerCase().includes(search));
  }, [propertyRows, propertySearch]);

  const filteredTalhoes = useMemo(() => {
    const search = talhaoSearch.trim().toLowerCase();
    if (!search) return talhoes;
    return talhoes.filter((row) => row.nome.toLowerCase().includes(search));
  }, [talhoes, talhaoSearch]);

  const selectedProperty = useMemo(
    () => propertyRows.find((row) => row.id === selectedPropertyId) ?? null,
    [propertyRows, selectedPropertyId],
  );

  const selectedTalhao = useMemo(
    () => talhoes.find((row) => row.id === selectedTalhaoId) ?? null,
    [talhoes, selectedTalhaoId],
  );

  const selectedPropertyTalhoesArea = useMemo(
    () =>
      talhoes.reduce((sum, row) => {
        if (selectedPropertyId && row.property_id !== selectedPropertyId) return sum;
        const area = Number(row.area_ha ?? 0);
        if (!Number.isFinite(area) || area <= 0) return sum;
        return sum + area;
      }, 0),
    [selectedPropertyId, talhoes],
  );

  const selectedPropertyAreaSummary = useMemo<AreaSummaryRow[]>(() => {
    const groups = new Map<string, AreaSummaryRow>();

    const allocations = selectedProperty?.area_allocations ?? [];
    for (const item of allocations) {
      const categoryId = String(item.category_id ?? '').trim();
      if (!categoryId || categoryId === 'talhoes') continue;

      const categoryName = String(item.category_name ?? '').trim() || 'Sem categoria';
      const areaValue = Number(item.area_ha ?? 0);
      if (!Number.isFinite(areaValue) || areaValue <= 0) continue;

      const current = groups.get(categoryId);
      if (current) {
        current.areaHa += areaValue;
      } else {
        groups.set(categoryId, {
          categoryId,
          categoryName,
          areaHa: areaValue,
        });
      }
    }

    if (selectedPropertyTalhoesArea > 0) {
      groups.set('talhoes', {
        categoryId: 'talhoes',
        categoryName: 'Talhoes',
        areaHa: selectedPropertyTalhoesArea,
      });
    }

    return [...groups.values()].sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName, 'pt-BR'),
    );
  }, [selectedProperty?.area_allocations, selectedPropertyTalhoesArea]);

  const selectedPropertyAreaTotal = useMemo(
    () =>
      selectedPropertyAreaSummary.reduce((sum, item) => sum + item.areaHa, 0),
    [selectedPropertyAreaSummary],
  );

  const openPropertyCreate = () => {
    setPropertyModalMode('create');
  };

  const openPropertyEdit = () => {
    if (!selectedProperty) return;
    setPropertyModalMode('edit');
  };

  const closePropertyModal = () => {
    if (savingProperty) return;
    setPropertyModalMode(null);
  };

  const saveProperty = async (payload: PropertyFullModalSubmitPayload) => {
    if (!currentUserId) return;

    try {
      setSavingProperty(true);
      if (propertyModalMode === 'create') {
        const created = await createPropertyForUser(
          currentUserId,
          payload.nome,
          payload.contact,
          payload.patch,
        );
        await loadProperties();
        setSelectedPropertyId(created.id);
        notifications.show({
          title: 'Propriedade criada',
          message: `${created.nome} cadastrada com sucesso.`,
          color: 'green',
        });
      } else if (propertyModalMode === 'edit' && selectedPropertyId) {
        const updated = await updatePropertyForUser(
          selectedPropertyId,
          payload.nome,
          payload.contact,
          payload.patch,
        );
        await loadProperties();
        setSelectedPropertyId(updated.id);
        notifications.show({
          title: 'Propriedade atualizada',
          message: `${updated.nome} atualizada com sucesso.`,
          color: 'green',
        });
      }
      setPropertyModalMode(null);
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar propriedade',
        message: err?.message ?? 'Nao foi possivel salvar a propriedade.',
        color: 'red',
      });
    } finally {
      setSavingProperty(false);
    }
  };

  const removeProperty = async () => {
    if (!selectedPropertyId || !selectedProperty) return;
    const confirmed = window.confirm(
      `Excluir a propriedade "${selectedProperty.nome}"? Isso removera tambem talhoes e analises vinculadas.`,
    );
    if (!confirmed) return;

    try {
      await deletePropertyForUser(selectedPropertyId);
      await loadProperties();
      notifications.show({
        title: 'Propriedade excluida',
        message: 'Propriedade removida com sucesso.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao excluir propriedade',
        message: err?.message ?? 'Nao foi possivel excluir a propriedade.',
        color: 'red',
      });
    }
  };

  const openTalhaoCreate = () => {
    if (!selectedPropertyId) return;
    setTalhaoModalMode('create');
    setTalhaoDraft({
      nome: '',
      area_ha: '',
      tipo_solo: '',
      color: DEFAULT_TALHAO_COLOR,
    });
  };

  const openTalhaoEdit = () => {
    if (!selectedTalhao) return;
    setTalhaoModalMode('edit');
    setTalhaoDraft({
      nome: selectedTalhao.nome,
      area_ha:
        selectedTalhao.area_ha == null ? '' : String(selectedTalhao.area_ha),
      tipo_solo: selectedTalhao.tipo_solo ?? '',
      color: selectedTalhao.cor_identificacao ?? DEFAULT_TALHAO_COLOR,
    });
  };

  const closeTalhaoModal = (force = false) => {
    if (savingTalhao && !force) return;
    setTalhaoModalMode(null);
    setTalhaoDraft({
      nome: '',
      area_ha: '',
      tipo_solo: '',
      color: DEFAULT_TALHAO_COLOR,
    });
  };

  const saveTalhao = async () => {
    const nome = talhaoDraft.nome.trim();
    if (!nome) {
      notifications.show({
        title: 'Nome obrigatorio',
        message: 'Informe o nome do talhao.',
        color: 'yellow',
      });
      return;
    }
    if (!selectedPropertyId) return;

    try {
      setSavingTalhao(true);
      if (talhaoModalMode === 'create') {
        const created = await createTalhaoForProperty({
          propertyId: selectedPropertyId,
          nome,
          area_ha: asOptionalNumber(talhaoDraft.area_ha),
          tipo_solo: talhaoDraft.tipo_solo.trim() || undefined,
          color: talhaoDraft.color,
        });
        await loadTalhoes();
        await loadProperties();
        setSelectedTalhaoId(created.id);
        notifications.show({
          title: 'Talhao criado',
          message: `${created.nome} cadastrado com sucesso.`,
          color: 'green',
        });
      } else if (talhaoModalMode === 'edit' && selectedTalhaoId) {
        const updated = await updateTalhaoForProperty({
          talhaoId: selectedTalhaoId,
          nome,
          area_ha: asOptionalNumber(talhaoDraft.area_ha),
          tipo_solo: talhaoDraft.tipo_solo.trim() || undefined,
          color: talhaoDraft.color,
        });
        await loadTalhoes();
        setSelectedTalhaoId(updated.id);
        notifications.show({
          title: 'Talhao atualizado',
          message: `${updated.nome} atualizado com sucesso.`,
          color: 'green',
        });
      }
      closeTalhaoModal(true);
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao salvar talhao',
        message: err?.message ?? 'Nao foi possivel salvar o talhao.',
        color: 'red',
      });
    } finally {
      setSavingTalhao(false);
    }
  };

  const removeTalhao = async () => {
    if (!selectedTalhaoId || !selectedTalhao) return;
    const confirmed = window.confirm(
      `Excluir o talhao "${selectedTalhao.nome}"? Analises vinculadas ao talhao tambem serao removidas.`,
    );
    if (!confirmed) return;

    try {
      await deleteTalhaoForProperty(selectedTalhaoId);
      await loadTalhoes();
      await loadProperties();
      notifications.show({
        title: 'Talhao excluido',
        message: 'Talhao removido com sucesso.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao excluir talhao',
        message: err?.message ?? 'Nao foi possivel excluir o talhao.',
        color: 'red',
      });
    }
  };

  const openTalhaoDetail = () => {
    if (!selectedTalhao) return;
    setTalhaoDetailOpened(true);
  };

  const showPropertiesSkeleton = loadingProperties && propertyRows.length === 0;
  const showTalhoesSkeleton = loadingTalhoes && talhoes.length === 0;

  const renderSkeletonRows = (columns: number) =>
    Array.from({ length: SKELETON_ROW_COUNT }, (_, rowIndex) => (
      <Table.Tr key={`skeleton-${columns}-${rowIndex}`}>
        {Array.from({ length: columns }, (_, colIndex) => (
          <Table.Td key={`skeleton-col-${rowIndex}-${colIndex}`}>
            <Skeleton height={12} radius="xl" />
          </Table.Td>
        ))}
      </Table.Tr>
    ));

  return (
    <Container size="xl" mt="md">
      <PageHeader title="Propriedades e Talhoes" />
      <Text c="dimmed" mb="md">
        Fluxo padrao: primeiro selecione na listagem, depois edite ou detalhe.
      </Text>

      <PropertyFullModal
        opened={propertyModalMode !== null}
        mode={propertyModalMode ?? 'create'}
        onClose={closePropertyModal}
        onSubmit={saveProperty}
        saving={savingProperty}
        userId={currentUserId}
        property={propertyModalMode === 'edit' ? selectedProperty : null}
        talhoesAreaHa={propertyModalMode === 'edit' ? selectedPropertyTalhoesArea : 0}
      />

      <TalhaoDetailModal
        opened={talhaoDetailOpened}
        talhao={selectedTalhao}
        onClose={() => setTalhaoDetailOpened(false)}
        onSaved={async (talhaoId) => {
          await loadTalhoes();
          await loadProperties();
          setSelectedTalhaoId(talhaoId);
        }}
      />

      <Modal
        opened={talhaoModalMode !== null}
        onClose={closeTalhaoModal}
        title={talhaoModalMode === 'create' ? 'Cadastrar talhao' : 'Editar talhao'}
        centered
      >
        <Stack>
          <TextInput
            label="Nome do talhao"
            value={talhaoDraft.nome}
            onChange={(event) => {
              const nextValue = event.currentTarget?.value ?? '';
              setTalhaoDraft((prev) => ({ ...prev, nome: nextValue }));
            }}
            data-autofocus
          />
          <NumberInput
            label="Area (ha)"
            value={talhaoDraft.area_ha}
            min={0}
            decimalScale={2}
            onChange={(value) =>
              setTalhaoDraft((prev) => ({ ...prev, area_ha: value == null ? '' : String(value) }))
            }
          />
          <TextInput
            label="Tipo de solo"
            placeholder="Argiloso, medio, arenoso..."
            value={talhaoDraft.tipo_solo}
            onChange={(event) => {
              const nextValue = event.currentTarget?.value ?? '';
              setTalhaoDraft((prev) => ({
                ...prev,
                tipo_solo: nextValue,
              }));
            }}
          />
          <ColorInput
            label="Cor de identificacao"
            value={talhaoDraft.color}
            onChange={(value) =>
              setTalhaoDraft((prev) => ({ ...prev, color: value }))
            }
            format="hex"
          />
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => closeTalhaoModal()}>
              Cancelar
            </Button>
            <Button onClick={saveTalhao} loading={savingTalhao}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder radius="md" p="md">
            <Group justify="space-between" mb="sm">
              <Text fw={700}>Listagem de propriedades</Text>
              <Group gap="xs">
                <Badge color="green">
                  {loadingProperties ? 'Atualizando...' : `${propertyRows.length} itens`}
                </Badge>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconRefresh size={14} />}
                  onClick={() => void loadProperties()}
                  loading={loadingProperties}
                >
                  Atualizar
                </Button>
              </Group>
            </Group>

            <Group mb="sm">
              <TextInput
                leftSection={<IconSearch size={14} />}
                placeholder="Buscar por nome da propriedade"
                value={propertySearch}
                onChange={(event) => setPropertySearch(event.currentTarget?.value ?? '')}
                style={{ flex: 1 }}
                disabled={loadingProperties}
              />
              <Button
                leftSection={<IconPlus size={14} />}
                onClick={openPropertyCreate}
                disabled={loadingProperties}
              >
                Cadastrar
              </Button>
            </Group>

            <Group mb="sm">
              <Button
                size="xs"
                variant="light"
                color="indigo"
                leftSection={<IconMapPin size={14} />}
                onClick={openTalhaoDetail}
                disabled={!selectedTalhao || loadingProperties || loadingTalhoes}
              >
                Detalhar
              </Button>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconEdit size={14} />}
                onClick={openPropertyEdit}
                disabled={!selectedProperty || loadingProperties}
              >
                Editar
              </Button>
              <Button
                size="xs"
                color="red"
                variant="light"
                leftSection={<IconTrash size={14} />}
                onClick={removeProperty}
                disabled={!selectedProperty || loadingProperties}
              >
                Excluir
              </Button>
            </Group>

            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nome</Table.Th>
                  <Table.Th>Talhoes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {showPropertiesSkeleton ? (
                  renderSkeletonRows(2)
                ) : propertiesLoadError ? (
                  <Table.Tr>
                    <Table.Td colSpan={2}>
                      <Group justify="space-between">
                        <Text size="sm" c="red">
                          Falha ao carregar propriedades.
                        </Text>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => void loadProperties()}
                        >
                          Tentar novamente
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ) : filteredProperties.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={2}>
                      <Text size="sm" c="dimmed">Nenhuma propriedade encontrada.</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredProperties.map((row) => {
                    const selected = row.id === selectedPropertyId;
                    return (
                      <Table.Tr
                        key={row.id}
                        onClick={() => setSelectedPropertyId(row.id)}
                        style={{
                          cursor: 'pointer',
                          background: selected ? 'rgba(34, 197, 94, 0.12)' : undefined,
                        }}
                      >
                        <Table.Td>{row.nome}</Table.Td>
                        <Table.Td>{row.talhoesCount}</Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>

            <Divider my="sm" />

            <Text size="sm" c="dimmed">
              Selecionada: {selectedProperty?.nome ?? 'nenhuma'}
            </Text>

            {selectedProperty ? (
              <>
                <Divider my="sm" />
                <Group justify="space-between" mb="xs">
                  <Text fw={700} size="sm">
                    Resumo de areas
                  </Text>
                  <Badge color="green" variant="light">
                    {`${formatAreaHa(selectedPropertyAreaTotal)} ha`}
                  </Badge>
                </Group>

                {selectedPropertyAreaSummary.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    Sem areas categorizadas para esta propriedade.
                  </Text>
                ) : (
                  <Table withTableBorder striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Categoria</Table.Th>
                        <Table.Th>Area (ha)</Table.Th>
                        <Table.Th>Origem</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {selectedPropertyAreaSummary.map((row) => (
                        <Table.Tr key={row.categoryId}>
                          <Table.Td>{row.categoryName}</Table.Td>
                          <Table.Td>{formatAreaHa(row.areaHa)}</Table.Td>
                          <Table.Td>
                            {row.categoryId === 'talhoes' ? 'Automatica' : 'Cadastro'}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </>
            ) : null}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder radius="md" p="md">
            <Group justify="space-between" mb="sm">
              <Text fw={700}>Talhoes da propriedade</Text>
              <Group gap="xs">
                <Badge color="cyan">
                  {loadingTalhoes ? 'Atualizando...' : `${talhoes.length} itens`}
                </Badge>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconRefresh size={14} />}
                  onClick={() => void loadTalhoes()}
                  loading={loadingTalhoes}
                  disabled={!selectedProperty}
                >
                  Atualizar
                </Button>
              </Group>
            </Group>

            <Group mb="sm">
              <TextInput
                leftSection={<IconSearch size={14} />}
                placeholder="Buscar por nome do talhao"
                value={talhaoSearch}
                onChange={(event) => setTalhaoSearch(event.currentTarget?.value ?? '')}
                style={{ flex: 1 }}
                disabled={!selectedProperty || loadingTalhoes}
              />
              <Button
                leftSection={<IconPlus size={14} />}
                onClick={openTalhaoCreate}
                disabled={!selectedProperty || loadingTalhoes}
              >
                Cadastrar
              </Button>
            </Group>

            <Group mb="sm">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconEdit size={14} />}
                onClick={openTalhaoEdit}
                disabled={!selectedTalhao || loadingTalhoes}
              >
                Editar
              </Button>
              <Button
                size="xs"
                color="red"
                variant="light"
                leftSection={<IconTrash size={14} />}
                onClick={removeTalhao}
                disabled={!selectedTalhao || loadingTalhoes}
              >
                Excluir
              </Button>
            </Group>

            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nome</Table.Th>
                  <Table.Th>Area (ha)</Table.Th>
                  <Table.Th>Solo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {!selectedProperty ? (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      <Text size="sm" c="dimmed">
                        Selecione uma propriedade para listar os talhoes.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : showTalhoesSkeleton ? (
                  renderSkeletonRows(3)
                ) : talhoesLoadError ? (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      <Group justify="space-between">
                        <Text size="sm" c="red">
                          Falha ao carregar talhoes.
                        </Text>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => void loadTalhoes()}
                          disabled={!selectedProperty}
                        >
                          Tentar novamente
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ) : filteredTalhoes.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      <Text size="sm" c="dimmed">Nenhum talhao encontrado.</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredTalhoes.map((row) => {
                    const selected = row.id === selectedTalhaoId;
                    return (
                      <Table.Tr
                        key={row.id}
                        onClick={() => {
                          setSelectedTalhaoId(row.id);
                          setTalhaoDetailOpened(true);
                        }}
                        style={{
                          cursor: 'pointer',
                          background: selected ? 'rgba(14, 165, 233, 0.12)' : undefined,
                        }}
                      >
                        <Table.Td>{row.nome}</Table.Td>
                        <Table.Td>{row.area_ha ?? '-'}</Table.Td>
                        <Table.Td>{row.tipo_solo ?? '-'}</Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>

            <Divider my="sm" />

            <Text size="sm" c="dimmed">
              Talhao selecionado: {selectedTalhao?.nome ?? 'nenhum'}
            </Text>
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
