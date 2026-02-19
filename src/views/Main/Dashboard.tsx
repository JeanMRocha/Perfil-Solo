import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding,
  IconChartBar,
  IconFlask,
  IconMap2,
  IconRefresh,
} from '@tabler/icons-react';
import { useStore } from '@nanostores/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { $currUser } from '../../global-state/user';
import { getAnalisesByUser } from '../../services/analisesService';
import { isLocalDataMode } from '../../services/dataProvider';
import {
  deriveTalhaoStatusFromAnalysis,
  fetchOrCreateUserProperties,
  fetchTalhoesByProperties,
  statusToLabel,
  type TalhaoTechnicalStatus,
} from '../../services/propertyMapService';

type DashboardMetrics = {
  propriedades: number;
  talhoes: number;
  analises: number;
  ultimaAnaliseLinha: string;
  ultimaAnaliseStatus: string;
  proximaColetaLinha: string;
  proximaColetaStatus: string;
};

type TalhoesByPropertyDatum = {
  nome: string;
  totalTalhoes: number;
};

type AnalisesByMonthDatum = {
  mes: string;
  total: number;
};

type StatusDatum = {
  status: string;
  total: number;
  color: string;
};

type DashboardSnapshot = {
  metrics: DashboardMetrics;
  talhoesByProperty: TalhoesByPropertyDatum[];
  analisesByMonth: AnalisesByMonthDatum[];
  statusByTalhao: StatusDatum[];
};

const EMPTY_METRICS: DashboardMetrics = {
  propriedades: 0,
  talhoes: 0,
  analises: 0,
  ultimaAnaliseLinha: 'Sem analises registradas',
  ultimaAnaliseStatus: 'Aguardando dados',
  proximaColetaLinha: 'Sem coleta planejada',
  proximaColetaStatus: 'Defina uma rotina de amostragem',
};

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  metrics: EMPTY_METRICS,
  talhoesByProperty: [],
  analisesByMonth: [],
  statusByTalhao: [],
};

const STATUS_COLORS: Record<TalhaoTechnicalStatus, string> = {
  critical: '#ef4444',
  attention: '#f59e0b',
  good: '#10b981',
  unknown: '#94a3b8',
};

function formatDate(dateLike: string | null | undefined): string {
  if (!dateLike) return 'sem data';
  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) return 'sem data';
  return parsed.toLocaleDateString('pt-BR');
}

function addDays(dateLike: string | null | undefined, days: number): string | null {
  if (!dateLike) return null;
  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString();
}

function resolveAnalysisDate(row: any): string | null {
  return row?.data_amostragem ?? row?.created_at ?? null;
}

function monthKeyFromDate(dateLike: string | null): string | null {
  if (!dateLike) return null;
  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function monthLabelFromKey(key: string): string {
  const [yearRaw, monthRaw] = key.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  });
}

