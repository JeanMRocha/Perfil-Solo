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
  updatePropertyForUser,
  updateTalhaoForProperty,
} from '../../services/propertyMapService';
import type { Property, Talhao } from '../../types/property';

type PropertyRow = Property & { talhoesCount: number };
type PropertyModalMode = 'create' | 'edit';
type TalhaoModalMode = 'create' | 'edit';

const DEFAULT_TALHAO_COLOR = '#81C784';

function asOptionalNumber(value: number | string | null): number | undefined {
  if (value == null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export default function Propriedades() {
  const user = useStore($currUser);
  const currentUserId = user?.id ?? (isLocalDataMode ? 'local-user' : null);

  const [loadingProperties, setLoadingProperties] = useState(true);
  const [loadingTalhoes, setLoadingTalhoes] = useState(false);

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
    try {
      const properties = await fetchOrCreateUserProperties(currentUserId);
      const withTalhoes = await Promise.all(
        properties.map(async (property) => {
          const linkedTalhoes = await fetchTalhoesByProperty(property.id);
          return { ...property, talhoesCount: linkedTalhoes.length };
        }),
      );

      setPropertyRows(withTalhoes);
      setSelectedPropertyId((prev) => {
        if (prev && withTalhoes.some((row) => row.id === prev)) return prev;
        return withTalhoes[0]?.id ?? null;
      });
    } catch (err: any) {
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
    try {
      const rows = await fetchTalhoesByProperty(selectedPropertyId);
      setTalhoes(rows);
      setSelectedTalhaoId((prev) => {
        if (prev && rows.some((row) => row.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (err: any) {
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

  const closeTalhaoModal = () => {
    if (savingTalhao) return;
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
      closeTalhaoModal();
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
            onChange={(event) =>
              setTalhaoDraft((prev) => ({ ...prev, nome: event.currentTarget.value }))
            }
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
            onChange={(event) =>
              setTalhaoDraft((prev) => ({
                ...prev,
                tipo_solo: event.currentTarget.value,
              }))
            }
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
            <Button variant="light" color="gray" onClick={closeTalhaoModal}>
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
              <Badge color="green">{loadingProperties ? '...' : `${propertyRows.length} itens`}</Badge>
            </Group>

            <Group mb="sm">
              <TextInput
                leftSection={<IconSearch size={14} />}
                placeholder="Buscar por nome da propriedade"
                value={propertySearch}
                onChange={(event) => setPropertySearch(event.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button leftSection={<IconPlus size={14} />} onClick={openPropertyCreate}>
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
                disabled={!selectedTalhao}
              >
                Detalhar
              </Button>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconEdit size={14} />}
                onClick={openPropertyEdit}
                disabled={!selectedProperty}
              >
                Editar
              </Button>
              <Button
                size="xs"
                color="red"
                variant="light"
                leftSection={<IconTrash size={14} />}
                onClick={removeProperty}
                disabled={!selectedProperty}
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
                {loadingProperties ? (
                  <Table.Tr>
                    <Table.Td colSpan={2}>
                      <Text size="sm" c="dimmed">Carregando propriedades...</Text>
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
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder radius="md" p="md">
            <Group justify="space-between" mb="sm">
              <Text fw={700}>Talhoes da propriedade</Text>
              <Badge color="cyan">{loadingTalhoes ? '...' : `${talhoes.length} itens`}</Badge>
            </Group>

            <Group mb="sm">
              <TextInput
                leftSection={<IconSearch size={14} />}
                placeholder="Buscar por nome do talhao"
                value={talhaoSearch}
                onChange={(event) => setTalhaoSearch(event.currentTarget.value)}
                style={{ flex: 1 }}
                disabled={!selectedProperty}
              />
              <Button
                leftSection={<IconPlus size={14} />}
                onClick={openTalhaoCreate}
                disabled={!selectedProperty}
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
                disabled={!selectedTalhao}
              >
                Editar
              </Button>
              <Button
                size="xs"
                color="red"
                variant="light"
                leftSection={<IconTrash size={14} />}
                onClick={removeTalhao}
                disabled={!selectedTalhao}
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
                ) : loadingTalhoes ? (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      <Text size="sm" c="dimmed">Carregando talhoes...</Text>
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
