// src/views/Relatorios/RelatorioAnalise.tsx
import { useState } from 'react';
import { Card, Group, Text, Title, Table, Grid, Divider, Box, Button, Switch, Badge } from '@mantine/core';
import { IconPrinter, IconLeaf, IconUser, IconBriefcase } from '@tabler/icons-react';
import { AnalysisContainer } from '../../types/soil';

// Mock data integration (futuro: props)
import { analisesMock } from '../../data/analisesMock';

interface ReportProps {
    analysis?: AnalysisContainer; // Futuro: usar tipo real
}

/**
 * Componente Visual de Barra de Status (Baixo/Médio/Alto)
 */
const StatusBar = ({ value, min, max, label }: { value: number, min: number, max: number, label: string }) => {
    let color = 'green';
    let status = 'Adequado';
    let width = '50%';

    if (value < min) {
        color = 'red';
        status = 'Baixo';
        width = '20%';
    } else if (value > max) {
        color = 'orange';
        status = 'Alto';
        width = '80%';
    }

    return (
        <Box mb="xs">
            <Group justify="space-between" mb={2}>
                <Text size="sm" fw={500}>{label}</Text>
                <Text size="sm" fw={700} c={color}>{value} ({status})</Text>
            </Group>
            <div style={{ width: '100%', height: 8, background: '#e0e0e0', borderRadius: 4 }}>
                <div style={{ width, height: '100%', background: color === 'red' ? '#ef5350' : color === 'orange' ? '#ff9800' : '#66bb6a', borderRadius: 4 }} />
            </div>
        </Box>
    );
};

