import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding,
  IconFlask,
} from '@tabler/icons-react';
import { useStore } from '@nanostores/react';
import { $currUser } from '../../global-state/user';
import { getAnalises } from '../../services/analisesService';
import { isLocalDataMode } from '../../services/dataProvider';
import {
  deriveTalhaoStatusFromAnalysis,
  fetchOrCreateUserProperties,
  fetchTalhoesByProperty,
  statusToLabel,
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

const EMPTY_METRICS: DashboardMetrics = {
  propriedades: 0,
  talhoes: 0,
  analises: 0,
  ultimaAnaliseLinha: 'Sem analises registradas',
  ultimaAnaliseStatus: 'Aguardando dados',
  proximaColetaLinha: 'Sem coleta planejada',
  proximaColetaStatus: 'Defina uma rotina de amostragem',
};

function formatDate(dateLike: string | null | undefined): string {
  if (!dateLike) return 'sem data';
  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) return 'sem data';
  return parsed.toLocaleDateString();
}

function addDays(dateLike: string | null | undefined, days: number): string | null {
  if (!dateLike) return null;
  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useStore($currUser);
  const currentUserId = user?.id ?? (isLocalDataMode ? 'local-user' : null);

  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);

  useEffect(() => {
    let alive = true;

    const loadDashboard = async () => {
      if (!currentUserId) {
        if (!alive) return;
        setMetrics(EMPTY_METRICS);
        setLoadingMetrics(false);
        return;
      }

      setLoadingMetrics(true);

      try {
        const properties = await fetchOrCreateUserProperties(currentUserId);

        const talhoesByProperty = await Promise.all(
          properties.map(async (property) => {
            const rows = await fetchTalhoesByProperty(property.id);
            return { propertyName: property.nome, rows };
          }),
        );

        const talhaoNameById = new Map<string, string>();
        for (const item of talhoesByProperty) {
          for (const talhao of item.rows) {
            talhaoNameById.set(talhao.id, `${item.propertyName} - ${talhao.nome}`);
          }
        }

        const talhoesCount = talhoesByProperty.reduce(
          (acc, item) => acc + item.rows.length,
          0,
        );

        const allAnalises = (await getAnalises()) as any[];
        const analises = allAnalises
          .filter((row) => !row?.user_id || row.user_id === currentUserId)
          .sort((a, b) => {
            const aTime = new Date(a?.created_at ?? a?.data_amostragem ?? 0).getTime();
            const bTime = new Date(b?.created_at ?? b?.data_amostragem ?? 0).getTime();
            return bTime - aTime;
          });

        let ultimaAnaliseLinha = EMPTY_METRICS.ultimaAnaliseLinha;
        let ultimaAnaliseStatus = EMPTY_METRICS.ultimaAnaliseStatus;
        let proximaColetaLinha = EMPTY_METRICS.proximaColetaLinha;
        let proximaColetaStatus = EMPTY_METRICS.proximaColetaStatus;

        const latest = analises[0];
        if (latest) {
          const talhaoLabel =
            talhaoNameById.get(String(latest.talhao_id ?? '')) ??
            `Talhao ${String(latest.talhao_id ?? '').slice(0, 8)}`;
          const analysisDate = latest.data_amostragem ?? latest.created_at ?? null;
          const nextCollectionDate = addDays(analysisDate, 180);

          ultimaAnaliseLinha = `${talhaoLabel} - ${formatDate(analysisDate)}`;
          ultimaAnaliseStatus = statusToLabel(
            deriveTalhaoStatusFromAnalysis(latest),
          );

          if (nextCollectionDate) {
            proximaColetaLinha = `${talhaoLabel} - ${formatDate(nextCollectionDate)}`;
            proximaColetaStatus = 'Sugerida';
          }
        }

        if (!alive) return;

        setMetrics({
          propriedades: properties.length,
          talhoes: talhoesCount,
          analises: analises.length,
          ultimaAnaliseLinha,
          ultimaAnaliseStatus,
          proximaColetaLinha,
          proximaColetaStatus,
        });
      } catch (err: any) {
        if (!alive) return;
        notifications.show({
          title: 'Falha ao carregar dashboard',
          message: err?.message ?? 'Nao foi possivel montar os indicadores.',
          color: 'red',
        });
        setMetrics(EMPTY_METRICS);
      } finally {
        if (alive) setLoadingMetrics(false);
      }
    };

    void loadDashboard();

    return () => {
      alive = false;
    };
  }, [currentUserId]);

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={3} c="green.8">
          Painel Geral
        </Title>
        <Badge variant="light" color="teal">
          {loadingMetrics ? 'Atualizando' : 'Dados locais atualizados'}
        </Badge>
      </Group>
      <Divider mb="lg" />

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
        <Card
          shadow="md"
          radius="md"
          withBorder
          p="xl"
          style={{
            background: 'linear-gradient(135deg, #f6fff8 0%, #e3fcef 100%)',
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
          }}
          onClick={() => navigate('/propriedades')}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = 'scale(1.02)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.transform = 'scale(1.0)')
          }
        >
          <Group justify="space-between">
            <IconBuilding size={32} color="#16a34a" />
            <Text fz="lg" fw={600}>
              Propriedades Ativas
            </Text>
          </Group>
          <Text fz="xl" fw={800} mt="xs" c="green.8">
            {loadingMetrics ? '--' : metrics.propriedades}
          </Text>
          <Text size="sm" c="dimmed">
            Fazendas cadastradas no sistema
          </Text>
          <Button mt="sm" color="green" fullWidth variant="light">
            Abrir propriedades
          </Button>
        </Card>

        <Card
          shadow="lg"
          radius="md"
          withBorder
          p="xl"
          style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
          }}
          onClick={() => navigate('/analise-solo')}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = 'scale(1.02)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.transform = 'scale(1.0)')
          }
        >
          <Group justify="space-between">
            <IconFlask size={32} color="#16a34a" />
            <Text fz="lg" fw={600}>
              Analises de Solo
            </Text>
          </Group>
          <Text fz="xl" fw={800} mt="xs" c="green.8">
            {loadingMetrics ? '--' : metrics.analises}
          </Text>
          <Text size="sm" c="dimmed" mb="sm">
            Acesse interpretacoes e relatorios
          </Text>
          <Button color="green" fullWidth variant="light">
            Acessar modulo
          </Button>
        </Card>

        <Card shadow="sm" radius="md" withBorder p="xl">
          <Text fw={600} fz="lg" mb="xs">
            Ultimas Analises
          </Text>
          <Text c="dimmed">{loadingMetrics ? 'Carregando...' : metrics.ultimaAnaliseLinha}</Text>
          <Text c="green.8" fw={700}>
            {loadingMetrics ? '-' : metrics.ultimaAnaliseStatus}
          </Text>
        </Card>

        <Card shadow="sm" radius="md" withBorder p="xl">
          <Text fw={600} fz="lg" mb="xs">
            Proximas Coletas
          </Text>
          <Text c="dimmed">{loadingMetrics ? 'Carregando...' : metrics.proximaColetaLinha}</Text>
          <Text c="orange.6" fw={700}>
            {loadingMetrics ? '-' : metrics.proximaColetaStatus}
          </Text>
        </Card>
      </SimpleGrid>
    </>
  );
}
