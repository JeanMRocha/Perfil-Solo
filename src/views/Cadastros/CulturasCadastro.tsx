import { useEffect, useState, useCallback } from 'react';
import {
  Container,
  Tabs,
  Stack,
  Button,
  Group,
  Table,
  Badge,
  Text,
  Card,
  Alert,
  Loader,
  Center,
  Modal,
  NumberInput,
  Textarea,
  ActionIcon,
  Grid,
  Tooltip,
} from '@mantine/core';
import {
  IconDownload,
  IconCheck,
  IconAlertCircle,
  IconEdit,
  IconRefresh,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import PageHeader from '../../components/PageHeader';
import RncCultivarSelector from '../Rnc/RncCultivarSelector';
import {
  importRncRecord,
  listUserSpecies,
  listUserCultivars,
  updateSpeciesTechnicalData,
  updateCultivarTechnicalData,
  type ImportedSpecies,
  type ImportedCultivar,
} from '../../services/cultureImportService';
import {
  RNC_CULTIVAR_SELECTED_EVENT,
  type RncCultivarSelectionMessage,
} from '../../services/rncCultivarService';

interface EditingProfile {
  type: 'species' | 'cultivar';
  id: string;
  name: string;
  technicalData: Record<string, any>;
}

export default function CulturasCadastro() {
  const [activeTab, setActiveTab] = useState<string | null>('busca');
  const [species, setSpecies] = useState<ImportedSpecies[]>([]);
  const [cultivars, setCultivars] = useState<
    Array<ImportedCultivar & { species: ImportedSpecies }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [editingProfile, setEditingProfile] = useState<EditingProfile | null>(
    null,
  );
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Carrega lista de culturas importadas
  const loadCultures = useCallback(async () => {
    setLoading(true);
    try {
      const [speciesData, cultivarData] = await Promise.all([
        listUserSpecies(),
        listUserCultivars(),
      ]);
      setSpecies(speciesData);
      setCultivars(cultivarData);
    } catch (error) {
      console.error('Erro ao carregar culturas:', error);
      notifications.show({
        title: 'Erro',
        message: 'Falha ao carregar culturas importadas',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega culturas ao montar
  useEffect(() => {
    void loadCultures();
  }, [loadCultures]);

  // Listener para seleção no RNC
  useEffect(() => {
    const handleRncSelection = (event: any) => {
      if (event.detail?.type === RNC_CULTIVAR_SELECTED_EVENT) {
        const message = event.detail as RncCultivarSelectionMessage;
        void handleImportFromRnc(message.payload);
      }
    };

    window.addEventListener(RNC_CULTIVAR_SELECTED_EVENT, handleRncSelection);
    return () =>
      window.removeEventListener(
        RNC_CULTIVAR_SELECTED_EVENT,
        handleRncSelection,
      );
  }, []);

  // Importa registro selecionado do RNC
  const handleImportFromRnc = async (payload: any) => {
    try {
      setLoading(true);

      const rncRecord = {
        especie_nome_comum: payload.especieNomeComum || 'Desconhecida',
        especie_nome_cientifico: payload.especieNomeCientifico || '',
        cultivar: payload.cultivar || '',
        tipo_registro: payload.tipo_registro || 'CULTIVAR',
        grupo_especie: payload.grupoEspecie || '',
        situacao: 'Registrada',
        rnc_detail_url: payload.rncDetailUrl,
      };

      const result = await importRncRecord(rncRecord, false);

      if (result.success) {
        setImportedCount((prev) => prev + 1);
        notifications.show({
          title: '✓ Importação bem-sucedida',
          message: result.message,
          color: 'green',
          icon: <IconCheck size={18} />,
        });
        await loadCultures();
      } else {
        notifications.show({
          title: '⚠ Erro na importação',
          message: result.error || 'Falha desconhecida',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      notifications.show({
        title: 'Erro',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Abre modal de edição de parâmetros técnicos
  const openEditModal = (profile: EditingProfile) => {
    setEditingProfile(profile);
    setEditModalOpen(true);
  };

  // Salva edição de parâmetros técnicos
  const handleSaveTechnicalData = async () => {
    if (!editingProfile) return;

    try {
      setLoading(true);

      if (editingProfile.type === 'species') {
        const result = await updateSpeciesTechnicalData(
          editingProfile.id,
          editingProfile.technicalData,
        );
        if (result) {
          notifications.show({
            title: '✓ Dados técnicos atualizados',
            message: `Espécie "${editingProfile.name}" salva com sucesso`,
            color: 'green',
          });
        }
      } else {
        const result = await updateCultivarTechnicalData(
          editingProfile.id,
          editingProfile.technicalData,
        );
        if (result) {
          notifications.show({
            title: '✓ Dados técnicos atualizados',
            message: `Cultivar "${editingProfile.name}" salvo com sucesso`,
            color: 'green',
          });
        }
      }

      setEditModalOpen(false);
      await loadCultures();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      notifications.show({
        title: 'Erro',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Tabs de conteúdo
  const tabs = [
    {
      value: 'busca',
      label: 'Buscar no RNC',
    },
    {
      value: 'importadas',
      label: `Culturas Importadas (${species.length + cultivars.length})`,
    },
    {
      value: 'parametros',
      label: 'Editar Parâmetros Técnicos',
    },
  ];

  return (
    <Container size="xl" mt="xl">
      <PageHeader title="Catálogo de Culturas (RNC)" />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {/* ABA 1: BUSCA NO RNC */}
        <Tabs.Panel value="busca" pt="lg">
          <Stack gap="lg">
            <Alert
              icon={<IconDownload size={16} />}
              title="Importação do RNC"
              color="blue"
            >
              Busque e selecione culturas do Registro Nacional de Cultivares
              (RNC/MAPA). Você pode importar apenas a <strong>espécie</strong>{' '}
              ou a <strong>espécie + cultivar específico</strong>.
              {importedCount > 0 && (
                <Text size="sm" mt="xs">
                  <strong>{importedCount} registros</strong> importados nesta
                  sessão.
                </Text>
              )}
            </Alert>

            <RncCultivarSelector mode="catalog" />
          </Stack>
        </Tabs.Panel>

        {/* ABA 2: CULTURAS IMPORTADAS */}
        <Tabs.Panel value="importadas" pt="lg">
          {loading ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : (
            <Stack gap="lg">
              {/* ESPÉCIES */}
              {species.length > 0 && (
                <Card withBorder>
                  <Card.Section withBorder inheritPadding py="md">
                    <Group justify="space-between" align="center">
                      <div>
                        <Text fw={700} size="lg">
                          Espécies ({species.length})
                        </Text>
                        <Text size="sm" c="dimmed">
                          Bases genéricas de culturas
                        </Text>
                      </div>
                      <Button
                        size="sm"
                        variant="light"
                        leftSection={<IconRefresh size={14} />}
                        onClick={() => loadCultures()}
                      >
                        Atualizar
                      </Button>
                    </Group>
                  </Card.Section>
                  <Card.Section inheritPadding py="md">
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Nome Comum</Table.Th>
                          <Table.Th>Nome Científico</Table.Th>
                          <Table.Th>Grupo</Table.Th>
                          <Table.Th>Ações</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {species.map((sp) => (
                          <Table.Tr key={sp.id}>
                            <Table.Td>
                              <strong>{sp.especie_nome_comum}</strong>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                <em>{sp.especie_nome_cientifico || '-'}</em>
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge size="sm" variant="light">
                                {sp.grupo_especie || '-'}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Tooltip label="Editar parâmetros técnicos">
                                <ActionIcon
                                  size="sm"
                                  variant="light"
                                  onClick={() =>
                                    openEditModal({
                                      type: 'species',
                                      id: sp.id,
                                      name: sp.especie_nome_comum,
                                      technicalData: sp.technical_data || {},
                                    })
                                  }
                                >
                                  <IconEdit size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Card.Section>
                </Card>
              )}

              {/* CULTIVARES */}
              {cultivars.length > 0 && (
                <Card withBorder>
                  <Card.Section withBorder inheritPadding py="md">
                    <div>
                      <Text fw={700} size="lg">
                        Cultivares ({cultivars.length})
                      </Text>
                      <Text size="sm" c="dimmed">
                        Variedades específicas com dados técnicos customizáveis
                      </Text>
                    </div>
                  </Card.Section>
                  <Card.Section inheritPadding py="md">
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Cultivar</Table.Th>
                          <Table.Th>Espécie</Table.Th>
                          <Table.Th>Prioridade</Table.Th>
                          <Table.Th>Ações</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {cultivars.map((cv) => (
                          <Table.Tr key={cv.id}>
                            <Table.Td>
                              <strong>{cv.cultivar_nome}</strong>
                            </Table.Td>
                            <Table.Td>
                              {cv.species?.especie_nome_comum || '-'}
                            </Table.Td>
                            <Table.Td>
                              <Badge color="blue" size="sm">
                                Cultivar
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Tooltip label="Editar parâmetros técnicos">
                                <ActionIcon
                                  size="sm"
                                  variant="light"
                                  onClick={() =>
                                    openEditModal({
                                      type: 'cultivar',
                                      id: cv.id,
                                      name: cv.cultivar_nome,
                                      technicalData: cv.technical_data || {},
                                    })
                                  }
                                >
                                  <IconEdit size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Card.Section>
                </Card>
              )}

              {species.length === 0 && cultivars.length === 0 && (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  title="Nenhuma cultura importada"
                >
                  Vá para a aba <strong>Buscar no RNC</strong> e importe suas
                  primeiras culturas.
                </Alert>
              )}
            </Stack>
          )}
        </Tabs.Panel>

        {/* ABA 3: EDITAR PARÂMETROS */}
        <Tabs.Panel value="parametros" pt="lg">
          <Stack gap="lg">
            <Alert icon={<IconEdit size={16} />} title="Parâmetros Técnicos">
              Configure dados de produção para espécies e cultivares. Esses
              dados são usados em cálculos de adubação, calagem e recomendações
              técnicas.
            </Alert>

            <Grid>
              {/* PAINEL ESQUERDO: ESPÉCIES */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder>
                  <Card.Section withBorder inheritPadding py="md">
                    <Text fw={700}>Espécies para Editar</Text>
                  </Card.Section>
                  <Card.Section inheritPadding py="md">
                    {loading ? (
                      <Center py="lg">
                        <Loader size="sm" />
                      </Center>
                    ) : species.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        Nenhuma espécie importada
                      </Text>
                    ) : (
                      <Stack gap="xs">
                        {species.map((sp) => (
                          <Button
                            key={sp.id}
                            variant={
                              editingProfile?.id === sp.id ? 'filled' : 'light'
                            }
                            fullWidth
                            justify="space-between"
                            onClick={() => {
                              openEditModal({
                                type: 'species',
                                id: sp.id,
                                name: sp.especie_nome_comum,
                                technicalData: sp.technical_data || {},
                              });
                              setEditModalOpen(true);
                            }}
                          >
                            <span>{sp.especie_nome_comum}</span>
                            <Badge size="xs" variant="light">
                              {Object.keys(sp.technical_data || {}).length}{' '}
                              campos
                            </Badge>
                          </Button>
                        ))}
                      </Stack>
                    )}
                  </Card.Section>
                </Card>
              </Grid.Col>

              {/* PAINEL DIREITO: CULTIVARES */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder>
                  <Card.Section withBorder inheritPadding py="md">
                    <Text fw={700}>Cultivares para Editar</Text>
                  </Card.Section>
                  <Card.Section inheritPadding py="md">
                    {loading ? (
                      <Center py="lg">
                        <Loader size="sm" />
                      </Center>
                    ) : cultivars.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        Nenhum cultivar importado
                      </Text>
                    ) : (
                      <Stack gap="xs">
                        {cultivars.map((cv) => (
                          <Button
                            key={cv.id}
                            variant={
                              editingProfile?.id === cv.id ? 'filled' : 'light'
                            }
                            fullWidth
                            justify="space-between"
                            onClick={() => {
                              openEditModal({
                                type: 'cultivar',
                                id: cv.id,
                                name: cv.cultivar_nome,
                                technicalData: cv.technical_data || {},
                              });
                              setEditModalOpen(true);
                            }}
                          >
                            <span>{cv.cultivar_nome}</span>
                            <Badge size="xs" variant="light">
                              {Object.keys(cv.technical_data || {}).length}{' '}
                              campos
                            </Badge>
                          </Button>
                        ))}
                      </Stack>
                    )}
                  </Card.Section>
                </Card>
              </Grid.Col>
            </Grid>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* MODAL: EDITAR PARÂMETROS TÉCNICOS */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Editar Parâmetros: ${editingProfile?.name}`}
        size="lg"
      >
        {editingProfile && (
          <Stack gap="lg">
            <Text size="sm" c="dimmed">
              Configure os parâmetros técnicos para esta{' '}
              {editingProfile.type === 'species' ? 'espécie' : 'cultivar'}.
            </Text>

            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <NumberInput
                  label="Produtividade esperada (t/ha)"
                  placeholder="Ex: 15.5"
                  value={
                    editingProfile.technicalData.produtividade_esperada_t_ha ||
                    ''
                  }
                  onChange={(val) => {
                    setEditingProfile({
                      ...editingProfile,
                      technicalData: {
                        ...editingProfile.technicalData,
                        produtividade_esperada_t_ha:
                          typeof val === 'number' ? val : null,
                      },
                    });
                  }}
                  decimalScale={2}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <NumberInput
                  label="Ciclo (dias)"
                  placeholder="Ex: 120"
                  value={editingProfile.technicalData.ciclo_dias || ''}
                  onChange={(val) => {
                    setEditingProfile({
                      ...editingProfile,
                      technicalData: {
                        ...editingProfile.technicalData,
                        ciclo_dias: typeof val === 'number' ? val : null,
                      },
                    });
                  }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <NumberInput
                  label="Espaçamento entre linhas (m)"
                  placeholder="Ex: 0.5"
                  value={editingProfile.technicalData.espacamento_linha_m || ''}
                  onChange={(val) => {
                    setEditingProfile({
                      ...editingProfile,
                      technicalData: {
                        ...editingProfile.technicalData,
                        espacamento_linha_m:
                          typeof val === 'number' ? val : null,
                      },
                    });
                  }}
                  decimalScale={2}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <NumberInput
                  label="Espaçamento entre plantas (m)"
                  placeholder="Ex: 0.25"
                  value={
                    editingProfile.technicalData.espacamento_planta_m || ''
                  }
                  onChange={(val) => {
                    setEditingProfile({
                      ...editingProfile,
                      technicalData: {
                        ...editingProfile.technicalData,
                        espacamento_planta_m:
                          typeof val === 'number' ? val : null,
                      },
                    });
                  }}
                  decimalScale={2}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <NumberInput
                  label="População de plantas (plantas/ha)"
                  placeholder="Ex: 40000"
                  value={
                    editingProfile.technicalData.populacao_plantas_ha || ''
                  }
                  onChange={(val) => {
                    setEditingProfile({
                      ...editingProfile,
                      technicalData: {
                        ...editingProfile.technicalData,
                        populacao_plantas_ha:
                          typeof val === 'number' ? val : null,
                      },
                    });
                  }}
                  decimalScale={0}
                />
              </Grid.Col>

              <Grid.Col span={12}>
                <Textarea
                  label="Observações"
                  placeholder="Ex: Resistência a doenças, clima preferido, etc."
                  value={editingProfile.technicalData.observacoes || ''}
                  onChange={(event) => {
                    setEditingProfile({
                      ...editingProfile,
                      technicalData: {
                        ...editingProfile.technicalData,
                        observacoes: event.currentTarget.value,
                      },
                    });
                  }}
                  rows={4}
                />
              </Grid.Col>
            </Grid>

            <Group justify="space-between">
              <Button variant="default" onClick={() => setEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveTechnicalData} loading={loading}>
                Salvar Parâmetros
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
