import { useEffect, useState, useCallback, useMemo } from 'react';
import {
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
    TextInput as MantineTextInput,
} from '@mantine/core';
import {
    IconCheck,
    IconEdit,
    IconRefresh,
    IconSearch,
} from '@tabler/icons-react';
import { notify } from 'lib/notify';
import {
    listUserSpecies,
    listUserCultivars,
    updateSpeciesTechnicalData,
    updateCultivarTechnicalData,
    type ImportedSpecies,
    type ImportedCultivar,
} from '../../services/cultureImportService';

interface EditingProfile {
    type: 'species' | 'cultivar';
    id: string;
    name: string;
    technicalData: Record<string, any>;
}

export default function RegisteredCulturesCatalog() {
    const [species, setSpecies] = useState<ImportedSpecies[]>([]);
    const [cultivars, setCultivars] = useState<
        Array<ImportedCultivar & { species: ImportedSpecies }>
    >([]);
    const [loading, setLoading] = useState(false);
    const [editingProfile, setEditingProfile] = useState<EditingProfile | null>(
        null,
    );
    const [editModalOpen, setEditModalOpen] = useState(false);

    // Estados de filtro
    const [speciesSearch, setSpeciesSearch] = useState('');
    const [cultivarSearch, setCultivarSearch] = useState('');

    // Carrega lista de culturas importadas
    const loadCultures = useCallback(async () => {
        setLoading(true);
        try {
            const [speciesData, cultivarData] = await Promise.all([
                listUserSpecies(),
                listUserCultivars(),
            ]);
            setSpecies(speciesData);
            setCultivars(cultivarData as any);
        } catch (error) {
            console.error('Erro ao carregar culturas:', error);
            notify.show({
                title: 'Erro',
                message: 'Falha ao carregar culturas registradas no sistema',
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

    const filteredSpecies = useMemo(() => {
        return species.filter(s =>
            s.especie_nome_comum.toLowerCase().includes(speciesSearch.toLowerCase()) ||
            s.especie_nome_cientifico.toLowerCase().includes(speciesSearch.toLowerCase()) ||
            (s.grupo_especie || '').toLowerCase().includes(speciesSearch.toLowerCase())
        );
    }, [species, speciesSearch]);

    const filteredCultivars = useMemo(() => {
        return cultivars.filter(c =>
            c.cultivar_nome.toLowerCase().includes(cultivarSearch.toLowerCase()) ||
            c.species.especie_nome_comum.toLowerCase().includes(cultivarSearch.toLowerCase()) ||
            (c.species.grupo_especie || '').toLowerCase().includes(cultivarSearch.toLowerCase())
        );
    }, [cultivars, cultivarSearch]);

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
                    notify.show({
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
                    notify.show({
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
            notify.show({
                title: 'Erro',
                message: errorMessage,
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Stack gap="lg">
            <Alert
                icon={<IconCheck size={18} />}
                title="Base de Culturas do Sistema"
                color="green"
                radius="md"
            >
                Esta lista exibe todas as espécies e cultivares importados do RNC e disponíveis globalmente para uso.
                Você pode filtrar a lista e configurar produtividade esperada e outros parâmetros técnicos.
            </Alert>

            {loading && species.length === 0 ? (
                <Center py="xl">
                    <Loader />
                </Center>
            ) : (
                <Stack gap="xl">
                    {/* SEÇÃO ESPÉCIES */}
                    <Card withBorder radius="md">
                        <Card.Section withBorder inheritPadding py="md">
                            <Group justify="space-between" align="center">
                                <div>
                                    <Text fw={700} size="lg">Espécies ({filteredSpecies.length})</Text>
                                    <Text size="sm" c="dimmed">Bases genéricas de culturas importadas</Text>
                                </div>
                                <Group gap="sm">
                                    <MantineTextInput
                                        placeholder="Filtrar espécies..."
                                        size="xs"
                                        leftSection={<IconSearch size={14} />}
                                        value={speciesSearch}
                                        onChange={(e) => setSpeciesSearch(e.currentTarget.value)}
                                        style={{ width: 220 }}
                                    />
                                    <Button
                                        size="xs"
                                        variant="light"
                                        leftSection={<IconRefresh size={14} />}
                                        onClick={() => loadCultures()}
                                    >
                                        Atualizar
                                    </Button>
                                </Group>
                            </Group>
                        </Card.Section>

                        <Card.Section inheritPadding py="md">
                            <Table striped highlightOnHover verticalSpacing="xs">
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Nome Comum</Table.Th>
                                        <Table.Th>Nome Científico</Table.Th>
                                        <Table.Th>Grupo</Table.Th>
                                        <Table.Th style={{ width: 80 }}>Ações</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredSpecies.length > 0 ? (
                                        filteredSpecies.map((sp) => (
                                            <Table.Tr key={sp.id}>
                                                <Table.Td><strong>{sp.especie_nome_comum}</strong></Table.Td>
                                                <Table.Td>
                                                    <Text size="sm" c="dimmed"><em>{sp.especie_nome_cientifico || '-'}</em></Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Badge size="sm" variant="light">{sp.grupo_especie || '-'}</Badge>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Tooltip label="Editar parâmetros técnicos">
                                                        <ActionIcon
                                                            size="sm"
                                                            variant="light"
                                                            onClick={() => openEditModal({
                                                                type: 'species',
                                                                id: sp.id,
                                                                name: sp.especie_nome_comum,
                                                                technicalData: sp.technical_data || {},
                                                            })}
                                                        >
                                                            <IconEdit size={14} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))
                                    ) : (
                                        <Table.Tr>
                                            <Table.Td colSpan={4} align="center">
                                                <Text size="sm" c="dimmed" py="md">Nenhuma espécie encontrada.</Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    )}
                                </Table.Tbody>
                            </Table>
                        </Card.Section>
                    </Card>

                    {/* SEÇÃO CULTIVARES */}
                    <Card withBorder radius="md">
                        <Card.Section withBorder inheritPadding py="md">
                            <Group justify="space-between" align="center">
                                <div>
                                    <Text fw={700} size="lg">Cultivares ({filteredCultivars.length})</Text>
                                    <Text size="sm" c="dimmed">Variedades específicas importadas do MAPA/RNC</Text>
                                </div>
                                <MantineTextInput
                                    placeholder="Filtrar cultivares..."
                                    size="xs"
                                    leftSection={<IconSearch size={14} />}
                                    value={cultivarSearch}
                                    onChange={(e) => setCultivarSearch(e.currentTarget.value)}
                                    style={{ width: 250 }}
                                />
                            </Group>
                        </Card.Section>

                        <Card.Section inheritPadding py="md">
                            <Table striped highlightOnHover verticalSpacing="xs">
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Cultivar</Table.Th>
                                        <Table.Th>Espécie</Table.Th>
                                        <Table.Th>Status</Table.Th>
                                        <Table.Th style={{ width: 80 }}>Ações</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredCultivars.length > 0 ? (
                                        filteredCultivars.map((cv) => (
                                            <Table.Tr key={cv.id}>
                                                <Table.Td><strong>{cv.cultivar_nome}</strong></Table.Td>
                                                <Table.Td>{cv.species?.especie_nome_comum || '-'}</Table.Td>
                                                <Table.Td>
                                                    <Badge color="blue" size="sm" variant="dot">Importada</Badge>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Tooltip label="Editar parâmetros técnicos">
                                                        <ActionIcon
                                                            size="sm"
                                                            variant="light"
                                                            onClick={() => openEditModal({
                                                                type: 'cultivar',
                                                                id: cv.id,
                                                                name: cv.cultivar_nome,
                                                                technicalData: cv.technical_data || {},
                                                            })}
                                                        >
                                                            <IconEdit size={14} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))
                                    ) : (
                                        <Table.Tr>
                                            <Table.Td colSpan={4} align="center">
                                                <Text size="sm" c="dimmed" py="md">Nenhuma cultivar encontrada.</Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    )}
                                </Table.Tbody>
                            </Table>
                        </Card.Section>
                    </Card>
                </Stack>
            )}

            {/* MODAL: EDITAR PARÂMETROS TÉCNICOS */}
            <Modal
                opened={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                title={`Parâmetros Técnicos: ${editingProfile?.name}`}
                size="lg"
                radius="md"
            >
                {editingProfile && (
                    <Stack gap="lg">
                        <Text size="sm" c="dimmed">
                            Configure os parâmetros agronômicos básicos para esta
                            {editingProfile.type === 'species' ? ' espécie' : ' cultivar'}.
                        </Text>

                        <Grid>
                            <Grid.Col span={{ base: 12, sm: 6 }}>
                                <NumberInput
                                    label="Produtividade esperada (t/ha)"
                                    placeholder="Ex: 15.5"
                                    value={editingProfile.technicalData.produtividade_esperada_t_ha || ''}
                                    onChange={(val) => {
                                        setEditingProfile({
                                            ...editingProfile,
                                            technicalData: {
                                                ...editingProfile.technicalData,
                                                produtividade_esperada_t_ha: typeof val === 'number' ? val : null,
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
                                    label="População de plantas (plantas/ha)"
                                    placeholder="Ex: 40000"
                                    value={editingProfile.technicalData.populacao_plantas_ha || ''}
                                    onChange={(val) => {
                                        setEditingProfile({
                                            ...editingProfile,
                                            technicalData: {
                                                ...editingProfile.technicalData,
                                                populacao_plantas_ha: typeof val === 'number' ? val : null,
                                            },
                                        });
                                    }}
                                    decimalScale={0}
                                />
                            </Grid.Col>

                            <Grid.Col span={12}>
                                <Textarea
                                    label="Observações agronômicas"
                                    placeholder="Ex: Solo preferido, sensibilidade, etc."
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
                                    rows={3}
                                />
                            </Grid.Col>
                        </Grid>

                        <Group justify="flex-end" mt="md">
                            <Button variant="subtle" color="gray" onClick={() => setEditModalOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSaveTechnicalData} loading={loading}>
                                Salvar Parâmetros
                            </Button>
                        </Group>
                    </Stack>
                )}
            </Modal>
        </Stack>
    );
}