export default function RelatorioAnalise({ }: ReportProps) {
    const [mode, setMode] = useState<'farmer' | 'consultant'>('consultant');

    // Dados simulados
    const mockData = {
        client: 'Fazenda Vale Verde',
        date: '17/02/2026',
        talhao: 'Talhão 01 - Café',
        analise: analisesMock[0]
    };

    return (
        <Box p="md" style={{ maxWidth: '210mm', margin: '0 auto', background: 'white' }}>

            {/* Controles de Tela (Não imprime) */}
            <Card mb="xl" className="no-print" withBorder p="sm" bg="gray.1">
                <Group justify="space-between">
                    <Group>
                        <Title order={4}>Configuração do Laudo</Title>
                        <Switch
                            size="lg"
                            onLabel={<IconBriefcase size={16} />}
                            offLabel={<IconUser size={16} />}
                            checked={mode === 'consultant'}
                            onChange={(event) => setMode(event.currentTarget.checked ? 'consultant' : 'farmer')}
                            label={mode === 'consultant' ? "Modo Técnico (Consultor)" : "Modo Simplificado (Produtor)"}
                        />
                    </Group>
                    <Button leftSection={<IconPrinter />} onClick={() => window.print()}>
                        Imprimir / Salvar PDF
                    </Button>
                </Group>
            </Card>

            {/* CABEÇALHO DO LAUDO */}
            <Card withBorder padding="lg" radius="md" mb="md" style={{ borderTop: '4px solid #4CAF50' }}>
                <Group justify="space-between" align="center">
                    <div>
                        <Group>
                            <IconLeaf size={32} color="#4CAF50" />
                            <Title order={2} c="green.9">PerfilSolo Pro</Title>
                            {mode === 'consultant' && <Badge color="blue" variant="light">RELATÓRIO TÉCNICO</Badge>}
                        </Group>
                        <Text c="dimmed" size="sm">Tecnologia em Nutrição de Plantas</Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <Text fw={700} size="lg">{mockData.client}</Text>
                        <Text>Relatório: {mockData.talhao}</Text>
                        <Text size="sm" c="dimmed">Data: {mockData.date}</Text>
                    </div>
                </Group>
            </Card>

            {/* RESULTADOS DA ANÁLISE */}
            <Grid gutter="md">
                {/* Tabela só aparece completa no modo Consultor ou se for desktop */}
                {(mode === 'consultant') && (
                    <Grid.Col span={6}>
                        <Card withBorder p="md" radius="md" h="100%">
                            <Title order={4} mb="md" c="blue.8">Resultados Laboratoriais</Title>
                            <Table striped highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Nutriente</Table.Th>
                                        <Table.Th>Valor</Table.Th>
                                        <Table.Th>Unid.</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {Object.entries(mockData.analise.nutrientes).map(([key, val]) => (
                                        <Table.Tr key={key}>
                                            <Table.Td fw={500}>{key}</Table.Td>
                                            <Table.Td>{val}</Table.Td>
                                            <Table.Td>cmolc/dm³</Table.Td> {/* Mock unit */}
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Card>
                    </Grid.Col>
                )}

                {/* INTERPRETAÇÃO GRÁFICA (Visual para ambos, mas expandido no Farmer) */}
                <Grid.Col span={mode === 'consultant' ? 6 : 12}>
                    <Card withBorder p="md" radius="md" h="100%">
                        <Title order={4} mb="md" c="orange.8">
                            {mode === 'farmer' ? 'Como está seu solo?' : 'Interpretação Agronômica'}
                        </Title>
                        <StatusBar value={5.2} min={5.5} max={6.5} label="pH (Acidez)" />
                        <StatusBar value={12} min={15} max={30} label="Fósforo (P)" />
                        <StatusBar value={45} min={50} max={70} label="Saturação por Bases (V%)" />
                        <StatusBar value={0.2} min={0} max={0.5} label="Alumínio (Tóxico)" />

                        {mode === 'farmer' && (
                            <Text mt="md" size="sm" c="dimmed">
                                *Barras vermelhas indicam níveis crônicos que precisam de atenção imediata.
                            </Text>
                        )}
                    </Card>
                </Grid.Col>
            </Grid>

            {/* RECOMENDAÇÕES */}
            <Title order={3} mt="xl" mb="md" c="green.9">
                {mode === 'farmer' ? 'O que precisa ser feito?' : 'Recomendações Técnicas'}
            </Title>

            <Grid gutter="lg">
                {/* CALAGEM */}
                <Grid.Col span={4}>
                    <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #FFC107' }}>
                        <Title order={5} mb="xs">Calagem (Calcário)</Title>
                        <Text size="xl" fw={800}>2.5 t/ha</Text>
                        <Text size="sm" c="dimmed">PRNT 80%</Text>

                        {mode === 'consultant' && (
                            <Box mt="md" bg="gray.0" p="xs" style={{ borderRadius: 4 }}>
                                <Text size="xs" fw={700}>MEMÓRIA DE CÁLCULO:</Text>
                                <Text size="xs">NC = (V2 - V1) * CTC / 10</Text>
                                <Text size="xs">NC = (70 - 45) * 12.5 / 10 = 3.12</Text>
                                <Text size="xs" c="red">Ajuste técnico aplicado.</Text>
                            </Box>
                        )}
                    </Card>
                </Grid.Col>

                {/* GESSAGEM */}
                <Grid.Col span={4}>
                    <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #2196F3' }}>
                        <Title order={5} mb="xs">Gessagem</Title>
                        <Text size="xl" fw={800}>1.2 t/ha</Text>
                        <Text size="sm" c="dimmed">Aplicar em área total</Text>
                    </Card>
                </Grid.Col>

                {/* ADUBAÇÃO */}
                <Grid.Col span={4}>
                    <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #4CAF50' }}>
                        <Title order={5} mb="xs">Adubação (Plantio)</Title>
                        <Text size="xl" fw={800}>400 kg/ha</Text>
                        <Text size="sm" c="dimmed">Fórmula 04-14-08</Text>
                    </Card>
                </Grid.Col>
            </Grid>

            {/* RODAPÉ */}
            <Divider my="xl" />
            <Group justify="space-between" align="end">
                <Text size="xs" c="dimmed">
                    Gerado por PerfilSolo Pro © 2026. <br />
                    Responsável Técnico: Eng. Agrônomo Demo (CREA 12345)
                </Text>
                <Box style={{ textAlign: 'center' }}>
                    <div style={{ borderBottom: '1px solid black', width: 200, marginBottom: 4 }}></div>
                    <Text size="sm">Assinatura do Consultor</Text>
                </Box>
            </Group>

            <style>{`
        @media print {
            .no-print { display: none !important; }
            body { background: white; -webkit-print-color-adjust: exact; }
            @page { margin: 1cm; size: A4; }
        }
      `}</style>
        </Box>
    );
}
