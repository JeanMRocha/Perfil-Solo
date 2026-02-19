// src/views/Marketplace/Marketplace.tsx
import { useEffect, useState } from 'react';
import {
    Card, Group, Text, Title, Avatar, Badge, Button,
    TextInput, Select, Tabs, Rating, SimpleGrid
} from '@mantine/core';
import { IconSearch, IconFilter, IconMapPin, IconBuildingStore } from '@tabler/icons-react';
import { Partner, RegionalBenchmark } from '../../types/marketplace';
import {
    getSystemBrand,
    subscribeSystemConfig,
} from '../../services/systemConfigService';

// Mock Data
const MOCK_PARTNERS: Partner[] = [
    {
        id: '1',
        name: 'Laboratório Solo Fértil',
        type: 'lab',
        region: 'MG - Sul de Minas',
        rating: 4.8,
        contact_info: { email: 'contato@solofertil.com.br' },
        services: ['Análise Química Completa', 'Análise Foliar'],
        verified: true
    },
    {
        id: '2',
        name: 'Eng. Agrônomo Carlos Silva',
        type: 'consultant',
        region: 'SP - Alta Mogiana',
        rating: 5.0,
        contact_info: { phone: '(16) 99999-8888' },
        services: ['Consultoria Café', 'Manejo Nutricional'],
        verified: true
    },
    {
        id: '3',
        name: 'AgroCalcário Distribuidora',
        type: 'vendor',
        region: 'MG - Cerrado',
        rating: 4.5,
        contact_info: { website: 'www.agrocalcario.com.br' },
        services: ['Calcário Dolomítico', 'Gesso Agrícola'],
        verified: false
    }
];

const MOCK_BENCHMARK: RegionalBenchmark = {
    region: 'Sul de Minas',
    crop: 'Café Arábica',
    avg_ph: 5.2,
    avg_productivity: 35.5,
    top_performer_avg_ph: 6.0,
    last_updated: 'Fev/2026'
};

export default function Marketplace() {
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<string | null>('all');
    const [systemName, setSystemName] = useState(() => getSystemBrand().name);

    useEffect(() => {
        const unsubscribe = subscribeSystemConfig((config) => {
            setSystemName(config.brand.name);
        });

        return unsubscribe;
    }, []);

    const filteredPartners = MOCK_PARTNERS.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.region.toLowerCase().includes(search.toLowerCase());
        const matchesType = filterType === 'all' || p.type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div style={{ padding: '1rem' }}>
            {/* Header Ecosystem */}
            <Group justify="space-between" mb="xl">
                <div>
                    <Title order={2}>Ecossistema {systemName}</Title>
                    <Text c="dimmed">Conecte-se com os melhores parceiros e compare sua produtividade.</Text>
                </div>
                <Button variant="light" leftSection={<IconBuildingStore size={18} />}>
                    Seja um Parceiro
                </Button>
            </Group>

            {/* Benchmark Section (Big Data Teaser) */}
            <Card withBorder radius="md" p="xl" mb="xl" bg="blue.0" style={{ borderLeft: '5px solid #228be6' }}>
                <Group justify="space-between" align="start">
                    <div>
                        <Group mb="xs">
                            <Title order={4} c="blue.8">Benchmark Regional (Big Data)</Title>
                            <Badge color="blue" variant="filled">BETA</Badge>
                        </Group>
                        <Text size="sm" c="dimmed" mb="md">
                            Comparativo anônimo da sua região ({MOCK_BENCHMARK.region}) para {MOCK_BENCHMARK.crop}.
                        </Text>

                        <Group gap="xl">
                            <div>
                                <Text size="xs" fw={700} c="dimmed">MÉDIA REGIONAL</Text>
                                <Text size="xl" fw={700}>{MOCK_BENCHMARK.avg_productivity} sc/ha</Text>
                                <Text size="xs" c="red">pH Médio: {MOCK_BENCHMARK.avg_ph}</Text>
                            </div>
                            <div style={{ borderLeft: '1px solid #ccc', paddingLeft: 16 }}>
                                <Text size="xs" fw={700} c="dimmed">TOP 10% PRODUTORES</Text>
                                <Text size="xl" fw={700} c="green.7">48.2 sc/ha</Text>
                                <Text size="xs" c="green">pH Médio: {MOCK_BENCHMARK.top_performer_avg_ph}</Text>
                            </div>
                        </Group>
                    </div>
                    <Button variant="white" color="blue" size="xs">
                        Ver Relatório Completo
                    </Button>
                </Group>
            </Card>

            {/* Marketplace Directory */}
            <Tabs defaultValue="directory" variant="pills" radius="md">
                <Tabs.List mb="md">
                    <Tabs.Tab value="directory" leftSection={<IconSearch size={16} />}>
                        Diretório de Parceiros
                    </Tabs.Tab>
                    <Tabs.Tab value="map" leftSection={<IconMapPin size={16} />}>
                        Mapa de Prestadores
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="directory">
                    {/* Filters */}
                    <Group mb="lg">
                        <TextInput
                            placeholder="Buscar por nome ou região..."
                            leftSection={<IconSearch size={14} />}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <Select
                            data={[
                                { value: 'all', label: 'Todos' },
                                { value: 'lab', label: 'Laboratórios' },
                                { value: 'consultant', label: 'Consultores' },
                                { value: 'vendor', label: 'Fornecedores' }
                            ]}
                            value={filterType}
                            onChange={setFilterType}
                            leftSection={<IconFilter size={14} />}
                            w={200}
                        />
                    </Group>

                    {/* Partner Grid */}
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {filteredPartners.map(partner => (
                            <Card key={partner.id} withBorder radius="md" padding="md">
                                <Group wrap="nowrap" align="flex-start">
                                    <Avatar size="lg" radius="md" color="blue">
                                        {partner.name.substring(0, 2).toUpperCase()}
                                    </Avatar>
                                    <div style={{ flex: 1 }}>
                                        <Group justify="space-between" align="center" wrap="nowrap">
                                            <Text size="sm" fw={700} lineClamp={1}>
                                                {partner.name}
                                            </Text>
                                            {partner.verified && (
                                                <Badge size="xs" color="blue" variant="light">Verificado</Badge>
                                            )}
                                        </Group>

                                        <Text size="xs" c="dimmed" mb="xs">
                                            {partner.region} • {partner.type === 'lab' ? 'Laboratório' : partner.type === 'consultant' ? 'Consultoria' : 'Varejo'}
                                        </Text>

                                        <Group gap={4} mb="xs">
                                            <Rating value={partner.rating} readOnly size="xs" />
                                            <Text size="xs" c="dimmed">({partner.rating})</Text>
                                        </Group>

                                        <Group gap={4}>
                                            {partner.services.slice(0, 2).map((s, i) => (
                                                <Badge key={i} size="xs" variant="outline" color="gray">
                                                    {s}
                                                </Badge>
                                            ))}
                                            {partner.services.length > 2 && (
                                                <Badge size="xs" variant="outline" color="gray">
                                                    +{partner.services.length - 2}
                                                </Badge>
                                            )}
                                        </Group>
                                    </div>
                                </Group>

                                <Button fullWidth mt="md" variant="light" size="xs">
                                    Ver Perfil / Contatar
                                </Button>
                            </Card>
                        ))}
                    </SimpleGrid>
                </Tabs.Panel>

                <Tabs.Panel value="map">
                    <Text p="xl" ta="center" c="dimmed">
                        Visualização em mapa em breve...
                    </Text>
                </Tabs.Panel>
            </Tabs>
        </div>
    );
}