function truncateLabel(input: string, max = 20): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 3)}...`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useStore($currUser);
  const currentUserId = user?.id ?? (isLocalDataMode ? 'local-user' : null);

  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_SNAPSHOT);

  const loadDashboard = useCallback(async () => {
    if (!currentUserId) {
      setSnapshot(EMPTY_SNAPSHOT);
      setLoadingMetrics(false);
      return;
    }

    setLoadingMetrics(true);

    try {
      const properties = await fetchOrCreateUserProperties(currentUserId);
      const propertyIdList = properties.map((property) => property.id);
      const [allTalhoes, allAnalisesRaw] = await Promise.all([
        fetchTalhoesByProperties(propertyIdList),
        getAnalisesByUser(currentUserId),
      ]);
      const allAnalises = [...(allAnalisesRaw as any[])].sort((a, b) => {
        const aTime = new Date(resolveAnalysisDate(a) ?? 0).getTime();
        const bTime = new Date(resolveAnalysisDate(b) ?? 0).getTime();
        return bTime - aTime;
      });

      const propertyNameById = new Map(
        properties.map((property) => [property.id, property.nome]),
      );
      const talhaoNameById = new Map<string, string>();
      const talhoesCountByProperty = new Map<string, number>();

      for (const talhao of allTalhoes) {
        const propertyName = propertyNameById.get(talhao.property_id) ?? 'Propriedade';
        talhaoNameById.set(talhao.id, `${propertyName} - ${talhao.nome}`);
        talhoesCountByProperty.set(
          talhao.property_id,
          (talhoesCountByProperty.get(talhao.property_id) ?? 0) + 1,
        );
      }

      const talhoesByProperty = properties
        .map((property) => ({
          nome: truncateLabel(property.nome),
          totalTalhoes: talhoesCountByProperty.get(property.id) ?? 0,
        }))
        .sort((a, b) => b.totalTalhoes - a.totalTalhoes || a.nome.localeCompare(b.nome))
        .slice(0, 8);

      const monthCount = new Map<string, number>();
      for (const analysis of allAnalises) {
        const key = monthKeyFromDate(resolveAnalysisDate(analysis));
        if (!key) continue;
        monthCount.set(key, (monthCount.get(key) ?? 0) + 1);
      }
      const analisesByMonth = [...monthCount.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-8)
        .map(([key, total]) => ({
          mes: monthLabelFromKey(key),
          total,
        }));

      const latestByTalhao = new Map<string, any>();
      for (const analysis of allAnalises) {
        const talhaoId = String(analysis?.talhao_id ?? '');
        if (!talhaoId || latestByTalhao.has(talhaoId)) continue;
        latestByTalhao.set(talhaoId, analysis);
      }

      const statusCount = new Map<TalhaoTechnicalStatus, number>();
      for (const analysis of latestByTalhao.values()) {
        const status = deriveTalhaoStatusFromAnalysis(analysis);
        statusCount.set(status, (statusCount.get(status) ?? 0) + 1);
      }
      const statusByTalhao = (
        ['critical', 'attention', 'good', 'unknown'] as TalhaoTechnicalStatus[]
      )
        .map((status) => ({
          status: statusToLabel(status),
          total: statusCount.get(status) ?? 0,
          color: STATUS_COLORS[status],
        }))
        .filter((row) => row.total > 0);

      let ultimaAnaliseLinha = EMPTY_METRICS.ultimaAnaliseLinha;
      let ultimaAnaliseStatus = EMPTY_METRICS.ultimaAnaliseStatus;
      let proximaColetaLinha = EMPTY_METRICS.proximaColetaLinha;
      let proximaColetaStatus = EMPTY_METRICS.proximaColetaStatus;

      const latest = allAnalises[0];
      if (latest) {
        const talhaoLabel =
          talhaoNameById.get(String(latest.talhao_id ?? '')) ??
          `Talhao ${String(latest.talhao_id ?? '').slice(0, 8)}`;
        const analysisDate = resolveAnalysisDate(latest);
        const nextCollectionDate = addDays(analysisDate, 180);

        ultimaAnaliseLinha = `${talhaoLabel} - ${formatDate(analysisDate)}`;
        ultimaAnaliseStatus = statusToLabel(deriveTalhaoStatusFromAnalysis(latest));

        if (nextCollectionDate) {
          proximaColetaLinha = `${talhaoLabel} - ${formatDate(nextCollectionDate)}`;
          proximaColetaStatus = 'Sugerida';
        }
      }

      setSnapshot({
        metrics: {
          propriedades: properties.length,
          talhoes: allTalhoes.length,
          analises: allAnalises.length,
          ultimaAnaliseLinha,
          ultimaAnaliseStatus,
          proximaColetaLinha,
          proximaColetaStatus,
        },
        talhoesByProperty,
        analisesByMonth,
        statusByTalhao,
      });
    } catch (err: any) {
      notifications.show({
        title: 'Falha ao carregar dashboard',
        message: err?.message ?? 'Nao foi possivel montar os indicadores.',
        color: 'red',
      });
      setSnapshot(EMPTY_SNAPSHOT);
    } finally {
      setLoadingMetrics(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = snapshot.metrics;
  const hasProperties = metrics.propriedades > 0;
  const hasTalhoes = metrics.talhoes > 0;
  const hasAnalises = metrics.analises > 0;
  const hasAnyData = hasProperties || hasTalhoes || hasAnalises;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3} c="green.8">
            Painel Geral
          </Title>
          <Text size="sm" c="dimmed">
            Os graficos aparecem conforme voce cadastra propriedades, talhoes e analises.
          </Text>
        </div>

        <Group gap="xs">
          <Badge variant="light" color="teal">
            {loadingMetrics ? 'Atualizando' : 'Pronto'}
          </Badge>
          <Button
            variant="light"
            leftSection={<IconRefresh size={14} />}
            onClick={() => void loadDashboard()}
            loading={loadingMetrics}
          >
            Atualizar
          </Button>
        </Group>
      </Group>

      <Divider />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        <Card withBorder radius="md" p="lg">
          <Group justify="space-between">
            <Group gap="xs">
              <IconBuilding size={20} color="#15803d" />
              <Text fw={700}>Propriedades</Text>
            </Group>
            <Badge color="green">{loadingMetrics ? '--' : metrics.propriedades}</Badge>
          </Group>
          <Text size="sm" c="dimmed" mt="sm">
            Estrutura base para iniciar o mapa de manejo.
          </Text>
          <Button mt="md" variant="light" fullWidth onClick={() => navigate('/propriedades')}>
            Gerenciar propriedades
          </Button>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Group justify="space-between">
            <Group gap="xs">
              <IconMap2 size={20} color="#0ea5e9" />
              <Text fw={700}>Talhoes</Text>
            </Group>
            <Badge color="cyan">{loadingMetrics ? '--' : metrics.talhoes}</Badge>
          </Group>
          <Text size="sm" c="dimmed" mt="sm">
            Areas operacionais vinculadas as propriedades.
          </Text>
          <Button mt="md" variant="light" fullWidth onClick={() => navigate('/propriedades')}>
            Abrir mapa de talhoes
          </Button>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Group justify="space-between">
            <Group gap="xs">
              <IconFlask size={20} color="#0f766e" />
              <Text fw={700}>Analises</Text>
            </Group>
            <Badge color="teal">{loadingMetrics ? '--' : metrics.analises}</Badge>
          </Group>
          <Text size="sm" c="dimmed" mt="sm">
            Historico tecnico que alimenta recomendacoes e relatorios.
          </Text>
          <Button mt="md" variant="light" fullWidth onClick={() => navigate('/analise-solo')}>
            Abrir modulo de analises
          </Button>
        </Card>
      </SimpleGrid>

      {!loadingMetrics && !hasAnyData && (
        <Card withBorder radius="md" p="xl">
          <Stack gap="sm" align="center">
            <IconChartBar size={26} color="#15803d" />
            <Title order={4}>Sem dados para exibir graficos</Title>
            <Text c="dimmed" ta="center">
              Cadastre sua primeira propriedade. Depois, o dashboard vai liberar os graficos automaticamente.
            </Text>
            <Button onClick={() => navigate('/propriedades')}>
              Comecar por propriedades
            </Button>
          </Stack>
        </Card>
      )}

      {!loadingMetrics && hasProperties && (
        <Card withBorder radius="md" p="lg">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Talhoes por propriedade</Text>
            <Badge color="green" variant="light">
              {snapshot.talhoesByProperty.length} propriedades no grafico
            </Badge>
          </Group>
          <Box h={280}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshot.talhoesByProperty} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="totalTalhoes" name="Talhoes" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Card>
      )}

      {!loadingMetrics && hasAnalises && (
        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
          <Card withBorder radius="md" p="lg">
            <Group justify="space-between" mb="sm">
              <Text fw={700}>Analises por mes</Text>
              <Badge color="teal" variant="light">
                ultimos {snapshot.analisesByMonth.length} meses ativos
              </Badge>
            </Group>
            <Box h={260}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshot.analisesByMonth} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Analises"
                    stroke="#0d9488"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Card>

          <Card withBorder radius="md" p="lg">
            <Group justify="space-between" mb="sm">
              <Text fw={700}>Status tecnico por talhao</Text>
              <Badge color="orange" variant="light">
                leitura da ultima analise
              </Badge>
            </Group>
            <Box h={260}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={snapshot.statusByTalhao}
                    dataKey="total"
                    nameKey="status"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={2}
                  >
                    {snapshot.statusByTalhao.map((entry) => (
                      <Cell key={entry.status} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </SimpleGrid>
      )}

      {!loadingMetrics && hasTalhoes && !hasAnalises && (
        <Card withBorder radius="md" p="xl">
          <Stack gap="sm" align="center">
            <IconFlask size={24} color="#0f766e" />
            <Text fw={700}>Talhoes cadastrados, mas sem analises ainda</Text>
            <Text c="dimmed" ta="center">
              Ao cadastrar a primeira analise, os graficos de tendencia e status serao exibidos aqui.
            </Text>
            <Button onClick={() => navigate('/analise-solo/cadastro')}>
              Cadastrar primeira analise
            </Button>
          </Stack>
        </Card>
      )}

      {!loadingMetrics && hasAnalises && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Card withBorder radius="md" p="lg">
            <Text fw={700} mb={6}>
              Ultima analise
            </Text>
            <Text c="dimmed">{metrics.ultimaAnaliseLinha}</Text>
            <Text c="green.8" fw={700} mt={6}>
              {metrics.ultimaAnaliseStatus}
            </Text>
          </Card>

          <Card withBorder radius="md" p="lg">
            <Text fw={700} mb={6}>
              Proxima coleta sugerida
            </Text>
            <Text c="dimmed">{metrics.proximaColetaLinha}</Text>
            <Text c="orange.6" fw={700} mt={6}>
              {metrics.proximaColetaStatus}
            </Text>
          </Card>
        </SimpleGrid>
      )}
    </Stack>
  );
}
